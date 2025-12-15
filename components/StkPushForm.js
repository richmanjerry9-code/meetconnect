// components/StkPushForm.js
import { useState, useEffect } from 'react';
import styles from '../styles/StkPushForm.module.css';

const StkPushForm = ({
  initialPhone = '',
  initialAmount = '',
  readOnlyAmount = false,
  apiEndpoint,
  additionalBody = {},
}) => {
  const [phone, setPhone] = useState(initialPhone);
  const [amount, setAmount] = useState(initialAmount);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checkoutRequestID, setCheckoutRequestID] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [initiated, setInitiated] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || !amount) {
      setError('Phone and amount are required.');
      return;
    }
    if (parseInt(amount) < 1) {
      setError('Amount must be at least KSh 1.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount, ...additionalBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('STK Push initiated. Please check your phone and enter your PIN to complete the payment.');
        setCheckoutRequestID(data.checkoutRequestID); // Assume server returns it in response
        setInitiated(true);
      } else {
        setError(data.error || 'Failed to initiate payment.');
      }
    } catch (err) {
      setError('Error initiating payment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (checkoutRequestID) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/checkStk?requestId=${checkoutRequestID}`);
          const data = await res.json();
          if (res.ok) {
            if (data.status === 'completed') {
              setMessage('Payment completed successfully!');
              clearInterval(interval);
              // Optionally refresh page or update state
              setTimeout(() => window.location.reload(), 3000);
            } else if (data.status === 'failed') {
              setError('Payment failed: ' + data.resultDesc);
              clearInterval(interval);
              setCheckoutRequestID(null);
            }
            // else pending, continue polling
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 5000); // Poll every 5 seconds
      setPollingInterval(interval);

      // Stop polling after 60 seconds if no response
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setError('Payment timeout. Please try again.');
        setCheckoutRequestID(null);
      }, 60000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [checkoutRequestID]);

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label className={styles.label}>
        M-Pesa Phone Number (e.g., 0712345678 or 254712345678)
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
          className={styles.input}
          placeholder="0712345678"
          maxLength={12}
          required
          disabled={loading || !!checkoutRequestID}
        />
      </label>
      <label className={styles.label}>
        Amount (KSh)
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={styles.input}
          disabled={readOnlyAmount || loading || !!checkoutRequestID}
          min="1"
          required
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.message}>{message}</p>}
      {initiated && !checkoutRequestID && !loading && <p className={styles.message}>If you cancelled the prompt on your phone by mistake, click the button above to resend.</p>}
      <button type="submit" className={styles.button} disabled={loading || !!checkoutRequestID}>
        {loading ? 'Processing...' : initiated ? 'Resend STK Push' : 'Pay with M-Pesa'}
      </button>
    </form>
  );
};

export default StkPushForm;
