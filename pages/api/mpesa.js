import axios from 'axios';

const OAUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const STK_PUSH_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

/**
 * Format any phone number to 2547XXXXXXXX
 */
function formatPhone(phone) {
  let p = phone.replace(/\s+/g, ''); // remove spaces
  if (p.startsWith('0')) return '254' + p.slice(1);
  if (p.startsWith('+254')) return '254' + p.slice(4);
  if (p.startsWith('254')) return p;
  throw new Error('Invalid phone number. Use 07xxxxxxx, 01xxxxxxx, or +2547xxxxxxx');
}

export async function initiateSTKPush({ phone, amount, accountReference, transactionDesc }) {
  if (!phone || !amount) throw new Error('Phone and amount are required');

  const formattedPhone = formatPhone(phone);

  try {
    // Get OAuth token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const tokenRes = await axios.get(OAUTH_URL, { headers: { Authorization: `Basic ${auth}` } });
    const accessToken = tokenRes.data.access_token;

    // Prepare STK Push payload
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const shortCode = process.env.MPESA_SHORTCODE || '174379'; // sandbox
    const passkey = process.env.MPESA_PASSKEY || '';
    const password = Buffer.from(shortCode + passkey + timestamp).toString('base64');

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Number(amount),
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: accountReference || 'Ref001',
      TransactionDesc: transactionDesc || 'Payment',
    };

    const res = await axios.post(STK_PUSH_URL, payload, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return res.data;
  } catch (err) {
    console.error('STK Push Error:', err.response?.data || err.message);
    throw new Error('STK Push failed');
  }
}

