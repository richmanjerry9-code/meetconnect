// pages/api/callback.js
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { increment } from 'firebase/firestore';

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
    const pendingRef = doc(db, 'pendingPayments', checkoutRequestID);
    const pendingSnap = await getDoc(pendingRef);
    if (!pendingSnap.exists()) {
      return res.status(200).json({ message: 'No pending payment found' });
    }
    const pending = pendingSnap.data();
    const userRef = doc(db, 'profiles', pending.userId);

    if (resultCode === 0) {
      const metadata = callbackData.CallbackMetadata.Item;
      const mpesaAmount = metadata.find((i) => i.Name === 'Amount')?.Value;
      const mpesaReceipt = metadata.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = metadata.find((i) => i.Name === 'TransactionDate')?.Value;

      if (pending.type === 'upgrade') {
        await updateDoc(userRef, {
          membership: pending.level,
        });
      } else if (pending.type === 'addfund') {
        await updateDoc(userRef, {
          walletBalance: increment(pending.amount),
        });
      }
      await updateDoc(pendingRef, {
        status: 'completed',
        mpesaReceipt,
        transactionDate,
        updatedAt: new Date(),
      });
    } else {
      await updateDoc(pendingRef, {
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
