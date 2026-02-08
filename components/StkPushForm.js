// components/StkPushForm.js
import { useState, useEffect, useRef } from 'react';
import styles from '../styles/StkPushForm.module.css';

const StkPushForm = ({
  initialPhone = '',
  initialAmount = '',
  readOnlyAmount = false,
  apiEndpoint,
  additionalBody = {},
  onInitiated = () => {},
  onFailure = () => {},
  onSuccess = () => {},   // ← Called when payment succeeds (triggers receipt + Firestore update)
}) => {
  const [phone, setPhone] = useState(initialPhone);
  const [amount, setAmount] = useState(initialAmount);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checkoutRequestID, setCheckoutRequestID] = useState(null);
  const [initiated, setInitiated] = useState(false);

  const pollingRef = useRef(null);

  // Normalize Kenyan M-Pesa phone number to 2547XXXXXXXX format
  const normalizePhone = (rawPhone) => {
    let formatted = rawPhone.replace(/[^\d]/g, '');
    if (formatted.startsWith('0')) formatted = '254' + formatted.slice(1);
    else if (formatted.length === 9 && formatted.startsWith('7')) formatted = '254' + formatted;
    if (formatted.length !== 12 || !formatted.startsWith('2547')) {
      throw new Error('Invalid M-Pesa phone number. Use 07XXXXXXXX format.');
    }
    return formatted;
  };

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
    setMessage('');

    let formattedPhone;
    try {
      formattedPhone = normalizePhone(phone);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, amount, ...additionalBody }),
      });

      const data = await res.json();

      if (res.ok && data.checkoutRequestID) {
        setMessage('STK Push sent! Check your phone and enter your M-Pesa PIN.');
        setCheckoutRequestID(data.checkoutRequestID);
        setInitiated(true);
        onInitiated(data.checkoutRequestID);
      } else {
        setError(data.error || 'Failed to initiate payment.');
        onFailure();
      }
    } catch (err) {
      setError('Error initiating payment: ' + err.message);
      onFailure();
    } finally {
      setLoading(false);
    }
  };

  // Polling (only runs when checkoutRequestID exists)
  useEffect(() => {
    if (!checkoutRequestID) return;

    setMessage('Processing payment... Please wait.');

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkStk?requestId=${checkoutRequestID}`);
        const data = await res.json();

        if (data.ResultCode === '0') {
          // SUCCESS
          clearInterval(pollingRef.current);
          setMessage('Payment completed successfully! ✅');
          onSuccess();                    // ← This will trigger receipt in ProfileSetup
        } 
        else if (data.ResultCode && data.ResultCode !== '4999') {
          // FAILED
          clearInterval(pollingRef.current);
          setError('Payment failed: ' + (data.ResultDesc || 'Unknown error'));
          setCheckoutRequestID(null);
          onFailure();
        }
        // else still processing (4999) → continue polling
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 8000); // Poll every 8 seconds

    // Auto timeout after 90 seconds
    const timeout = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setError('Payment timeout. Please try again.');
      setCheckoutRequestID(null);
      onFailure();
    }, 90000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearTimeout(timeout);
    };
  }, [checkoutRequestID, onSuccess, onFailure]);

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label className={styles.label}>
        M-Pesa Phone Number (e.g., 0712345678)
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

      <button 
        type="submit" 
        className={styles.button} 
        disabled={loading || !!checkoutRequestID}
      >
        {loading ? 'Processing...' : initiated ? 'Resend STK Push' : 'Pay with M-Pesa'}
      </button>
    </form>
  );
};

export default StkPushForm;