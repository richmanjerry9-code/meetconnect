import { initiateSTKPush } from '../../utils/mpesa';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, amount, accountReference, transactionDesc } = req.body;

  try {
    const stkResult = await initiateSTKPush({ phone, amount, accountReference, transactionDesc });
    res.status(200).json(stkResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

