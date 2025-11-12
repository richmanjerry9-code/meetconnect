// pages/api/mpesa/callback.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const data = req.body;
    console.log('M-Pesa Callback Received:', JSON.stringify(data, null, 2));

    const callbackData = data?.Body?.stkCallback;
    if (!callbackData) return res.status(400).json({ error: 'Invalid callback data' });

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

    if (ResultCode === 0 && CallbackMetadata) {
      const items = CallbackMetadata.Item;
      const amount = items.find(i => i.Name === 'Amount')?.Value;
      const phone = items.find(i => i.Name === 'PhoneNumber')?.Value;
      const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = items.find(i => i.Name === 'TransactionDate')?.Value;

      console.log('Payment successful:', { amount, phone, receipt, transactionDate });

      // TODO: update DB with successful payment
    } else {
      console.log('Payment failed:', { ResultCode, ResultDesc });
    }

    // Respond to Safaricom to acknowledge
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback processed successfully' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
}
