// pages/api/addFunds.js
import { initiateSTKPush } from '../../utils/mpesa';
import { db } from '../../lib/firebase.js'; // fixed import
import { doc, setDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { amount, phone, userId, accountReference = 'WalletTopUp', transactionDesc = 'Add Funds' } = req.body;
  if (!phone || !amount || !userId) return res.status(400).json({ error: 'Phone, amount, and userId are required' });

  try {
    const checkoutRequestID = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'pendingTransactions', checkoutRequestID), {
      userId,
      amount: parseInt(amount),
      phone,
      type: 'add_fund',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    const response = await initiateSTKPush(parseInt(amount), phone, accountReference, transactionDesc);
    res.status(200).json({ checkoutRequestID, response });
  } catch (error) {
    console.error('Add funds error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
}
