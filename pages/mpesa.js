import { useState } from 'react';

export default function MpesaPage() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Processing...');
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount }), // Send user-typed phone
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`STK Push sent! MerchantRequestID: ${data.MerchantRequestID}`);
      } else {
        setStatus(`Error: ${data.message}`);
      }
    } catch (err) {
      setStatus('Error sending request');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '2rem' }}>
      <h1>Pay with M-Pesa</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter phone number (2547XXXXXXXX)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Pay</button>
      </form>
      <p>{status}</p>
    </div>
  );
}

