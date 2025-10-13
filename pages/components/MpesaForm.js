import { useState } from 'react';

export default function MpesaForm() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [response, setResponse] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount }),
      });
      const data = await res.json();
      setResponse(data);
      if (!res.ok) {
        console.error('Full error:', data); // Log full object
      }
    } catch (err) {
      console.error('Fetch error:', err); // Log full
      setResponse({ error: JSON.stringify(err, null, 2) }); // Stringify for display
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '20px', background: '#f9f9f9', borderRadius: '8px' }}>
      <h2>MPESA STK Push</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Phone (2547XXXXXXX)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ width: '100%', marginBottom: '8px', padding: '8px' }}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: '100%', marginBottom: '8px', padding: '8px' }}
        />
        <button type="submit" style={{ width: '100%', padding: '8px', background: '#4CAF50', color: '#fff' }}>
          Pay
        </button>
      </form>
      {response && (
        <pre style={{ marginTop: '10px', background: '#eee', padding: '8px' }}>
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  );
}



