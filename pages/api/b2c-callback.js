import { adminDb } from '../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const callbackData = req.body.Result; // Per docs, { "Result": { ... } }
    if (!callbackData) return res.status(400).json({ error: 'Invalid callback data' });

    const conversationID = callbackData.ConversationID;
    const resultCode = callbackData.ResultCode;
    const resultDesc = callbackData.ResultDesc;

    const pendingRef = adminDb.collection('pendingWithdrawals').doc(conversationID);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) return res.status(200).json({ message: 'No pending withdrawal found' });

    const pending = pendingSnap.data();
    const creatorRef = adminDb.collection('profiles').doc(pending.userId);

    if (resultCode === 0) {
      // Success: Deduct from earningsBalance
      await creatorRef.update({
        earningsBalance: FieldValue.increment(-pending.amount),
      });

      // Optional: Log transaction details from callback
      const resultParams = callbackData.ResultParameters.ResultParameter.reduce((acc, param) => {
        acc[param.Key] = param.Value;
        return acc;
      }, {});

      await pendingRef.update({
        status: 'completed',
        updatedAt: new Date(),
        mpesaReceipt: resultParams.TransactionReceipt,
        transactionCompletedDateTime: resultParams.TransactionCompletedDateTime,
        receiverPublicName: resultParams.ReceiverPartyPublicName,
      });

      // Optional: Notify creator via email/SMS
    } else {
      // Failure: Log but don't deduct
      await pendingRef.update({
        status: 'failed',
        resultDesc,
        updatedAt: new Date(),
      });

      // Optional: Retry logic or notify admin
    }

    return res.status(200).json({ message: 'B2C callback processed' });
  } catch (err) {
    console.error('B2C Callback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};