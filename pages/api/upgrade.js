// pages/api/upgrade.js
import { stkPush } from "@/utils/mpesa"; // ✅ must match your utils/mpesa.js
import { NextResponse } from "next/server";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { phone, amount } = req.body;

    // ✅ Basic validation
    if (!phone || !amount) {
      return res.status(400).json({ message: "Phone number and amount are required" });
    }

    // ✅ Format phone number correctly (2547XXXXXXXX)
    const formattedPhone = phone.replace(/^0/, "254");

    // ✅ Send STK Push
    const response = await stkPush(
      formattedPhone,
      amount,
      "AccountUpgrade",
      "Upgrade account via M-PESA"
    );

    console.log("STK Push Response:", response);

    // ✅ Success response
    return res.status(200).json({
      message: "STK Push initiated successfully",
      data: response,
    });
  } catch (error) {
    console.error("Upgrade error:", error.message);
    return res.status(500).json({ message: "STK Push failed", error: error.message });
  }
}

