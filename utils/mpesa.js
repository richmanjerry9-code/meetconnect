import fetch from "node-fetch";

export async function stkPush(customerPhone, amount, accountRef, description) {
  try {
    // Required environment variables
    const requiredEnvVars = {
      MPESA_BASE_URL: process.env.MPESA_BASE_URL,
      MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
      MPESA_SHORTCODE: process.env.MPESA_SHORTCODE, // <-- Your PayBill/till number
      MPESA_PASSKEY: process.env.MPESA_PASSKEY,
      MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL,
    };

    const missingVar = Object.entries(requiredEnvVars).find(([key, value]) => !value);
    if (missingVar) throw new Error(`Missing required env var: ${missingVar[0]}`);

    // Validate base URL
    const baseUrl = new URL(requiredEnvVars.MPESA_BASE_URL);

    // Get access token
    const tokenUrl = new URL("/oauth/v1/generate", baseUrl);
    tokenUrl.searchParams.append("grant_type", "client_credentials");

    const tokenRes = await fetch(tokenUrl.toString(), {
      headers: {
        Authorization: `Basic ${Buffer.from(`${requiredEnvVars.MPESA_CONSUMER_KEY}:${requiredEnvVars.MPESA_CONSUMER_SECRET}`).toString('base64')}`,
      },
    });

    if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status} ${tokenRes.statusText}`);
    const { access_token } = await tokenRes.json();
    if (!access_token) throw new Error("No access_token in response");

    // Timestamp and password
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const password = Buffer.from(`${requiredEnvVars.MPESA_SHORTCODE}${requiredEnvVars.MPESA_PASSKEY}${timestamp}`).toString('base64');

    // STK Push request
    const stkUrl = new URL("/mpesa/stkpush/v1/processrequest", baseUrl);
    const stkResponse = await fetch(stkUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: requiredEnvVars.MPESA_SHORTCODE, // <-- Your till/PayBill number
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: customerPhone,           // <-- MUST be the customer's phone number
        PartyB: requiredEnvVars.MPESA_SHORTCODE, // <-- Your till/PayBill
        PhoneNumber: customerPhone,      // <-- Same as PartyA
        CallBackURL: requiredEnvVars.MPESA_CALLBACK_URL.trim(),
        AccountReference: accountRef,
        TransactionDesc: description,
      }),
    });

    if (!stkResponse.ok) {
      const errorBody = await stkResponse.text();
      throw new Error(`STK Push failed: ${stkResponse.status} ${stkResponse.statusText} - ${errorBody}`);
    }

    return await stkResponse.json();
  } catch (err) {
    console.error("STK Push Error:", err);
    throw err; // Let caller handle it
  }
}
