// /api/withdraw.js
import { adminDb } from '../../lib/firebaseAdmin';
import axios from 'axios';
const crypto = require('crypto');

const BASE_URL = 'https://api.safaricom.co.ke'; // Production

// Function to generate SecurityCredential (encrypt password with public key)
const generateSecurityCredential = (plainPassword, publicKey) => {
  const buffer = Buffer.from(plainPassword);
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    buffer
  );
  return encrypted.toString('base64');
};

async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const res = await axios.get(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return res.data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { userId, amount, phoneNumber } = req.body; // userId is creatorId

  if (!userId || !amount || !phoneNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const parsedAmount = parseInt(amount);
  if (parsedAmount < 10 || parsedAmount > 250000) {
    return res.status(400).json({ error: 'Amount must be between 10 and 250,000 KSh' });
  }

  try {
    // Check creator's earningsBalance
    const creatorRef = adminDb.collection('profiles').doc(userId);
    const creatorSnap = await creatorRef.get();
    if (!creatorSnap.exists || creatorSnap.data().earningsBalance < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient earnings balance' });
    }

    const token = await getAccessToken();
    const initiatorName = process.env.MPESA_INITIATOR_NAME;
    const initiatorPassword = process.env.MPESA_INITIATOR_PASSWORD; // Plaintext
    const publicKey = process.env.MPESA_PUBLIC_KEY;
    const securityCredential = generateSecurityCredential(initiatorPassword, publicKey);

    const commandID = 'BusinessPayment'; // Or SalaryPayment/PromotionPayment
    const shortcode = process.env.MPESA_SHORTCODE;
    const queueTimeoutURL = process.env.MPESA_QUEUE_TIMEOUT_URL;
    const resultURL = process.env.MPESA_RESULT_URL;

    const payload = {
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: commandID,
      Amount: parsedAmount,
      PartyA: shortcode,
      PartyB: phoneNumber, // Format: 2547XXXXXXXX
      Remarks: 'Creator Withdrawal',
      QueueTimeOutURL: queueTimeoutURL,
      ResultURL: resultURL,
      Occassion: 'Earnings Payout', // Optional
    };

    const b2cRes = await axios.post(`${BASE_URL}/mpesa/b2c/v3/paymentrequest`, payload, { // Use v3 per your docs
      headers: { Authorization: `Bearer ${token}` },
    });

    // Store pending withdrawal
    const conversationID = b2cRes.data.ConversationID; // Use this as doc ID (diff from STK CheckoutRequestID)
    await adminDb.collection('pendingWithdrawals').doc(conversationID).set({
      userId,
      amount: parsedAmount,
      phoneNumber,
      status: 'pending',
      createdAt: new Date(),
      originatorConversationID: b2cRes.data.OriginatorConversationID,
    });

    res.status(200).json({ success: true, message: 'Withdrawal initiated', conversationID });
  } catch (err) {
    console.error('B2C Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to initiate withdrawal' });
  }
}