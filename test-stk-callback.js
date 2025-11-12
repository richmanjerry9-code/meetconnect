// test-stk-callback.js
const fetch = require("node-fetch"); // install with: npm install node-fetch@2

async function simulateStkCallback() {
  const callbackPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: "TEST1234",
        CheckoutRequestID: "CHECKOUT5678",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 150 },
            { Name: "MpesaReceiptNumber", Value: "ABC123XYZ" },
            { Name: "PhoneNumber", Value: "254712345678" },
          ],
        },
      },
    },
  };

  try {
    const response = await fetch(
      "https://www.meetconnect.co.ke/api/mpesa/callback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callbackPayload),
      }
    );

    const data = await response.json();
    console.log("Callback Response:", data);
  } catch (err) {
    console.error("Error sending callback:", err);
  }
}

simulateStkCallback();
