import axios from 'axios';

const { CONSUMER_KEY, CONSUMER_SECRET, SHORTCODE, PASSKEY, CALLBACK_URL } = process.env;

const OAUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const STK_PUSH_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

/**
 * Format phone number for Daraja sandbox.
 * Acceptable formats: 07XXXXXXXX or +2547XXXXXXXX
 */
export function formatPhone(phone) {
  if (!phone) throw new Error('Phone number is required');

  let p = phone.toString().trim();
  p = p.replace(/[\s-]/g, ''); // remove spaces/dashes

  if (/^\+2547\d{8}$/.test(p)) return p;   // +2547XXXXXXXX
  if (/^07\d{8}$/.test(p)) return p;       // 07XXXXXXXX

  throw new Error('Invalid phone number. Use 07XXXXXXXX or +2547XXXXXXXX format.');
}

/**
 * Get OAuth access token from Daraja
 */
async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  const response = await axios.get(OAUTH_URL, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.data?.access_token) {
    throw new Error('Failed to get access token');
  }
  return response.data.access_token;
}

/**
 * Initiate STK Push
 * @param {Object} options
 * @param {string} options.phone - 07XXXXXXXX or +2547XXXXXXXX
 * @param {number} options.amount
 * @param {string} options.accountReference
 * @param {string} options.transactionDesc
 */
export async function initiateSTKPush({ phone, amount, accountReference, transactionDesc }) {
  if (!phone || !amount) throw new Error('Phone and amount are required');

  const formattedPhone = formatPhone(phone);
  const token = await getAccessToken();

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: Buffer.from(`${SHORTCODE}${PASSKEY}${getTimestamp()}`).toString('base64'),
    Timestamp: getTimestamp(),
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: formattedPhone,
    PartyB: SHORTCODE,
    PhoneNumber: formattedPhone,
    CallBackURL: CALLBACK_URL,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    const res = await axios.post(STK_PUSH_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  } catch (err) {
    console.error('STK Push Error:', err.response?.data || err.message);
    throw new Error('STK Push failed');
  }
}

/**
 * Generate timestamp in format YYYYMMDDHHMMSS
 */
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




