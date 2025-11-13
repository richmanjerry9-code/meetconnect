// pages/api/mpesa/callback.js
export const config = {
  api: {
    bodyParser: true, // ensure JSON is parsed
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const callbackData = req.body;
    console.log("📩 M-PESA Callback Received:", JSON.stringify(callbackData, null, 2));

    const stkCallback = callbackData?.Body?.stkCallback;
    if (!stkCallback) {
      return res.status(400).json({ message: "Invalid callback format" });
    }

    const { ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    if (ResultCode === 0) {
      const amount = CallbackMetadata?.Item?.find(i => i.Name === "Amount")?.Value;
      const phone = CallbackMetadata?.Item?.find(i => i.Name === "PhoneNumber")?.Value;
      const receipt = CallbackMetadata?.Item?.find(i => i.Name === "MpesaReceiptNumber")?.Value;

      console.log(`✅ Payment Success — Amount: ${amount}, Phone: ${phone}, Receipt: ${receipt}`);
      // TODO: update your DB or mark upgrade complete
    } else {
      console.log(`❌ Payment Failed: ${ResultCode} — ${ResultDesc}`);
    }

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Received successfully",
    });
  } catch (error) {
    console.error("Callback error:", error.message);
    return res.status(500).json({ message: "Server Error" });
  }
}


