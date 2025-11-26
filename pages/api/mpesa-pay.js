import { adminDb } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// 1️⃣ M-PESA ACCESS TOKEN (same as stkpush.js)
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

// 2️⃣ INITIATE STK PUSH (same as stkpush.js)
const initiateStkPush = async (phone, amount, transactionDesc) => {
  const token = await getAccessToken();
  const businessShortCode = process.env.MPESA_SHORTCODE;
  const tillNumber = process.env.MPESA_TILL;
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
    PartyB: tillNumber,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: 'MeetConnect',
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

// 3️⃣ FORMAT PHONE NUMBER (same as stkpush.js)
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

// Helper to shorten IDs (same as in profilesetup.js)
const shortenUserId = (userId) => userId ? userId.slice(-10) : '';

// 4️⃣ MAIN API HANDLER
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phoneNumber, amount, userId, creatorId, durationDays } = req.body;

  if (!phoneNumber || !amount || !userId || !creatorId || !durationDays)
    return res.status(400).json({ error: 'Missing required fields' });

  const type = 'subscription'; // Fixed type for this endpoint
  const transactionDesc = `Exclusive subscription for ${durationDays} days`;

  try {
    const formattedPhone = formatPhoneForMpesa(phoneNumber);
    const stkRes = await initiateStkPush(formattedPhone, amount, transactionDesc);

    if (stkRes.ResponseCode === '0') {
      const checkoutRequestID = stkRes.CheckoutRequestID;

      const pendingData = {
        userId,
        creatorId,
        type,
        amount: parseInt(amount),
        durationDays: parseInt(durationDays),
        phone: formattedPhone,
        status: 'pending',
        createdAt: Timestamp.now(),
        transactionDesc,
      };

      await adminDb.collection('pendingPayments').doc(checkoutRequestID).set(pendingData);

      return res.status(200).json({
        success: true,
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