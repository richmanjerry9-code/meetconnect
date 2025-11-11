import { db } from "../../lib/firebase";
import { doc, updateDoc, increment } from "firebase/firestore";

/**
 * Safaricom calls this endpoint after an STK Push completes.
 * You must add this URL in your Daraja app (production) as the callback.
 */
export default async function handler(req, res) {
  try {
    console.log("✅ M-PESA CALLBACK RECEIVED:", JSON.stringify(req.body, null, 2));

    // Safaricom sends data in this format:
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) {
      return res.status(400).json({ error: "Invalid callback data" });
    }

    const resultCode = callbackData.ResultCode;
    const resultDesc = callbackData.ResultDesc;
    const checkoutRequestID = callbackData.CheckoutRequestID;

    // Payment successful
    if (resultCode === 0) {
      const amount =
        callbackData.CallbackMetadata?.Item?.find((i) => i.Name === "Amount")?.Value || 0;
      const phone =
        callbackData.CallbackMetadata?.Item?.find((i) => i.Name === "PhoneNumber")?.Value || "";

      console.log(`✅ Payment Success | Amount: ${amount}, Phone: ${phone}`);

      // Optional: If you included userId/accountReference in STK push
      // You can look up which user this payment belongs to
      // Example: accountReference = userId
      const accountRef =
        callbackData.CallbackMetadata?.Item?.find((i) => i.Name === "AccountReference")?.Value ||
        "";

      // Update wallet balance in Firestore
      if (accountRef) {
        const userWalletRef = doc(db, "wallets", accountRef);
        await updateDoc(userWalletRef, {
          balance: increment(amount),
          lastPayment: new Date().toISOString(),
        });
      }

      return res.status(200).json({ message: "Payment processed successfully" });
    } else {
      console.warn("❌ Payment failed:", resultDesc);
      return res.status(200).json({ message: "Payment failed", resultDesc });
    }
  } catch (err) {
    console.error("Callback error:", err.message);
    res.status(500).json({ error: "Server error processing callback" });
  }
}