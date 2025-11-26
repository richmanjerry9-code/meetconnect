// /api/withdraw.js example
import { adminDb } from '../../lib/firebaseAdmin';
import axios from 'axios';

const BASE_URL = 'https://api.safaricom.co.ke'; // Production

async function getAccessToken() {
  // Same as before
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { userId, amount, phoneNumber } = req.body;

  try {
    const token = await getAccessToken();
    const initiatorName = process.env.MPESA_INITIATOR_NAME;
    const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL; // Encrypted password
    const commandID = 'BusinessPayment'; // Or SalaryPayment, etc.
    const shortcode = process.env.MPESA_SHORTCODE;
    const queueTimeoutURL = process.env.MPESA_QUEUE_TIMEOUT_URL; // Your URL
    const resultURL = process.env.MPESA_RESULT_URL; // Your callback for B2C

    const payload = {
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: commandID,
      Amount: amount,
      PartyA: shortcode,
      PartyB: phoneNumber,
      Remarks: 'Withdrawal',
      QueueTimeOutURL: queueTimeoutURL,
      ResultURL: resultURL,
      AccountReference: 'Withdrawal',
    };

    const b2cRes = await axios.post(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Store pending withdrawal if needed, similar to pendingPayments
    await adminDb.collection('pendingWithdrawals').doc(b2cRes.data.ConversationID).set({
      userId,
      amount,
      phoneNumber,
      status: 'pending',
      createdAt: new Date(),
    });

    res.status(200).json({ success: true, message: 'Withdrawal initiated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}