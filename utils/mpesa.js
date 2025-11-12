// utils/mpesa.js
import axios from 'axios';

const ENV = process.env.MPESA_ENV || 'sandbox';
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

// Base URLs
const BASE_URL =
  ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

const OAUTH_URL = `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
const STK_URL = `${BASE_URL}/mpesa/stkpush/v1/processrequest`;

// ✅ Get Access Token
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const { data } = await axios.get(OAUTH_URL, {
      headers: { Authorization: `Basic ${auth}` },
    });
    console.log('✅ Access token received');
    return data.access_token;
  } catch (err) {
    console.error('❌ M-Pesa OAuth Error:', err.response?.data || err.message);
    throw new Error('Failed to get M-Pesa access token');
  }
}

// ✅ Format phone number (required format: 2547XXXXXXXX)
function formatPhone(phone) {
  if (!phone) throw new Error('Phone number is required');
  let formatted = phone.toString().trim();

  if (formatted.startsWith('+254')) {
    formatted = '254' + formatted.substring(4);
  } else if (formatted.startsWith('0')) {
    formatted = '254' + formatted.substring(1);
  } else if (!formatted.startsWith('254')) {
    throw new Error('Invalid phone number. Must start with 07, +254, or 254');
  }

  console.log('📞 Formatted phone sent to Safaricom:', formatted);
  return formatted;
}

// ✅ Initiate STK Push
export async function initiateSTKPush({ phone, amount, accountReference, transactionDesc }) {
  try {
    if (!phone || !amount) throw new Error('Phone and amount are required');

    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');
    const phoneNumber = formatPhone(phone);

    const stkPayload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: CALLBACK_URL,
      AccountReference: accountReference || 'MeetConnect',
      TransactionDesc: transactionDesc || 'Payment',
    };

    console.log('🚀 Sending STK Push payload:', stkPayload);

    const { data } = await axios.post(STK_URL, stkPayload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✅ STK Push response:', data);
    return data;
  } catch (err) {
    console.error('❌ STK Push Error:', err.response?.data || err.message);
    throw new Error('STK Push failed');
  }
}
