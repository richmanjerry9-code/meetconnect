// pages/api/mpesacallback.js
import { adminDb, admin } from '../../lib/firebaseAdmin';  // Import admin for FieldValue

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const callback = req.body.Body.stkCallback;
    const { ResultCode, CheckoutRequestID, ResultDesc } = callback;

    // Fetch pending using namespace API
    const pendingDoc = await adminDb.collection('pendingPayments').doc(CheckoutRequestID).get();
    if (!pendingDoc.exists) {
      console.log('No pending payment found for ID:', CheckoutRequestID);
      return res.status(200).send('OK');
    }

    const pending = pendingDoc.data();

    if (ResultCode !== 0) {
      // Failure
      await adminDb.collection('pendingPayments').doc(CheckoutRequestID).update({
        status: 'failed',
        resultDesc: ResultDesc,
      });
      console.log('Payment failed:', ResultDesc);
      return res.status(200).send('OK');
    }

    // Success: Extract metadata
    const meta = callback.CallbackMetadata.Item;
    const amount = meta.find((i) => i.Name === 'Amount')?.Value;
    const receipt = meta.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
    const phone = meta.find((i) => i.Name === 'PhoneNumber')?.Value;

    // Update pending status
    await adminDb.collection('pendingPayments').doc(CheckoutRequestID).update({
      status: 'success',
      receipt,
      completedAt: new Date().toISOString(),
    });

    // Update profile
    const profileRef = adminDb.collection('profiles').doc(pending.userId);

    if (pending.type === 'upgrade') {
      const expiry = calcExpiry(pending.duration);
      await profileRef.update({
        membership: pending.level,
        membershipExpiry: expiry,
      });
    } else if (pending.type === 'addfunds') {
      await profileRef.update({
        walletBalance: admin.firestore.FieldValue.increment(Number(amount)),  // Cast to number
      });
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Error');
  }
}

// Helper (unchanged)
function calcExpiry(duration) {
  const now = new Date();
  const daysMap = { '3 Days': 3, '7 Days': 7, '15 Days': 15, '30 Days': 30 };
  now.setDate(now.getDate() + (daysMap[duration] || 0));
  return now.toISOString();
}