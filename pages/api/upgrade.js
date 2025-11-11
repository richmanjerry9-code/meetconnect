// pages/api/upgrade.js
import { stkPush } from "./utils/mpesa";
import { db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { phone, amount, userId, level, duration, accountReference, transactionDesc } = req.body;
  if (!phone || !amount || !userId || !level || !duration)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    const data = await stkPush({
      phone,
      amount,
      accountReference,
      transactionDesc,
      callbackUrl: process.env.MPESA_CALLBACK_URL,
    });

    // Pre-store a pending upgrade record
    await setDoc(
      doc(db, "pendingUpgrades", userId),
      { userId, level, duration, amount, status: "pending", checkoutRequestId: data.CheckoutRequestID },
      { merge: true }
    );

    res.status(200).json(data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "STK push failed" });
  }
}
