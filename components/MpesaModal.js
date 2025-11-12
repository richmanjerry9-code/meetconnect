'use client';
import { useState } from 'react';

export default function MpesaModal({ isOpen, onClose, apiEndpoint = '/api/upgrade' }) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Basic validation & formatting to 254 for STK push
  const formatPhoneForSTK = (p) => {
    const cleaned = p.replace(/[^\d]/g, '');
    if (cleaned.startsWith('0')) return '254' + cleaned.slice(1);
    if (cleaned.startsWith('7') && cleaned.length === 9) return '254' + cleaned;
    if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
    throw new Error('Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setLoading(true);

    try {
      if (!amount || isNaN(amount)) throw new Error('Amount is required');
      const formattedPhone = formatPhoneForSTK(phone);

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, amount: Number(amount) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'STK Push failed');

      setStatus(`STK Push sent! Check ${phone} for the prompt.`);
    } catch (err) {
      setStatus('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          width: '400px',
        }}
      >
        <h2>Upgrade via M-Pesa</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="07XXXXXXXX or +2547XXXXXXXX"
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
          <button
            type="submit"
            style={{ padding: '0.5rem 1rem', marginRight: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : `Pay KSh ${amount}`}
          </button>
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>
            Cancel
          </button>
        </form>
        {status && <p style={{ marginTop: '1rem' }}>{status}</p>}
      </div>
    </div>
  );
}

