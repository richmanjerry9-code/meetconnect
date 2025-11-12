// pages/api/mpesa/callback.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const callbackData = req.body;

    // You can log for debugging
    console.log('M-Pesa Callback Data:', callbackData);

    // Example: handle success/failure
    const stkCallback = callbackData.Body?.stkCallback;
    if (stkCallback) {
      const { ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

      if (ResultCode === 0 && CallbackMetadata) {
        const items = CallbackMetadata.Item;
        let amount, mpesaReceiptNumber, phoneNumber, transactionDate;

        items.forEach((item) => {
          if (item.Name === 'Amount') amount = item.Value;
          else if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
          else if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
          else if (item.Name === 'TransactionDate') transactionDate = item.Value;
        });

        // TODO: Update your database with this info
        console.log(`Payment successful: ${amount} from ${phoneNumber}`);
      } else {
        console.log(`Payment failed: ${ResultDesc}`);
      }
    }

    // Respond to M-Pesa
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback processed successfully' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
}

