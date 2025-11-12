// pages/api/addFunds.js
import { stkPush } from '../../utils/mpesa';
import { adminDb } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { phone, amount, userId, accountReference, transactionDesc } = req.body;
  if (!phone || !amount || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const data = await stkPush({
      phone,
      amount,
      accountReference,
      transactionDesc,
      callbackUrl: process.env.MPESA_CALLBACK_URL,
    });

    // Store pending payment using namespace API
    await adminDb.collection('pendingPayments').doc(data.CheckoutRequestID).set({
      type: 'addfunds',
      userId,
      amount,
      phone,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    res.status(200).json(data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'STK push failed' });
  }
}



