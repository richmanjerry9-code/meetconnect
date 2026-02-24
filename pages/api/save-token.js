import { getFirestore, doc, setDoc } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.body;
  const authHeader = req.headers.authorization?.split('Bearer ')[1];

  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader);
    const db = getFirestore();
    await setDoc(doc(db, 'profiles', decoded.uid), { fcmToken: token }, { merge: true }); // Changed to 'profiles' to match your earlier code
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save token' });
  }
}