import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const plans = {
  Prime: { '7 Days': 300, '15 Days': 600, '30 Days': 1000 },
  VIP:   { '7 Days': 600, '15 Days': 1200, '30 Days': 2000 },
  VVIP:  { '7 Days': 900, '15 Days': 1500, '30 Days': 3000 },
};

const daysMap = { '7 Days': 7, '15 Days': 15, '30 Days': 30 };
const tierDailyRates = { Prime: 42.86, VIP: 85.71, VVIP: 128.57 };
const tierLevels = { Prime: 1, VIP: 2, VVIP: 3 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { level, duration } = req.body;
  if (!level || !duration || !plans[level]?.[duration]) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const uid = decoded.uid;
  const db = getFirestore();
  const snap = await db.doc(`profiles/${uid}`).get();
  const profile = snap.data() || {};

  const fullPrice = plans[level][duration];
  let credit = 0;
  let remainingDays = 0;
  let willExtend = false;

  const currentTier = profile.membership || 'Regular';
  const now = Date.now();

  if (profile.membershipExpiresAt) {
    const expires = profile.membershipExpiresAt.toDate
      ? profile.membershipExpiresAt.toDate()
      : new Date(profile.membershipExpiresAt);

    remainingDays = Math.max(0, Math.floor((expires - now) / 86400000));

    if (remainingDays > 0 && tierLevels[currentTier] === tierLevels[level]) {
      willExtend = true;
    } else if (remainingDays > 0 && tierLevels[level] > tierLevels[currentTier]) {
      credit = Math.round(remainingDays * (tierDailyRates[currentTier] || 42.86));
    }
  }

  const effectivePrice = Math.max(0, fullPrice - credit);

  res.json({
    effectivePrice,
    credit,
    remainingDays,
    fullPrice,
    willExtend,
    currentTier,
  });
}