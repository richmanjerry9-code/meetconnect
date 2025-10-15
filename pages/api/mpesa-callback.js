// pages/api/mpesa/callback.js
import { db } from '../../firebase'; // Adjust to '../../../lib/firebase' if in /lib
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;

  try {
    const callback = data.Body.stkCallback;
    const checkoutRequestID = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;

    // Find pending transaction
    const pendingRef = doc(db, 'pendingTransactions', checkoutRequestID);
    const pendingSnap = await getDoc(pendingRef);

    if (!pendingSnap.exists()) {
      console.log('No pending transaction found for', checkoutRequestID);
      return res.status(200).json({ result: 'ok' });
    }

    const pendingData = pendingSnap.data();

    if (resultCode === 0) {
      // Success: Update wallet or membership
      if (pendingData.type === 'add_fund') {
        const userRef = doc(db, 'profiles', pendingData.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentWallet = userSnap.data().walletBalance || 0;
          await updateDoc(userRef, {
            walletBalance: currentWallet + pendingData.amount,
          });
        }
        console.log('Wallet updated for user', pendingData.userId, 'by', pendingData.amount);
      } else if (pendingData.type === 'upgrade') {
        // Update membership
        const userRef = doc(db, 'profiles', pendingData.userId);
        await updateDoc(userRef, {
          membership: pendingData.level,
        });
        console.log('Membership upgraded to', pendingData.level, 'for user', pendingData.userId);
      }
    } else {
      console.log('Transaction failed:', callback.ResultDesc);
    }

    // Delete pending
    await deleteDoc(pendingRef);

    res.status(200).json({ result: 'ok' });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(200).json({ result: 'ok' }); // Always return 200 to M-Pesa
  }
}
