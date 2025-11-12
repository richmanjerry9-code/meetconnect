// pages/api/stkpush.js
import { stkPush } from '../../utils/mpesa';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, amount, accountReference, transactionDesc } = req.body;

  try {
    const result = await stkPush({
      phone,
      amount,
      accountReference,
      transactionDesc,
      callbackUrl: 'https://meetconnect.co.ke/api/mpesacallback', // live callback
    });
    res.status(200).json(result);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
}

