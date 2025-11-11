// pages/api/upgrade.js
import { initiateSTKPush, formatPhone } from '../../utils/mpesa';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, amount, accountReference, transactionDesc, userId, level, duration } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ error: 'Phone and amount are required' });
  }

  console.log('Received phone:', phone); // Debug incoming phone

  try {
    // Validate and normalize phone
    const formattedPhone = formatPhone(phone);

    const stkResult = await initiateSTKPush({
      phone: formattedPhone, // pass normalized phone
      amount: Number(amount),
      accountReference,
      transactionDesc,
    });

    res.status(200).json(stkResult);
  } catch (err) {
    console.error('Upgrade error:', err.response?.data || err.message);

    // Propagate proper error codes:
    if (err.message.includes('Invalid phone')) {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: err.message || 'STK Push failed' });
  }
}
