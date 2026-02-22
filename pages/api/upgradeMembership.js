// pages/api/upgradeMembership.js (or app/api/upgradeMembership/route.js for app router)

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = getAuth();
const db = getFirestore();

const plans = {
  Prime: { '7 Days': 300, '15 Days': 600, '30 Days': 1000 },
  VIP: { '7 Days': 600, '15 Days': 1200, '30 Days': 2000 },     // ← 3 Days removed
  VVIP: { '7 Days': 900, '15 Days': 1500, '30 Days': 3000 },    // ← 3 Days removed
};

const daysMap = { '7 Days': 7, '15 Days': 15, '30 Days': 30 };   // ← 3 Days removed here too

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { level, duration } = req.body;

  if (!level || !duration || !plans[level] || !plans[level][duration]) {
    return res.status(400).json({ error: 'Invalid level or duration' });
  }

  // Verify auth token
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No auth token' });
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decoded.uid;
  const profileRef = db.doc(`profiles/${userId}`);
  const snap = await profileRef.get();

  if (!snap.exists) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const profile = snap.data();
  const price = plans[level][duration];

  if (profile.fundingBalance < price) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const days = daysMap[duration] || 0;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  let updates = {
    fundingBalance: profile.fundingBalance - price,
    membership: level,
    membershipExpiresAt: Timestamp.fromDate(expiresAt),
  };

  if (!profile.activationPaid) {
    updates.hidden = false;
    updates.activationPaid = true;
    updates.regularLifetime = true;
  }

  await profileRef.update(updates);

  res.status(200).json({ success: true });
}