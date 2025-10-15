// pages/api/mpesa/validation.js
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  console.log("Validation request:", req.body);

  // Always accept payments unless you want to reject invalid ones
  const response = {
    ResultCode: "0",
    ResultDesc: "Accepted",
  };

  res.status(200).json(response);
}
