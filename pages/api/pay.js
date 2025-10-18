import stkPushHandler from './mpesa/stkpush';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, amount } = req.body;

  // Basic validation
  if (!phone || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid phone or amount' });
  }

  try {
    // Call the stkPush handler directly (same as calling /api/mpesa/stkpush)
    const mockReq = { method: 'POST', body: { phone, amount } };
    const mockRes = {
      status: (code) => ({
        json: (data) => res.status(code).json(data),
        end: () => res.status(code).end(),
      }),
    };

    await stkPushHandler(mockReq, mockRes);
  } catch (error) {
    console.error('Payment error:', error.message);
    res.status(500).json({ error: 'Payment failed—try again or contact support' });
  }
}


