// pages/api/mpesa/callback.js
import { db } from '../../../lib/firebase'; // correct relative path
import { collection, addDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("📞 M-Pesa Callback Received:", JSON.stringify(body, null, 2));

    const stk = body?.Body?.stkCallback;
    if (!stk) return res.status(400).json({ error: "Invalid callback format" });

    const resultCode = stk.ResultCode;
    const resultDesc = stk.ResultDesc;
    const checkoutId = stk.CheckoutRequestID;
    const merchantRequestId = stk.MerchantRequestID;
    const amount = stk.CallbackMetadata?.Item?.find(i => i.Name === "Amount")?.Value || null;
    const phone = stk.CallbackMetadata?.Item?.find(i => i.Name === "PhoneNumber")?.Value || null;
    const mpesaCode = stk.CallbackMetadata?.Item?.find(i => i.Name === "MpesaReceiptNumber")?.Value || null;
    const date = new Date().toISOString();

    await addDoc(collection(db, "mpesa_payments"), {
      resultCode,
      resultDesc,
      checkoutId,
      merchantRequestId,
      amount,
      phone,
      mpesaCode,
      date,
    });

    console.log("✅ Payment saved successfully.");
    res.status(200).json({ message: "Callback processed successfully" });
  } catch (error) {
    console.error("❌ Error saving payment:", error);
    res.status(500).json({ error: "Server error" });
  }
}


