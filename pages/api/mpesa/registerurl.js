// pages/api/mpesa/registerurl.js
import axios from 'axios';
import { BASE_URL } from '../../../utils/mpesa'; // Use dynamic BASE_URL
import { getAccessToken } from '../mpesaauth'; // Reuse getAccessToken

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const shortcode = process.env.MPESA_SHORTCODE || '174379';

  try {
    // Reuse getAccessToken
    const token = await getAccessToken();

    // Register URLs
    const payload = {
      ShortCode: shortcode,
      ResponseType: 'Completed', // or "Cancelled"
      ConfirmationURL: `${process.env.NEXT_PUBLIC_BASE_URL}/api/mpesa/confirmation`,
      ValidationURL: `${process.env.NEXT_PUBLIC_BASE_URL}/api/mpesa/validation`,
    };

    const { data } = await axios.post(`${BASE_URL}/mpesa/c2b/v1/registerurl`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    res.status(200).json(data);
  } catch (error) {
    console.error('Register URL Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
}