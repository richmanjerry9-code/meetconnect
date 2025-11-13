import fs from "fs";

export default async function handler(req, res) {
  try {
    const callbackData = req.body;
    const log = `${new Date().toISOString()} - ${JSON.stringify(callbackData)}\n`;
    fs.appendFileSync("mpesa_callback.log", log);

    res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Callback processed successfully",
    });
  } catch (err) {
    fs.appendFileSync("mpesa_errors.log", `${new Date().toISOString()} - ${err.message}\n`);
    res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Server error",
    });
  }
}
