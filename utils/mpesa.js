// utils/mpesa.js
import axios from 'axios';

const BASE_URL = 'https://sandbox.safaricom.co.ke';

export const getToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('MPESA keys missing in .env.local');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const { data } = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return data.access_token;
  } catch (error) {
    console.error('Token fetch error:', error.response?.data || error.message);
    throw error;
  }
};

export const initiateSTKPush = async (amount, phoneNumber, accountReference, transactionDesc) => {
  if (!phoneNumber.match(/^254[17]\d{8}$/)) {
    throw new Error(`Invalid phone number: ${phoneNumber}`);
  }

  amount = Number(amount);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  const token = await getToken();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  try {
    const { data } = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,        // <-- User phone used here
        PartyB: shortcode,
        PhoneNumber: phoneNumber,   // <-- User phone used here
        CallBackURL: `${process.env.NEXT_PUBLIC_BASE_URL}/api/mpesa-callback`,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return data;
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    throw error;
  }
};
