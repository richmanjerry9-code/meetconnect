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
    const response = await initiateSTKPush(Number(amount), phone, 'Test123', 'Payment Test');
    res.status(200).json(response);
  } catch (error) {
    console.error('API Error:', error); // Full log
    const errorDetails = error.response?.data || { message: error.message };
    res.status(500).json({ 
      message: 'STK Push failed', 
      error: errorDetails // Object, not stringified here
    });
  }
}





