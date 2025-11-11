import axios from 'axios';

const env = process.env.MPESA_ENV || 'sandbox'; // Default to sandbox if not set
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || process.env.CONSUMER_KEY; // Support both prefixed and non-prefixed
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || process.env.CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE || process.env.SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY || process.env.PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || process.env.CALLBACK_URL;

export const BASE_URL = env === 'production' 
  ? 'https://api.safaricom.co.ke' 
  : 'https://sandbox.safaricom.co.ke';
const OAUTH_URL = process.env.MPESA_OAUTH_URL || `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
const STK_PUSH_URL = process.env.MPESA_STK_PUSH_URL || `${BASE_URL}/mpesa/stkpush/v1/processrequest`; // Allow override

console.log(`M-Pesa Environment: ${env} (Base URL: ${BASE_URL})`); // Log on module load for confirmation

/**
 * Format phone number for Daraja API.
 * Converts input to 2547XXXXXXXX format (no leading + or 0).
 * Acceptable input formats: 07XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX
 */
export function formatPhone(phone) {
  if (!phone) throw new Error('Phone number is required');

  let p = phone.toString().trim();
  p = p.replace(/[\s-]/g, ''); // remove spaces/dashes

  // Normalize to 2547XXXXXXXX
  if (p.startsWith('0')) {
    p = '254' + p.slice(1);
  } else if (p.startsWith('+254')) {
    p = p.slice(1); // remove +
  } else if (p.startsWith('254')) {
    // already good
  } else {
    throw new Error('Invalid phone number. Use 07XXXXXXXX, +2547XXXXXXXX, or 2547XXXXXXXX format.');
  }

  // Validate: 254 followed by 7 and 8 digits
  if (!/^2547\d{8}$/.test(p)) {
    throw new Error('Invalid phone number format after normalization.');
  }

  return p;
}

/** Get OAuth access token from Daraja */
async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  try {
    const response = await axios.get(OAUTH_URL, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.data?.access_token) {
      throw new Error('Failed to get access token');
    }

    console.log('Access token obtained successfully'); // Debug log
    return response.data.access_token;
  } catch (err) {
    console.error('Access Token Error:', {
      message: err.message,
      response: err.response?.data,
    });
    throw err;
  }
}

/**
 * Initiate STK Push
 * @param {Object} options
 * @param {string} options.phone - 07XXXXXXXX, +2547XXXXXXXX, or 2547XXXXXXXX
 * @param {number} options.amount
 * @param {string} options.accountReference
 * @param {string} options.transactionDesc
 */
export async function initiateSTKPush({ phone, amount, accountReference, transactionDesc }) {
  if (!phone || !amount || !accountReference || !transactionDesc) throw new Error('Phone, amount, accountReference, and transactionDesc are required');

  const formattedPhone = formatPhone(phone);
  console.log('Using formatted phone for STK Push:', formattedPhone);

  // Reminder: In sandbox, use test numbers like 254708374149. In prod, any valid Kenyan number.
  if (env === 'sandbox') {
    console.log('SANDBOX MODE: Ensure phone is a test number (e.g., 254708374149)');
  }

  const token = await getAccessToken();

  const timestamp = getTimestamp();
  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64'),
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

  console.log('STK Push Payload (without sensitive info):', {
    ...payload,
    Password: '[REDACTED]',
  });

  try {
    const res = await axios.post(STK_PUSH_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('STK Push initiated successfully:', res.data);
    return res.data;
  } catch (err) {
    console.error('STK Push Error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw new Error('STK Push failed: ' + (err.response?.data?.errorMessage || err.message));
  }
}

/** Generate timestamp in format YYYYMMDDHHMMSS */
function getTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}