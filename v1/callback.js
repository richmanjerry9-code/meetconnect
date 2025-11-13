import fs from 'fs';

export default async function handler(req, res) {
  try {
    const callbackData = req.body;
    const log = `${new Date().toISOString()} - ${JSON.stringify(callbackData)}\n`;
    fs.appendFileSync('mpesa_callback.log', log);

    const data = callbackData?.Body?.stkCallback;

    if (data) {
      const merchantRequestID = data.MerchantRequestID || '';
      const checkoutRequestID = data.CheckoutRequestID || '';
      const resultCode = data.ResultCode || '';
      const resultDesc = data.ResultDesc || '';

      fs.appendFileSync(
        'mpesa_results.log',
        `${new Date().toISOString()} - MerchantRequestID: ${merchantRequestID}, CheckoutRequestID: ${checkoutRequestID}, ResultCode: ${resultCode}, ResultDesc: ${resultDesc}\n`
      );

      if (resultCode === 0) {
        const metadata = data.CallbackMetadata?.Item || [];
        const details = {};
        metadata.forEach(item => {
          details[item.Name] = item.Value;
        });

        fs.appendFileSync(
          'successful_transactions.log',
          `${new Date().toISOString()} - Success: Amount: ${details.Amount}, Receipt: ${details.MpesaReceiptNumber}, Date: ${details.TransactionDate}, Phone: ${details.PhoneNumber}\n`
        );
      } else {
        fs.appendFileSync(
          'failed_transactions.log',
          `${new Date().toISOString()} - Failed: ${resultDesc}\n`
        );
      }
    } else {
      fs.appendFileSync('mpesa_errors.log', `${new Date().toISOString()} - Invalid callback data\n`);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback processed successfully' });
  } catch (error) {
    fs.appendFileSync('mpesa_errors.log', `${new Date().toISOString()} - ${error.message}\n`);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Server error' });
  }
}

