




// pages/api/stkpush.js   (or app/api/stkpush/route.js if using App Router)
import { adminDb } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// 1️⃣ Get M-Pesa Access Token
const getAccessToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials not configured.');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const res = await fetch(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  if (!res.ok) throw new Error('Failed to get M-Pesa access token.');
  const data = await res.json();
  return data.access_token;
};

// 2️⃣ Initiate STK Push
const initiateStkPush = async (phone, amount, transactionDesc, accountReference) => {
  const token = await getAccessToken();

  const businessShortCode = process.env.MPESA_SHORTCODE;
  const tillNumber = process.env.MPESA_TILL;        // PartyB = Till Number
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!businessShortCode || !tillNumber || !passkey || !callbackUrl) {
    throw new Error('Missing M-Pesa configuration (shortcode, till, passkey, or callback URL).');
  }

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');

  const body = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerBuyGoodsOnline',   // Correct for Till payments
    Amount: parseInt(amount),
    PartyA: phone,
    PartyB: tillNumber,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference || 'MeetConnect',
    TransactionDesc: transactionDesc || 'Payment',
  };

  console.log('🔹 STK Push Request Body:', body);

  const res = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log('🔹 STK Push Response:', data);

  if (!res.ok || data.ResponseCode !== '0') {
    throw new Error(data.errorMessage || data.ResponseDescription || 'Failed to initiate STK Push');
  }

  return data;
};

// 3️⃣ Format Phone
const formatPhoneForMpesa = (phone) => {
  if (!phone) throw new Error('Phone number is required');

  let formatted = phone.replace(/[^\d]/g, '');

  if (formatted.startsWith('0')) formatted = '254' + formatted.slice(1);
  else if (formatted.length === 9 && formatted.startsWith('7')) formatted = '254' + formatted;
  else if (formatted.startsWith('254')) formatted = formatted;

  if (formatted.length !== 12 || !formatted.startsWith('2547')) {
    throw new Error('Invalid M-Pesa phone number. Use 07XXXXXXXX format.');
  }

  return formatted;
};

// 4️⃣ Main Handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, amount, userId, type, level, duration, transactionDesc } = req.body;

  if (!phone || !amount || !userId || !type || !transactionDesc) {
    return res.status(400).json({ error: 'Missing required fields: phone, amount, userId, type, transactionDesc' });
  }

  if (type === 'upgrade' && (!level || !duration)) {
    return res.status(400).json({ error: 'Missing upgrade fields (level or duration)' });
  }

  try {
    const formattedPhone = formatPhoneForMpesa(phone);

    // Make AccountReference unique for easier tracking
    const accountReference = `${type}_${userId.slice(-8)}_${Date.now()}`;

    const stkRes = await initiateStkPush(
      formattedPhone,
      amount,
      transactionDesc,
      accountReference
    );

    const checkoutRequestID = stkRes.CheckoutRequestID;

    // Save pending payment
    const pendingData = {
      userId,
      type,
      amount: parseInt(amount),
      phone: formattedPhone,
      status: 'pending',
      createdAt: Timestamp.now(),
      transactionDesc,
      accountReference,
    };

    if (type === 'upgrade') {
      pendingData.level = level;
      pendingData.duration = duration;
    }

    await adminDb.collection('pendingPayments').doc(checkoutRequestID).set(pendingData);

    return res.status(200).json({
      message: 'STK Push initiated successfully',
      checkoutRequestID,
    });
  } catch (err) {
    console.error('🔥 STK Push Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}