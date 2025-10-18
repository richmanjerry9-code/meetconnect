import axios from 'axios';

const BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// Generate OAuth token
export const getToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET missing in .env');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const { data } = await axios.get(
      `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );
    console.log('✅ Token fetched successfully');
    return data.access_token;
  } catch (error) {
    console.error('❌ Token fetch error:', error.response?.data || error.message);
    throw error;
  }
};

// Initiate STK Push
export const initiateSTKPush = async (amount, phoneNumber, accountReference, transactionDesc) => {
  if (!phoneNumber.match(/^254[17]\d{8}$/)) {
    throw new Error(`Invalid phone number: ${phoneNumber}. Use 2547XXXXXXXX or 2541XXXXXXXX.`);
  }

  amount = Number(amount);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error(`Invalid amount: ${amount}. Must be integer >= 1.`);
  }

  const token = await getToken();
  const shortcode = process.env.MPESA_SHORTCODE || '174379';
  const passkey = process.env.MPESA_PASSKEY;
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL + '/api/mpesa/stkcallback'; // You need this endpoint

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    console.log('📤 Sending STK Push payload:', payload);
    const { data } = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    console.log('✅ STK Push response:', data);
    return data;
  } catch (error) {
    console.error('❌ STK Push error:', error.response?.data || error.message, 'Payload:', payload);
    throw error;
  }
};
