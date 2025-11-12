import axios from "axios";
import dayjs from "dayjs";
import base64 from "base-64";

// Generate password for STK Push
function generatePassword(shortcode, passkey) {
  const timestamp = dayjs().format("YYYYMMDDHHmmss");
  const str = `${shortcode}${passkey}${timestamp}`;
  return base64.encode(str);
}

// Get M-PESA access token
async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  // Use production URL for live
  const url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  const response = await axios.get(url, {
    auth: { username: consumerKey, password: consumerSecret },
  });

  return response.data.access_token;
}

// Trigger STK Push
async function stkPush({ phone, amount, accountReference, transactionDesc }) {
  const accessToken = await getAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const timestamp = dayjs().format("YYYYMMDDHHmmss");
  const password = generatePassword(shortcode, passkey);

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: "https://meetconnect.co.ke/api/mpesacallback", // Must be HTTPS and public
    AccountReference: accountReference || "CompanyPayment",
    TransactionDesc: transactionDesc || "Payment",
  };

  // Production STK Push URL
  const stkUrl = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

  const response = await axios.post(stkUrl, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return response.data;
}

// API route handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, amount, accountReference, transactionDesc } = req.body;

  try {
    const result = await stkPush({ phone, amount, accountReference, transactionDesc });
    res.status(200).json(result);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
}
