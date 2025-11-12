import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { phone, amount, accountReference, transactionDesc, userId } = req.body;

    // Validate
    if (!phone || !amount || !accountReference) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Your M-Pesa credentials
    const shortcode = process.env.MPESA_SHORTCODE; // e.g. 174379
    const passkey = process.env.MPESA_PASSKEY;
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const callbackUrl = `${process.env.BASE_URL}/api/mpesaCallback`;

    // 1️⃣ Get access token
    const tokenResp = await axios.get(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        auth: { username: consumerKey, password: consumerSecret },
      }
    );
    const access_token = tokenResp.data.access_token;

    // 2️⃣ Generate timestamp & password
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    // 3️⃣ Format phone
    let partyA = phone.replace(/[^0-9]/g, "");
    if (partyA.startsWith("0")) partyA = "254" + partyA.slice(1);
    if (!partyA.startsWith("254")) partyA = "254" + partyA;

    // 4️⃣ Make STK push request
    const stkRes = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Number(amount),
        PartyA: partyA,
        PartyB: shortcode,
        PhoneNumber: partyA,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc || "Wallet Top-up",
      },
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    return res.status(200).json({
      message: "STK Push initiated",
      data: stkRes.data,
    });
  } catch (error) {
    console.error("STK PUSH ERROR:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Failed to initiate STK push",
      details: error.response?.data || error.message,
    });
  }
}

