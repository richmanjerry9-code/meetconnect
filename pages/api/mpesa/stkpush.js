import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { phone, amount } = req.body;

  // Environment variables
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackURL = process.env.MPESA_CALLBACK_URL;
  const env = process.env.MPESA_ENV || 'sandbox';

  // Base URLs for sandbox vs production
  const baseURL =
    env === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

  try {
    // 1️⃣ Get Access Token
    const tokenResponse = await axios.get(
      `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        auth: { username: consumerKey, password: consumerSecret },
      }
    );
    const token = tokenResponse.data.access_token;

    // 2️⃣ Generate Password
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      'base64'
    );

    // 3️⃣ Send STK Push
    const stkResponse = await axios.post(
      `${baseURL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // or CustomerBuyGoodsOnline
        Amount: amount,
        PartyA: phone.startsWith('254') ? phone : `254${phone.slice(1)}`,
        PartyB: shortcode,
        PhoneNumber: phone.startsWith('254') ? phone : `254${phone.slice(1)}`,
        CallBackURL: callbackURL,
        AccountReference: 'MeetConnect Payment',
        TransactionDesc: 'Membership upgrade',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.status(200).json(stkResponse.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'STK Push failed' });
  }
}
