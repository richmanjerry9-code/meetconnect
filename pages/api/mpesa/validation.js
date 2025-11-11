// pages/api/mpesa/validation.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('Validation received:', req.body);

  // Accept the transaction (or reject with ResultCode: 1 if needed)
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
}