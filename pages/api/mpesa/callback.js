// pages/api/mpesa-callback.js
import { NextResponse } from "next/server";

/**
 * This endpoint receives M-PESA payment confirmation
 * from the STK push (live environment)
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method Not Allowed" });
    }

    const callbackData = req.body;

    // Log the callback for debugging
    console.log("M-PESA Callback Received:", JSON.stringify(callbackData, null, 2));

    // The payment result is inside callbackData.Body.stkCallback
    const stkCallback = callbackData?.Body?.stkCallback;

    if (!stkCallback) {
      return res.status(400).json({ message: "Invalid callback format" });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    // ✅ ResultCode === 0 means success
    if (ResultCode === 0) {
      // Extract payment info if needed
      const amount = CallbackMetadata?.Item?.find(item => item.Name === "Amount")?.Value;
      const phone = CallbackMetadata?.Item?.find(item => item.Name === "PhoneNumber")?.Value;
      const mpesaReceipt = CallbackMetadata?.Item?.find(item => item.Name === "MpesaReceiptNumber")?.Value;

      console.log(`Payment Success! Amount: ${amount}, Phone: ${phone}, Receipt: ${mpesaReceipt}`);

      // TODO: Update database or mark user upgraded
      // e.g., await db.user.update({ isUpgraded: true, paymentDetails: {...} })

    } else {
      console.log(`Payment Failed: ${ResultCode} - ${ResultDesc}`);
      // TODO: Handle failed transaction logic
    }

    // Respond to Safaricom immediately
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Received successfully" });

  } catch (error) {
    console.error("Callback Error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
}

