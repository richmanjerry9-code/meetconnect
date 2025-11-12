// pages/api/mpesa/callback.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const callbackData = req.body;

    // Log callback for debugging (you can also save to DB)
    console.log('M-Pesa Callback:', callbackData);

    // Extract STK callback info if available
    const stkCallback = callbackData?.Body?.stkCallback;
    if (stkCallback) {
      const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

      if (ResultCode === 0 && CallbackMetadata) {
        const metadata = {};
        CallbackMetadata.Item.forEach(item => {
          metadata[item.Name] = item.Value;
        });
        console.log('Payment Successful:', metadata);
        // Update your DB with payment info here
      } else {
        console.log('Payment Failed:', ResultDesc);
      }
    }

    // Send success response back to Safaricom
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback processed successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
}
