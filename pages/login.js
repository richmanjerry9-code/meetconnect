import { useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function Login() {
  const router = useRouter();
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    const { email, password } = loginForm;

    if (!email || !password) {
      alert('Please enter your email and password!');
      return;
    }

    try {
      // 1️⃣ Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 2️⃣ Fetch profile from Firestore
      const profilesRef = collection(db, 'profiles');
      const profileQuery = query(profilesRef, where('uid', '==', uid));
      const profileSnap = await getDocs(profileQuery);

      if (profileSnap.empty) {
        alert('Profile not found!');
        return;
      }

      const profile = { id: profileSnap.docs[0].id, ...profileSnap.docs[0].data() };
      localStorage.setItem('loggedInUser', JSON.stringify(profile));

      alert('✅ Login successful!');

      // 3️⃣ Redirect
      if (!profile.area || !profile.phone) router.push('/profile-setup');
      else router.push('/');
    } catch (error) {
      console.error('Login failed:', error);
      alert('❌ Login failed: ' + error.message);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: '#fff', padding: 30, borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', maxWidth: 400, width: '100%' }}>
        <h2 style={{ color: '#e91e63', textAlign: 'center' }}>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            style={{ width: '100%', padding: 10, margin: '10px 0', borderRadius: 8, border: '1px solid #e91e63' }}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            style={{ width: '100%', padding: 10, margin: '10px 0', borderRadius: 8, border: '1px solid #e91e63' }}
            required
          />
          <button type="submit" style={{ background: '#e91e63', color: '#fff', padding: '8px 15px', borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%' }}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

