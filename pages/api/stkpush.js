import { adminDb } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

/** 1️⃣ GET M-PESA ACCESS TOKEN */
const getAccessToken = async () => {
  const { MPESA_CONSUMER_KEY: key, MPESA_CONSUMER_SECRET: secret } = process.env;

  if (!key || !secret) throw new Error('M-Pesa credentials not configured.');

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );

  if (!res.ok) throw new Error('Failed to get access token.');

  const data = await res.json();
  return data.access_token;
};

/** 2️⃣ INITIATE STK PUSH */
const initiateStkPush = async (phone, amount, transactionDesc) => {
  const token = await getAccessToken();

  const { MPESA_SHORTCODE: businessShortCode, MPESA_TILL: tillNumber, MPESA_PASSKEY: passkey, MPESA_CALLBACK_URL: callbackUrl } = process.env;

  if (!businessShortCode || !tillNumber || !passkey || !callbackUrl)
    throw new Error('M-Pesa configuration missing.');

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');

  const body = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerBuyGoodsOnline',
    Amount: parseInt(amount, 10),
    PartyA: phone,
    PartyB: tillNumber,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: 'MeetConnect',
    TransactionDesc: transactionDesc,
  };

  console.log('🔹 STK Push Body:', body);

  const res = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log('🔹 STK Push Response:', data);

  if (!res.ok) throw new Error(data.errorMessage || 'Failed to initiate STK Push.');

  return data;
};

/** 3️⃣ FORMAT PHONE NUMBER */
const formatPhoneForMpesa = (phone) => {
  if (!phone) throw new Error('Phone number is required');

  let formatted = phone.replace(/[^\d]/g, '');
  if (formatted.startsWith('0')) formatted = '254' + formatted.slice(1);
  else if (formatted.startsWith('254')) formatted = formatted;
  else if (formatted.length === 9 && formatted.startsWith('7')) formatted = '254' + formatted;
  else throw new Error('Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX');

  if (!/^2547\d{8}$/.test(formatted))
    throw new Error('Invalid M-Pesa phone number. Must be a valid Kenyan mobile number.');

  return formatted;
};

/** 4️⃣ API HANDLER */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, amount, userId, type, level, duration, transactionDesc } = req.body;

  if (!phone || !amount || !userId || !type || !transactionDesc)
    return res.status(400).json({ error: 'Missing required fields' });

  if (type === 'upgrade' && (!level || !duration))
    return res.status(400).json({ error: 'Missing upgrade fields' });

  try {
    const formattedPhone = formatPhoneForMpesa(phone);
    const stkRes = await initiateStkPush(formattedPhone, amount, transactionDesc);

    if (stkRes.ResponseCode !== '0') {
      return res.status(400).json({ error: stkRes.ResponseDescription || 'Failed to initiate STK Push' });
    }

    const checkoutRequestID = stkRes.CheckoutRequestID;

    const pendingData = {
      userId,
      type,
      amount: parseInt(amount, 10),
      phone: formattedPhone,
      status: 'pending',
      createdAt: Timestamp.now(),
      transactionDesc,
      ...(type === 'upgrade' ? { level, duration } : {}),
    };

    await adminDb.collection('pendingPayments').doc(checkoutRequestID).set(pendingData);

    return res.status(200).json({
      message: 'STK Push initiated successfully',
      checkoutRequestID,
    });
  } catch (err) {
    console.error('🔥 STK Push Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
