// pages/api/upgrade.js
import { initiateSTKPush } from '../../utils/mpesa';
import { db } from '../../lib/firebase.js';
import { doc, setDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    amount,
    phone,
    userId,
    level,
    duration,
    accountReference = 'MembershipUpgrade',
    transactionDesc = 'Upgrade Membership'
  } = req.body;

  if (!phone || !amount || !userId || !level) {
    return res.status(400).json({ error: 'Phone, amount, userId, and level are required' });
  }

  try {
    const checkoutRequestID = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Save pending upgrade transaction to Firestore
    await setDoc(doc(db, 'pendingTransactions', checkoutRequestID), {
      userId,
      amount: parseInt(amount, 10),
      phone,
      type: 'upgrade',
      level,
      duration,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Retry STK Push if system busy
    let stkResponse;
    let retries = 3;

    while (retries > 0) {
      try {
        stkResponse = await initiateSTKPush(
          parseInt(amount, 10),
          phone,
          accountReference,
          transactionDesc
        );
        break; // success
      } catch (err) {
        console.error('STK Push attempt failed:', err.response?.data || err.message);

        if (err.response?.data?.errorCode === '500.003.02') {
          console.log('M-PESA system busy, retrying in 5 seconds...');
          await new Promise(r => setTimeout(r, 5000));
          retries--;
        } else {
          throw err; // other errors, stop retrying
        }
      }
    }

    if (!stkResponse) {
      return res.status(500).json({ error: 'STK Push failed after multiple attempts' });
    }

    res.status(200).json({ checkoutRequestID, response: stkResponse });
  } catch (error) {
    console.error('Upgrade error:', error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.errorMessage || error.message || 'Unknown error',
    });
  }
}

