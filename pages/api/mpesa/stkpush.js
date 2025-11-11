// pages/api/mpesa/stkpush.js
import { initiateSTKPush } from '../../../utils/mpesa';

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { phone, amount, accountReference, transactionDesc } = req.body;

  if (!phone || !amount || !accountReference || !transactionDesc) {
    return res.status(400).json({ error: 'Phone, amount, accountReference, and transactionDesc are required' });
  }

  try {
    const stkResult = await initiateSTKPush({
      phone,
      amount,
      accountReference,
      transactionDesc,
    });
    res.status(200).json(stkResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}