import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  const handleLogin = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const foundUser = users.find((u) => u.email === loginForm.email && u.password === loginForm.password);
    if (!foundUser) {
      alert('Invalid email or password!');
      return;
    }
    const profiles = JSON.parse(localStorage.getItem('profiles') || '[]');
    let profile = profiles.find((p) => p.email === foundUser.email);
    if (!profile) {
      profile = {
        email: foundUser.email,
        name: foundUser.name,
        profilePic: '',
        phone: '',
        county: '',
        area: '',
        services: [],
        nearby: [],
        createdAt: Date.now(),
      };
      profiles.push(profile);
      localStorage.setItem('profiles', JSON.stringify(profiles));
    }
    const loggedInUser = { ...foundUser, profile };
    localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
    if (!profile.area || !profile.phone) router.push('/create-profile');
    else router.push('/');
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: '#fff', padding: 30, borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', maxWidth: 400, width: '100%' }}>
        <h2 style={{ color: '#e91e63', textAlign: 'center' }}>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type='email'
            placeholder='Email'
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            style={{ width: '100%', padding: 10, margin: '10px 0', borderRadius: 8, border: '1px solid #e91e63' }}
            required
          />
          <input
            type='password'
            placeholder='Password'
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            style={{ width: '100%', padding: 10, margin: '10px 0', borderRadius: 8, border: '1px solid #e91e63' }}
            required
          />
          <button
            type='submit'
            style={{ background: '#e91e63', color: '#fff', padding: '8px 15px', borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%' }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}


