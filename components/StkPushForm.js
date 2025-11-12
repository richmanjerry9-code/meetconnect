'use client'; // ensure this is a client component
import { useState } from 'react';

export default function StkPushForm({ initialPhone, initialAmount, readOnlyAmount = false, apiEndpoint, additionalBody = {} }) {
  const [phone, setPhone] = useState(initialPhone || '');
  const [amount, setAmount] = useState(initialAmount || 0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Format phone to acceptable 07, 01, +254
  const formatPhone = (p) => {
    let formatted = p.trim();
    if (formatted.startsWith('0') || formatted.startsWith('1') || formatted.startsWith('7')) {
      return formatted;
    }
    if (formatted.startsWith('+254')) return formatted;
    throw new Error('Phone number must start with 07, 01, or +254');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const formattedPhone = formatPhone(phone);
      if (!amount || isNaN(amount)) throw new Error('Amount is required and must be a number');

      const payload = {
        phone: formattedPhone,
        amount: Number(amount),
        ...additionalBody,
      };

      console.log('STK Push payload:', payload);

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'STK Push failed');

      setMessage('STK Push initiated successfully! Check your phone.');
    } catch (err) {
      console.error('STK Push Error:', err.message);
      setMessage('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Phone:
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07xxxxxxx or +2547xxxxxxx"
          required
        />
      </label>

      {!readOnlyAmount && (
        <label>
          Amount:
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
      )}

      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Pay via M-Pesa'}
      </button>

      {message && <p>{message}</p>}
    </form>
  );
}



