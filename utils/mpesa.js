// utils/mpesa.js
import axios from 'axios';

// Env variables
const OAUTH_URL = process.env.MPESA_OAUTH_URL || 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL; // Must be HTTPS

// ✅ Helper to format phone number for STK Push
function formatPhone(phone) {
  if (!phone) throw new Error('Phone number is required');

  let formatted = phone.replace(/\s+/g, ''); // remove spaces

  if (formatted.startsWith('+254')) {
    // keep as is
  } else if (formatted.startsWith('07') || formatted.startsWith('01')) {
    // keep as is
  } else {
    throw new Error('Invalid phone number. Must start with 07, 01, or +254');
  }

  return formatted;
}

// Get Access Token
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

    const response = await axios.get(OAUTH_URL, {
      headers: { Authorization: `Basic ${auth}` },
    });

    return response.data.access_token;
  } catch (err) {
    console.error('M-Pesa OAuth Error:', err.response?.data || err.message);
    throw new Error('Failed to get M-Pesa access token');
  }
}

// Initiate STK Push
export async function initiateSTKPush({ phone, amount, accountReference, transactionDesc }) {
  try {
    if (!phone || !amount) throw new Error('Phone and amount are required');

    const token = await getAccessToken();

    // timestamp and password
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

    const stkResponse = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return stkResponse.data;
  } catch (err) {
    console.error('STK Push Error:', err.response?.data || err.message);
    throw new Error('STK Push failed');
  }
}





