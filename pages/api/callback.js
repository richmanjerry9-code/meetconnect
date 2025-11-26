// pages/api/callback.js
import { adminDb } from '@/lib/firebaseAdmin'; // Adjust path if needed
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const callbackData = req.body.Body?.stkCallback;
    if (!callbackData) {
      return res.status(400).json({ error: 'Invalid callback data' });
    }

    const checkoutRequestID = callbackData.CheckoutRequestID;
    const resultCode = callbackData.ResultCode;

    const pendingRef = adminDb.collection('pendingPayments').doc(checkoutRequestID);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) {
      return res.status(200).json({ message: 'No pending payment found' });
    }

    const pending = pendingSnap.data();
    const userRef = adminDb.collection('profiles').doc(pending.userId);

    if (resultCode === 0) {
      const metadata = callbackData.CallbackMetadata.Item;
      const mpesaAmount = metadata.find((i) => i.Name === 'Amount')?.Value;
      const mpesaReceipt = metadata.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = metadata.find((i) => i.Name === 'TransactionDate')?.Value;

      // Optional: Validate amount matches
      if (mpesaAmount !== pending.amount) {
        throw new Error('Amount mismatch in callback');
      }

      if (pending.type === 'upgrade') {
        const daysMap = { '3 Days': 3, '7 Days': 7, '15 Days': 15, '30 Days': 30 };
        const days = daysMap[pending.duration] || 0;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await userRef.update({
          membership: pending.level,
          membershipExpiresAt: expiresAt,
        });
      } else if (pending.type === 'addfund') {
        await userRef.update({
          walletBalance: FieldValue.increment(pending.amount),
        });
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

      await pendingRef.update({
        status: 'completed',
        mpesaReceipt,
        transactionDate,
        updatedAt: new Date(),
      });
    } else {
      await pendingRef.update({
        status: 'failed',
        resultDesc: callbackData.ResultDesc,
        updatedAt: new Date(),
      });
    }

    return res.status(200).json({ message: 'Callback processed' });
  } catch (err) {
    console.error('Callback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};