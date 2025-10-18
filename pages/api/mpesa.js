// pages/api/mpesa.js
import { initiateSTKPush } from '../../utils/mpesa';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { phone, amount } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ message: 'Phone and amount are required' });
  }

  try {
    // Use phone typed by user
    const response = await initiateSTKPush(
      Number(amount),
      phone,
      'Test123', // AccountReference
      'Payment Test' // TransactionDesc
    );

    res.status(200).json(response);
  } catch (error) {
    console.error('STK Push API Error:', error);
    const errorDetails = error.response?.data || { message: error.message };
    res.status(500).json({ message: 'STK Push failed', error: errorDetails });
  }
}
