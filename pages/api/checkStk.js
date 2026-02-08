// pages/api/checkStk.js
import { adminDb } from '../../lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const getAccessToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials not configured.');
  }

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
  const businessShortCode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!businessShortCode || !passkey) {
    throw new Error('M-Pesa shortcode or passkey not configured.');
  }

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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const responseData = await res.json();
  console.log('🔍 STK Query Response:', responseData);

  if (!res.ok) {
    throw new Error(responseData.errorMessage || 'Failed to query STK status.');
  }

  return responseData;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { requestId } = req.query;
  if (!requestId) {
    return res.status(400).json({ error: 'Missing requestId' });
  }

  try {
    const pendingRef = adminDb.collection('pendingPayments').doc(requestId);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const pending = pendingSnap.data();

    // Already processed
    if (pending.status !== 'pending') {
      return res.status(200).json({
        ResultCode: pending.status === 'completed' ? '0' : '1',
        ResultDesc: pending.resultDesc || '',
      });
    }

    // Query Safaricom
    const queryRes = await queryStkStatus(requestId);
    const resultCode = queryRes.ResultCode?.toString();

    const userRef = adminDb.collection('profiles').doc(pending.userId);

    if (resultCode === '0') {
      // SUCCESS
      const metadata = queryRes.CallbackMetadata?.Item || [];
      const mpesaReceipt = metadata.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = metadata.find((i) => i.Name === 'TransactionDate')?.Value;

      // === Handle different payment types ===
      if (pending.type === 'activation') {
        const sevenDaysFromNow = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

        await userRef.update({
          activationPaid: true,
          hidden: false,
          membership: 'Prime',
          membershipExpiresAt: sevenDaysFromNow,
        });
      } 
      else if (pending.type === 'upgrade') {
        const daysMap = { '3 Days': 3, '7 Days': 7, '15 Days': 15, '30 Days': 30 };
        const days = daysMap[pending.duration] || 30;
        const expiresAt = Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

        await userRef.update({
          membership: pending.level,
          membershipExpiresAt: expiresAt,
        });
      } 
      else if (pending.type === 'addfund') {
        await userRef.update({
          fundingBalance: FieldValue.increment(pending.amount),
        });
      } 
      else if (pending.type === 'subscription') {
        const days = pending.durationDays || 30;
        const expiresAt = Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
        const subId = `${pending.userId}_${pending.creatorId || 'unknown'}`;

        await adminDb.collection('subscriptions').doc(subId).set({
          userId: pending.userId,
          creatorId: pending.creatorId,
          amount: pending.amount,
          durationDays: days,
          expiresAt,
          updatedAt: Timestamp.now(),
          mpesaReceipt,
          transactionDate,
        }, { merge: true });

        // Give 80% to creator
        if (pending.creatorId) {
          const creatorRef = adminDb.collection('profiles').doc(pending.creatorId);
          const earnings = Math.floor(pending.amount * 0.8);
          await creatorRef.update({
            earningsBalance: FieldValue.increment(earnings),
          });
        }
      }

      // Mark payment as completed
      const updateData = {
        status: 'completed',
        updatedAt: Timestamp.now(),
        resultDesc: queryRes.ResultDesc || 'Success',
      };
      if (mpesaReceipt) updateData.mpesaReceipt = mpesaReceipt;
      if (transactionDate) updateData.transactionDate = transactionDate;

      await pendingRef.update(updateData);

      return res.status(200).json({ ResultCode: '0', ResultDesc: 'Success' });
    } 
    else {
      // FAILED or still processing
      await pendingRef.update({
        status: resultCode === '4999' ? 'pending' : 'failed',
        resultDesc: queryRes.ResultDesc || 'Unknown error',
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({
        ResultCode: resultCode,
        ResultDesc: queryRes.ResultDesc || 'Payment failed',
      });
    }
  } catch (err) {
    console.error('checkStk error:', err);
    return res.status(500).json({ error: err.message });
  }
}