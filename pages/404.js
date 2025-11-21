// pages/404.js
import { useRouter } from 'next/router';

export default function Custom404() {
  const router = useRouter();
  return (
    <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif', textAlign: 'center' }}>
      <h1 style={{ color: '#e91e63' }}>404 - This page could not be found.</h1>
      <button
        onClick={() => router.push('/')}
        style={{
          background: '#e91e63',
          color: '#fff',
          padding: '8px 15px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          marginTop: 10,
        }}
      >
        Back to Home
      </button>
    </div>
  );
}
