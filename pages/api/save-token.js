import { getFirestore, doc, setDoc } from 'firebase-admin/firestore';
import admin from 'firebase-admin'; // Initialize admin SDK (use service account key)

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.body;
  const authHeader = req.headers.authorization?.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader);
    const db = getFirestore();
    await setDoc(doc(db, 'users', decoded.uid), { fcmToken: token }, { merge: true }); // Or use a tokens subcollection
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save token' });
  }
}