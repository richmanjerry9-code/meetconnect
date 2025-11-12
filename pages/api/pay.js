import { useState } from 'react';

export default function PayPage() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  const handlePay = async () => {
    setMessage('Processing payment...');

    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ STK Push sent! ${data.CustomerMessage || ''}`);
      } else {
        setMessage(`❌ Failed: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('⚠️ Error sending request');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
      <h2>Pay with M-PESA</h2>
      <input
        type="text"
        placeholder="Enter phone (2547...)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{ width: '100%', marginBottom: 10, padding: 8 }}
      />
      <input
        type="number"
        placeholder="Enter amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: '100%', marginBottom: 10, padding: 8 }}
      />
      <button onClick={handlePay} style={{ padding: '10px 20px' }}>
        Pay Now
      </button>
      {message && <p style={{ marginTop: 15 }}>{message}</p>}
    </div>
  );
}



