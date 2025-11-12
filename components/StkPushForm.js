// components/StkPushForm.js
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function StkPushForm({
  title = "Complete Payment",
  description = "",
  initialPhone = "",
  initialAmount,
  readOnlyAmount = false,
  apiEndpoint,
  additionalBody = {},
  onSuccess,
}) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(initialAmount || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Reformat initialPhone to "07..." format on load
  useEffect(() => {
    let formatted = initialPhone.replace(/[^\d]/g, '');  // Clean to digits
    if (formatted.startsWith('2547')) {
      formatted = '0' + formatted.slice(3);  // 254742... -> 0742...
    } else if (formatted.startsWith('7')) {
      formatted = '0' + formatted;  // 742... -> 0742...
    } else if (formatted.startsWith('07')) {
      // Already good
    }
    setPhone(formatted);
  }, [initialPhone]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) return setMessage('Please enter your phone number');
    if (!amount || amount <= 0) return setMessage('Please enter a valid amount');
    setLoading(true);
    setMessage(null);

    try {
      const formattedPhone = formatPhoneForMpesa(phone);  // Convert to "254..." on submit only
      const res = await axios.post(apiEndpoint, {
        phone: formattedPhone,
        amount: parseInt(amount),
        ...additionalBody,
      });
      if (res.data.CheckoutRequestID) {
        setMessage('STK Push sent! Please check your phone and enter your M-Pesa PIN.');
        if (onSuccess) onSuccess(res.data);
      } else {
        setMessage('Unexpected response. Try again.');
      }
    } catch (err) {
      console.error(err.response?.data || err.message);
      setMessage(err.message || 'Payment request failed. Please try again.');
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
            placeholder="0712345678"  // Local format
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}  // Clean to digits while typing
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring focus:ring-blue-200 outline-none"
            required
          />
        </div>
        {!readOnlyAmount && (
          <div>
            <label className="block text-sm mb-1 font-medium">Amount (KSh)</label>
            <input
              type="number"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring focus:ring-blue-200 outline-none"
              required
            />
          </div>
        )}
        {readOnlyAmount && initialAmount && (
          <div className="text-center py-2 bg-gray-100 rounded-lg">
            <p className="text-sm font-medium">Amount: KSh {initialAmount}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition"
        >
          {loading ? 'Sending STK Push...' : `Pay KSh ${amount || 0}`}
        </button>
      </form>
      {message && (
        <p className={`mt-3 text-sm ${message.toLowerCase().includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

// formatPhoneForMpesa (unchanged - converts to "254..." on submit)
function formatPhoneForMpesa(phone) {
  if (!phone) throw new Error('Phone number is required');
  let formatted = phone.replace(/[^\d]/g, '');
  if (formatted.startsWith('0')) {
    formatted = '254' + formatted.slice(1);
  } else if (formatted.startsWith('254')) {
    // Already good
  } else if (formatted.length === 9 && formatted.startsWith('7')) {
    formatted = '254' + formatted;
  } else {
    throw new Error('Invalid phone number format. Use 07XXXXXXXX');
  }
  if (formatted.length !== 12 || !formatted.startsWith('2547')) {
    throw new Error('Invalid M-Pesa phone number. Must be a valid Kenyan mobile number starting with 07.');
  }
  return formatted;
}
