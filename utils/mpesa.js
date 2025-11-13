import fetch from "node-fetch";

export async function stkPush(phone, amount, accountRef, description) {
  try {
    // Generate access token
    const tokenRes = await fetch(`${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64')}`,
      },
    });

    const { access_token } = await tokenRes.json();

    // Timestamp and password
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

    // Ensure callback URL
    const callbackUrl = process.env.MPESA_CALLBACK_URL?.trim();
    if (!callbackUrl) throw new Error("MPESA_CALLBACK_URL is not set");

    // STK Push request
    const stkResponse = await fetch(`${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: callbackUrl, // ✅ production callback
        AccountReference: accountRef,
        TransactionDesc: description,
      }),
    });

    return await stkResponse.json();
  } catch (err) {
    console.error("STK Push Error:", err);
    throw err;
  }
}
