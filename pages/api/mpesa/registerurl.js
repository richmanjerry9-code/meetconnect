// pages/api/mpesa/registerurl.js
import axios from 'axios';

const BASE_URL = 'https://sandbox.safaricom.co.ke';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE || '174379';

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    // Step 1: Generate access token
    const tokenResponse = await axios.get(
      `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const token = tokenResponse.data.access_token;

    // Step 2: Register URLs
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
