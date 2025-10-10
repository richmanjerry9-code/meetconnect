import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { Nairobi } from '../data/locations';

export default function Home() {
  const router = useRouter();
  const [profiles, setProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [searchLocation, setSearchLocation] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('profiles') || '[]');
    setProfiles(data);
    setUser(JSON.parse(localStorage.getItem('loggedInUser') || 'null'));
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const foundUser = users.find(u => u.email === loginForm.email && u.password === loginForm.password);
    if (foundUser) {
      localStorage.setItem('loggedInUser', JSON.stringify(foundUser));
      setUser(foundUser);
      router.push('/profile-setup');
      setShowLogin(false);
    } else {
      alert('Invalid email or password!');
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.some(u => u.email === registerForm.email)) {
      alert('Email already registered!');
      return;
    }
    const newUser = { ...registerForm, createdAt: Date.now(), membership: 'Regular' };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('loggedInUser', JSON.stringify(newUser));
    setUser(newUser);
    router.push('/profile-setup');
    setShowRegister(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setUser(null);
  };

  const filteredProfiles = profiles.filter(p =>
    [p.county, p.city, p.ward, p.area, ...(p.nearby || [])]
      .join(' ')
      .toLowerCase()
      .includes(searchLocation.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', background: '#f0f0f0' }}>
      <Head>
        <title>MeetConnect</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
      </Head>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ color: '#e91e63' }}>MeetConnect ❤️</h1>
        <div>
          {!user && (
            <>
              <button onClick={() => setShowRegister(true)} style={{ padding: '10px', background: '#e91e63', color: 'white', border: 'none', marginRight: '10px' }}>Register</button>
              <button onClick={() => setShowLogin(true)} style={{ padding: '10px', background: '#ff80ab', color: 'white', border: 'none' }}>Login</button>
            </>
          )}
          {user && (
            <>
              <button onClick={() => router.push('/profile-setup')} style={{ padding: '10px', background: '#e91e63', color: 'white', border: 'none', marginRight: '10px' }}>My Profile</button>
              <button onClick={handleLogout} style={{ padding: '10px', background: '#555', color: 'white', border: 'none' }}>Logout</button>
            </>
          )}
        </div>
      </header>
      <input
        type="text"
        placeholder="Search location..."
        value={searchLocation}
        onChange={(e) => setSearchLocation(e.target.value)}
        style={{ padding: '10px', width: '300px', marginBottom: '20px' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {filteredProfiles.map((p, i) => (
          <div key={i} style={{ background: '#fff', padding: '10px', textAlign: 'center' }}>
            {p.profilePic && <Image src={p.profilePic} alt={p.name} width={100} height={100} />}
            <h3>{p.name}</h3>
            <p>{p.area || p.city || 'Nairobi'}</p>
            {p.phone && <p><a href={`tel:${p.phone}`} style={{ color: '#e91e63' }}>{p.phone}</a></p>}
          </div>
        ))}
      </div>
      {showLogin && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', padding: '20px', position: 'relative', width: '300px' }}>
            <h2>Login</h2>
            <button onClick={() => setShowLogin(false)} style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'none', fontSize: '20px' }}>X</button>
            <form onSubmit={handleLogin}>
              <input type="email" placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} style={{ padding: '10px', width: '100%', margin: '10px 0' }} required />
              <input type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} style={{ padding: '10px', width: '100%', margin: '10px 0' }} required />
              <button type="submit" style={{ padding: '10px', background: '#e91e63', color: 'white', border: 'none', width: '100%' }}>Login</button>
            </form>
          </div>
        </div>
      )}
      {showRegister && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', padding: '20px', position: 'relative', width: '300px' }}>
            <h2>Register</h2>
            <button onClick={() => setShowRegister(false)} style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'none', fontSize: '20px' }}>X</button>
            <form onSubmit={handleRegister}>
              <input type="text" placeholder="Name" value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} style={{ padding: '10px', width: '100%', margin: '10px 0' }} required />
              <input type="email" placeholder="Email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} style={{ padding: '10px', width: '100%', margin: '10px 0' }} required />
              <input type="password" placeholder="Password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} style={{ padding: '10px', width: '100%', margin: '10px 0' }} required />
              <button type="submit" style={{ padding: '10px', background: '#e91e63', color: 'white', border: 'none', width: '100%' }}>Register</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}