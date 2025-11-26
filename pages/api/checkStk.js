import { adminDb } from '../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const getAccessToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) throw new Error('M-Pesa credentials not configured.');
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await fetch(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) throw new Error('Failed to get access token.');
  const data = await res.json();
  return data.access_token;
};

const queryStkStatus = async (checkoutRequestID) => {
  const token = await getAccessToken();
  const businessShortCode = process.env.MPESA_SHORTCODE;  // Head office shortcode (must match stkpush.js)
  const passkey = process.env.MPESA_PASSKEY;
  if (!businessShortCode || !passkey) throw new Error('M-Pesa shortcode or passkey not configured.');
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');
  const body = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestID,
  };
  const res = await fetch('https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const responseData = await res.json();
  console.log(' STK Query Response:', responseData);
  if (!res.ok) {
    throw new Error(responseData.errorMessage || 'Failed to query STK status.');
  }
  return responseData;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { requestId } = req.query;
  if (!requestId) return res.status(400).json({ error: 'Missing requestId' });
  try {
    const pendingRef = adminDb.collection('pendingPayments').doc(requestId);
    const pendingSnap = await pendingRef.get();
    if (!pendingSnap.exists) return res.status(404).json({ error: 'Payment not found' });

    const pending = pendingSnap.data();

    if (pending.status !== 'pending')
      return res.status(200).json({ status: pending.status, resultDesc: pending.resultDesc });

    const queryRes = await queryStkStatus(requestId);
    const resultCode = queryRes.ResultCode;
    const userRef = adminDb.collection('profiles').doc(pending.userId);

    if (resultCode === '0') {
      const metadata = queryRes.CallbackMetadata?.Item || [];
      const mpesaReceipt = metadata.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = metadata.find((i) => i.Name === 'TransactionDate')?.Value;

      if (pending.type === 'upgrade') {
        await userRef.update({ membership: pending.level });
      } else if (pending.type === 'addfund') {
        await userRef.update({ walletBalance: adminDb.FieldValue.increment(pending.amount) });
      } else if (pending.type === 'subscription') {
        const days = pending.durationDays;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const subId = `${pending.userId}_${pending.creatorId}`;
        await adminDb.collection('subscriptions').doc(subId).set({
          userId: pending.userId,
          creatorId: pending.creatorId,
          amount: pending.amount,
          durationDays: days,
          expiresAt,
          updatedAt: new Date(),
          mpesaReceipt,
          transactionDate,
        }, { merge: true });

        // Credit 80% to creator's earnings wallet
        const creatorRef = adminDb.collection('profiles').doc(pending.creatorId);
        const earnings = Math.floor(pending.amount * 0.8); // 80% (platform retains 20%)
        await creatorRef.update({
          earningsBalance: FieldValue.increment(earnings),
        });
      }

      const updateData = {
        status: 'completed',
        updatedAt: new Date()
      };
      if (mpesaReceipt !== undefined) updateData.mpesaReceipt = mpesaReceipt;
      if (transactionDate !== undefined) updateData.transactionDate = transactionDate;
      await pendingRef.update(updateData);
      return res.status(200).json({ status: 'completed' });
    } else {
      await pendingRef.update({ status: 'failed', resultDesc: queryRes.ResultDesc, updatedAt: new Date() });
      return res.status(200).json({ status: 'failed', resultDesc: queryRes.ResultDesc });
    }
  } catch (err) {
    console.error(' checkStk error:', err);
    return res.status(500).json({ error: err.message });
  }
}