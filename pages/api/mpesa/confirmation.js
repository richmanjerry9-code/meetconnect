// pages/api/mpesa/confirmation.js
import { db } from '../../../lib/firebase'; // Import Firebase if you want to save here

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('Confirmation received:', req.body);

  // Optional: Save payment details to Firebase here if needed
  // Example:
  // await addDoc(collection(db, 'mpesa_confirmations'), req.body);

  const response = {
    ResultCode: 0,
    ResultDesc: 'Success',
  };

  res.status(200).json(response);
}