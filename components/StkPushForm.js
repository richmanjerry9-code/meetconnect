'use client';
import { useState, useEffect } from 'react';

export default function StkPushForm({ initialPhone, initialAmount = 0, readOnlyAmount = false, apiEndpoint, additionalBody = {} }) {
  const [phone, setPhone] = useState(initialPhone || '');
  const [amount, setAmount] = useState(initialAmount || 0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialAmount) setAmount(initialAmount);
  }, [initialAmount]);

  // Basic phone validation (without changing format)
  const validatePhone = (p) => {
    const cleaned = p.replace(/[^\d+]/g, '');
    if (cleaned.length < 9) throw new Error('Invalid phone number.');
    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const validatedPhone = validatePhone(phone);
      if (!amount || isNaN(amount)) throw new Error('Amount is required');

      const payload = {
        phone: validatedPhone,
        amount: Number(amount),
        ...additionalBody,
      };

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'STK Push failed');

      setMessage('STK Push initiated! Check your phone.');
    } catch (err) {
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
          placeholder="Enter your phone number"
          required
        />
      </label>

      <label>
        Amount:
        <input
          type="number"
          value={amount}
          readOnly={readOnlyAmount}
          required
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : `Pay KSh ${amount} via M-Pesa`}
      </button>

      {message && <p>{message}</p>}
    </form>
  );
}
