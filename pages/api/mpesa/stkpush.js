import axios from 'axios';
import { getAccessToken } from '../../utils/mpesaauth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount are required' });

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackURL = process.env.MPESA_CALLBACK_URL;

  try {
    // 1️⃣ Get Access Token
    const token = await getAccessToken();

    // 2️⃣ Generate Password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // 3️⃣ Send STK Push
    const stkResponse = await axios.post(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // or CustomerBuyGoodsOnline
        Amount: Number(amount),
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
