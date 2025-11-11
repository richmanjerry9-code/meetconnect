import { useState } from 'react';

export default function TestPayment() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const handlePay = async () => {
    setStatus('Processing...');
    try {
      const res = await fetch('/api/mpesa/stkpush', {  // Updated to /api/mpesa/stkpush for consistency
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone, 
          amount,
          accountReference: 'TestReference',  // Add required params
          transactionDesc: 'Test Payment' 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`STK Push sent! Check your phone. MerchantRequestID: ${data.MerchantRequestID}`);
      } else {
        setStatus(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setStatus('Error sending request');
      console.error(err);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '2rem' }}>
      <h1>Test M-PESA Payment</h1>
      <input
        type="text"
        placeholder="Enter phone (07, +254 or 254)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
      />
      <input
        type="number"
        placeholder="Enter amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
      />
      <button onClick={handlePay} style={{ padding: '0.5rem 1rem' }}>
        Pay
      </button>
      <p>{status}</p>
    </div>
  );
}