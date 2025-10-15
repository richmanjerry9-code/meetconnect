// components/MpesaModal.js
import { useState } from 'react';

export default function MpesaModal({ isOpen, onClose }) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Processing...');
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount }),
      });
      const data = await res.json();
      if (res.ok) setStatus(`STK Push sent! MerchantRequestID: ${data.MerchantRequestID}`);
      else setStatus(`Error: ${data.message}`);
    } catch (err) {
      setStatus('Error sending request');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        width: '400px',
      }}>
        <h2>Upgrade via M-Pesa</h2>
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
          <button type="submit" style={{ padding: '0.5rem 1rem', marginRight: '1rem' }}>Pay</button>
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
        </form>
        <p>{status}</p>
      </div>
    </div>
  );
}
