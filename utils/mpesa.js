import axios from 'axios';

// Force production
const BASE_URL = 'https://api.safaricom.co.ke';
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

if (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORTCODE || !PASSKEY || !CALLBACK_URL) {
  throw new Error('Missing M-Pesa credentials or callback URL in environment variables.');
}

const OAUTH_URL = `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
const STK_PUSH_URL = `${BASE_URL}/mpesa/stkpush/v1/processrequest`;

export function formatPhone(phone) {
  if (!phone) throw new Error('Phone number is required');

  let p = phone.toString().trim().replace(/[\s-]/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  else if (p.startsWith('+254')) p = p.slice(1);
  else if (!p.startsWith('254')) throw new Error('Invalid phone number format.');

  if (!/^2547\d{8}$/.test(p)) throw new Error('Invalid phone number after normalization.');
  return p;
}

async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  const res = await axios.get(OAUTH_URL, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.data?.access_token) throw new Error('Failed to get access token');
  return res.data.access_token;
}

export async function initiateSTKPush({ phone, amount, accountReference, transactionDesc }) {
  if (!phone || !amount || !accountReference || !transactionDesc)
    throw new Error('Phone, amount, accountReference, and transactionDesc are required');

  const formattedPhone = formatPhone(phone);
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: formattedPhone,
    PartyB: SHORTCODE,
    PhoneNumber: formattedPhone,
    CallBackURL: CALLBACK_URL,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  // Don't log sensitive info
  console.log('STK Push Payload ready (password hidden)');

  try {
    const res = await axios.post(STK_PUSH_URL, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    return res.data;
  } catch (err) {
    throw new Error('STK Push failed: ' + (err.response?.data?.errorMessage || err.message));
  }
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
