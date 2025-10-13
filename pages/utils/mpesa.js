// utils/mpesa.js
import axios from 'axios';

const BASE_URL = 'https://sandbox.safaricom.co.ke'; // Switch to 'https://api.safaricom.co.ke' for production

export const getToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET in env');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const { data } = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    console.log('Token fetched successfully');
    return data.access_token;
  } catch (error) {
    console.error('Token fetch error:', error.response?.data || error.message);
    throw error;
  }
};

export const initiateSTKPush = async (amount, phoneNumber, accountReference, transactionDesc) => {
  // Validate inputs
  if (!phoneNumber.match(/^254[17]\d{8}$/)) {
    throw new Error(`Invalid phone number: ${phoneNumber}. Must be 2547XXXXXXXX or 2541XXXXXXXX.`);
  }
  amount = Number(amount);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error(`Invalid amount: ${amount}. Must be integer >=1.`);
  }
  if (accountReference.length > 20) {
    throw new Error(`AccountReference too long: ${accountReference.length} chars (max 20).`);
  }

  const token = await getToken();
  const shortcode = process.env.MPESA_SHORTCODE || '174379';
  const passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  // Use ngrok or localtunnel public URL here - replace 'your-ngrok-url.ngrok-free.app' with actual
  const publicCallbackUrl = 'https://your-ngrok-url.ngrok-free.app/api/mpesa-callback'; // Or localtunnel URL

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: publicCallbackUrl, // Fixed: Use public URL from ngrok/localtunnel
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    console.log('Sending STK Payload:', JSON.stringify(payload, null, 2)); // Debug log
    const { data } = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('STK Success:', data);
    return data;
  } catch (error) {
    console.error('STK Push error details:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      payload, // Log payload for repro
    });
    throw error;
  }
};


