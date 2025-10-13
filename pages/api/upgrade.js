// pages/api/upgrade.js
import { initiateSTKPush } from '../../utils/mpesa';
import { db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, phone, userId, level, duration } = req.body;

  if (!amount || !phone || !userId || !level || !duration) {
    return res.status(400).json({ error: 'Amount, phone, userId, level, and duration are required' });
  }

  try {
    // Store pending upgrade transaction
    const checkoutRequestID = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'pendingTransactions', checkoutRequestID), {
      userId,
      amount,
      phone,
      type: 'upgrade',
      level,
      duration,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Initiate STK Push
    const response = await initiateSTKPush(amount, phone, `Upgrade-${level}`, `Upgrade membership to ${level}`);

    res.status(200).json({
      checkoutRequestID,
      message: 'Membership upgrade STK Push initiated ✅',
      response,
    });
  } catch (error) {
    console.error('Upgrade error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
}
