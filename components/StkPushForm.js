// components/StkPushForm.js
import { useState } from "react";
import axios from "axios";

export default function StkPushForm({
  title = "Complete Payment",
  description = "",
  amount,
  apiEndpoint,
  additionalBody = {},
  onSuccess,
}) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) return setMessage("Please enter your phone number");

    setLoading(true);
    setMessage(null);

    try {
      const res = await axios.post(apiEndpoint, {
        phone: formatPhone(phone),
        amount,
        accountReference: "MeetConnect",
        transactionDesc: `Payment for ${title}`,
        ...additionalBody,
      });

      if (res.data.CheckoutRequestID) {
        setMessage("STK Push sent! Please check your phone and enter your M-Pesa PIN.");
        if (onSuccess) onSuccess(res.data);
      } else {
        setMessage("Unexpected response. Try again.");
      }
    } catch (err) {
      console.error(err.response?.data || err.message);
      setMessage("Payment request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-2xl shadow-md">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {description && <p className="text-gray-500 mb-4">{description}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1 font-medium">Phone Number</label>
          <input
            type="tel"
            placeholder="2547XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring focus:ring-blue-200 outline-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition"
        >
          {loading ? "Sending STK Push..." : `Pay Ksh ${amount}`}
        </button>
      </form>

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.toLowerCase().includes("failed") ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

// Helper: Ensure phone starts with 254
function formatPhone(phone) {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) clean = "254" + clean.slice(1);
  if (!clean.startsWith("254")) clean = "254" + clean;
  return clean;
}
