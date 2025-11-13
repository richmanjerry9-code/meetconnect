// pages/api/mpesa/stkpush.js
import { stkPush } from "@/utils/mpesa";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ message: "Phone number and amount required" });

    const formattedPhone = phone.replace(/^0/, "254");

    const response = await stkPush(
      formattedPhone,
      amount,
      "AccountUpgrade",
      "Upgrade account via M-PESA"
    );

    console.log("STK Push Response:", response);

    return res.status(200).json({ message: "STK Push initiated", data: response });
  } catch (error) {
    console.error("STK Push Error:", error);
    return res.status(500).json({ message: "STK Push failed", error: error.message });
  }
}




