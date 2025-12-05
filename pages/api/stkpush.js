import { adminDb } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// 1️⃣ M-PESA ACCESS TOKEN
const getAccessToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials not configured.');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await fetch(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );

  if (!res.ok) throw new Error('Failed to get access token.');
  const data = await res.json();
  return data.access_token;
};

// 2️⃣ INITIATE STK PUSH
const initiateStkPush = async (phone, amount, transactionDesc) => {
  const token = await getAccessToken();
  const businessShortCode = process.env.MPESA_SHORTCODE; // Head office shortcode (e.g., '3574457')
  const tillNumber = process.env.MPESA_TILL; // Till number for PartyB (e.g., '6679416' if valid)
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!businessShortCode || !tillNumber || !passkey || !callbackUrl) {
    throw new Error('M-Pesa configuration missing.');
  }

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');

  const body = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerBuyGoodsOnline',
    Amount: parseInt(amount),
    PartyA: phone,
    PartyB: tillNumber, // Till number here
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: 'MeetConnect', // Optional: Use a string like store ref or till for tracking
    TransactionDesc: transactionDesc,
  };

  console.log('🔹 STK Push Body:', body);

  const res = await fetch(
    'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );

  const responseData = await res.json();
  console.log('🔹 STK Push Response:', responseData);

  if (!res.ok) {
    throw new Error(responseData.errorMessage || 'Failed to initiate STK Push.');
  }

  return responseData;
};

// 3️⃣ FORMAT PHONE NUMBER
const formatPhoneForMpesa = (phone) => {
  if (!phone) throw new Error('Phone number is required');
  let formatted = phone.replace(/[^\d]/g, '');
  if (formatted.startsWith('0')) formatted = '254' + formatted.slice(1);
  else if (formatted.startsWith('254')) formatted = formatted;
  else if (formatted.length === 9 && formatted.startsWith('7')) formatted = '254' + formatted;
  else throw new Error('Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX');

  if (formatted.length !== 12 || !formatted.startsWith('2547'))
    throw new Error('Invalid M-Pesa phone number. Must be a valid Kenyan mobile number.');

  return formatted;
};

// 4️⃣ MAIN API HANDLER
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

    if (stkRes.ResponseCode === '0') {
      const checkoutRequestID = stkRes.CheckoutRequestID;

      const pendingData = {
        userId,
        type,
        amount: parseInt(amount),
        phone: formattedPhone,
        status: 'pending',
        createdAt: Timestamp.now(),
        transactionDesc,
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
    } else {
      return res
        .status(400)
        .json({ error: stkRes.ResponseDescription || 'Failed to initiate STK Push' });
    }
  } catch (err) {
    console.error('🔥 STK Push Error:', err);
    return res.status(500).json({ error: err.message });
  }
}



