// pages/api/mpesa-callback.js
import { db } from '../../firebase'; // Adjust path if needed
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { Body } = req.body;
  if (!Body || !Body.stkCallback) {
    return res.status(200).end(); // Ignore invalid
  }

  const { CheckoutRequestID, ResultCode, ResultDesc } = Body.stkCallback;

  try {
    // Assume pendingTransactions collection (from previous context)
    const pendingRef = doc(db, 'pendingTransactions', CheckoutRequestID);
    const pendingSnap = await getDoc(pendingRef);
    if (!pendingSnap.exists()) {
      console.log('No pending tx for', CheckoutRequestID);
      return res.status(200).json({ ResultDesc: 'No pending transaction' });
    }

    const pendingData = pendingSnap.data();

    if (ResultCode === 0) { // Success
      const userRef = doc(db, 'profiles', pendingData.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (pendingData.type === 'add_fund') {
          const newBalance = (userData.walletBalance || 0) + pendingData.amount;
          await updateDoc(userRef, { walletBalance: newBalance });
          console.log(`Added KSh ${pendingData.amount} to wallet for ${pendingData.userId}`);
        } else if (pendingData.type === 'upgrade') {
          await updateDoc(userRef, { membership: pendingData.level });
          console.log(`Upgraded ${pendingData.userId} to ${pendingData.level}`);
        }
      }
    } else {
      console.log(`Tx failed: ${ResultDesc} for ${CheckoutRequestID}`);
    }

    await deleteDoc(pendingRef); // Clean up
    res.status(200).json({ ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(200).end(); // Always 200 for M-Pesa
  }
}