// pages/api/auth/check-admin.js
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps } from "firebase-admin/app";

if (!getApps().length === 0) {
  initializeApp();
}

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) return res.status(200).json({ isAdmin: false });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    // Replace with your actual admin UID
    const ADMIN_UID = "YOUR_ADMIN_USER_ID_HERE"; // ← PUT YOUR UID HERE

    res.status(200).json({ isAdmin: uid === ADMIN_UID });
  } catch (err) {
    res.status(200).json({ isAdmin: false });
  }
}