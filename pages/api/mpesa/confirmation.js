// pages/api/mpesa/confirmation.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('Confirmation received:', req.body);

  // You can save payment details to Firebase here if you want
  const response = {
    ResultCode: 0,
    ResultDesc: 'Success',
  };

  res.status(200).json(response);
}
