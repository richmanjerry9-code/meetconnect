// pages/api/mpesa/mpesaAuth.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const response = await fetch(
      `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const data = await response.json();
    return res.status(200).json({ token: data.access_token, expires_in: data.expires_in });
  } catch (err) {
    console.error("Auth Error:", err);
    return res.status(500).json({ message: "Failed to get access token", error: err.message });
  }
}


