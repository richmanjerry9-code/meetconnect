import { adminDb } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const callbackData = req.body.Result; // Similar structure
    if (!callbackData) return res.status(400).json({ error: 'Invalid timeout data' });

    const conversationID = callbackData.ConversationID;
    const pendingRef = adminDb.collection('pendingWithdrawals').doc(conversationID);

    await pendingRef.update({
      status: 'timed_out',
      resultDesc: callbackData.ResultDesc,
      updatedAt: new Date(),
    });

    return res.status(200).json({ message: 'B2C timeout processed' });
  } catch (err) {
    console.error('B2C Timeout error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};