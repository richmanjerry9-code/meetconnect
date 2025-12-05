// pages/login.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in → redirect immediately
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in both email and password.');
      setLoading(false);
      return;
    }

    try {
      const trimmedEmail = email.trim().toLowerCase();

      // Firebase Auth login
      const { user } = await signInWithEmailAndPassword(auth, trimmedEmail, password);

      // Fetch profile (doc ID = uid)
      const profileSnap = await getDoc(doc(db, 'profiles', user.uid));

      let profileData;

      if (profileSnap.exists()) {
        profileData = { id: user.uid, ...profileSnap.data() };
      } else {
        // First time login after email/password creation → create minimal profile
        profileData = {
          id: user.uid,
          uid: user.uid,
          email: user.email,
          username: user.email.split('@')[0],
          name: user.email.split('@')[0],
          membership: 'Regular',
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'profiles', user.uid), profileData);
      }

      // Save to localStorage for quick access across the app
      localStorage.setItem('loggedInUser', JSON.stringify(profileData));

      // Redirect logic
      if (!profileData.area || !profileData.phone || !profileData.profilePic) {
        router.push('/profile-setup');
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      let msg = 'Login failed. Please try again.';

      switch (err.code) {
        case 'auth/invalid-email':
          msg = 'Invalid email address.';
          break;
        case 'auth/user-not-found':
          msg = 'No account found with this email.';
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          msg = 'Incorrect password.';
          break;
        case 'auth/too-many-requests':
          msg = 'Too many failed attempts. Try again later.';
          break;
        default:
          msg = err.message || msg;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        padding: 20,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: 40,
          borderRadius: 16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h2 style={{ color: '#e91e63', marginBottom: 30, fontSize: 28 }}>
          Welcome Back
        </h2>

        {error && (
          <p style={{ color: '#d32f2f', background: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 20 }}>
            {error}
          </p>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#555' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #e91e63',
                fontSize: 16,
                outline: 'none',
                transition: 'border 0.3s',
              }}
              onFocus={(e) => (e.target.style.border = '2px solid #e91e63')}
              onBlur={(e) => (e.target.style.border = '1px solid #e91e63')}
            />
          </div>

          <div style={{ marginBottom: 30, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#555' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #e91e63',
                fontSize: 16,
                outline: 'none',
                transition: 'border 0.3s',
              }}
              onFocus={(e) => (e.target.style.border = '2px solid #e91e63')}
              onBlur={(e) => (e.target.style.border = '1px solid #e91e63')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#e91e63',
              color: '#fff',
              padding: '14px 20px',
              borderRadius: 10,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
              fontSize: 18,
              fontWeight: '600',
              transition: 'background 0.3s',
            }}
            onMouseOver={(e) => !loading && (e.target.style.background = '#c2185b')}
            onMouseOut={(e) => !loading && (e.target.style.background = '#e91e63')}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: 30 }}>
          <p style={{ color: '#666' }}>
            <p>Don{"'"}t have an account?</p>   {/* or Don’t with real ’ */}
<p>What{"'"}s your name?</p>
            <span
              onClick={() => router.push('/register')}
              style={{
                color: '#e91e63',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Register here
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}