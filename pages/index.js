import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { Nairobi } from '../data/locations';

export default function Home() {
  const router = useRouter();
  const [profiles, setProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('profiles') || '[]');
    setProfiles(data);
    const loggedIn = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    setUser(loggedIn);
  }, []);

  useEffect(() => {
    if (profiles.length > 0) {
      profiles.forEach((p) => {
        if (!p.username) console.warn('Profile missing username:', p);
      });
    }
  }, [profiles]);

  useEffect(() => {
    if (!searchLocation || !Nairobi) return setFilteredLocations([]);
    const matches = [];
    Object.keys(Nairobi).forEach((county) => {
      Nairobi[county].forEach((area) => {
        if (area.toLowerCase().includes(searchLocation.toLowerCase())) {
          matches.push({ county, area });
        }
      });
    });
    setFilteredLocations(matches);
  }, [searchLocation]);

  const handleLocationSelect = (county, area) => {
    setSelectedCounty(county);
    setSelectedArea(area);
    setSearchLocation(area);
    setFilteredLocations([]);
  };

  const membershipPriority = { VVIP: 4, VIP: 3, Prime: 2, Regular: 1 };

  let filteredProfiles = profiles.filter((p) => {
    if (!searchLocation) return true;
    return [p.county, p.city, p.ward, p.area, ...(p.nearby || [])]
      .join(' ')
      .toLowerCase()
      .includes(searchLocation.toLowerCase());
  });

  if (!searchLocation) {
    const membershipGroups = ['VVIP', 'VIP', 'Prime', 'Regular'];
    let selectedGroup = [];
    for (const m of membershipGroups) {
      selectedGroup = filteredProfiles.filter((p) => p.membership === m || (m === 'Regular' && !p.membership));
      if (selectedGroup.length > 0) break;
    }
    filteredProfiles = selectedGroup;
  }

  filteredProfiles.sort((a, b) => {
    const aPriority = membershipPriority[a.membership] || 0;
    const bPriority = membershipPriority[b.membership] || 0;
    return bPriority - aPriority;
  });

  const groupedProfiles = { VIP: [], Prime: [], Regular: [] };
  filteredProfiles.forEach((p) => {
    if (p.membership === 'VVIP' || p.membership === 'VIP') groupedProfiles.VIP.push(p);
    else if (p.membership === 'Prime') groupedProfiles.Prime.push(p);
    else groupedProfiles.Regular.push(p);
  });

  const handleLogin = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const foundUser = users.find((u) => u.email === loginForm.email && u.password === loginForm.password);
    if (!foundUser) return alert('Invalid email or password!');
    localStorage.setItem('loggedInUser', JSON.stringify(foundUser));
    setUser(foundUser);
    router.push('/profile-setup');
    setShowLogin(false);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.some((u) => u.email === registerForm.email)) return alert('Email already registered!');
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

  const counties = Nairobi ? Object.keys(Nairobi) : [];
  const areas = selectedCounty && Nairobi ? Nairobi[selectedCounty] : [];

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Poppins,sans-serif', padding: 20, background: 'linear-gradient(to bottom right,#fff5f7,#ffe6ee)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 50 }}>
        <h1 style={{ color: '#e91e63', fontWeight: 'bold', fontSize: 32, cursor: 'pointer' }} onClick={() => router.push('/')}>
          MeetConnect ❤️
        </h1>
        <div style={{ display: 'flex', gap: 10 }}>
          {!user && (
            <>
              <button onClick={() => setShowRegister(true)} style={btnStyle}>
                Register
              </button>
              <button onClick={() => setShowLogin(true)} style={{ ...btnStyle, background: '#ff80ab' }}>
                Login
              </button>
            </>
          )}
          {user && (
            <>
              <button onClick={() => router.push('/profile-setup')} style={btnStyle}>
                My Profile
              </button>
              <button onClick={handleLogout} style={{ ...btnStyle, background: '#555' }}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 15, marginTop: 20, position: 'relative' }}>
        <select style={selectStyle} value={selectedCounty} onChange={(e) => setSelectedCounty(e.target.value)}>
          <option value=''>Select County</option>
          {counties.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select style={selectStyle} value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
          <option value=''>Select Area</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type='text'
          placeholder='Search location...'
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e91e63', width: 200 }}
        />
        {filteredLocations.length > 0 && (
          <div style={{ position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #e91e63', borderRadius: 8, width: 220, maxHeight: 150, overflowY: 'auto', zIndex: 10 }}>
            {filteredLocations.map((loc, idx) => (
              <div
                key={idx}
                onClick={() => handleLocationSelect(loc.county, loc.area)}
                style={{ padding: '6px 10px', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#ffe6ee')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                {loc.county} - {loc.area}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', justifyContent: 'center', gap: 20, marginTop: 30 }}>
        {searchLocation ? (
          <>
            {groupedProfiles.VIP.length > 0 && <h2 style={{ gridColumn: '1/-1', color: '#e91e63' }}>VIP Profiles</h2>}
            {groupedProfiles.VIP.map((p, i) => (
              <ProfileCard key={i} p={p} router={router} />
            ))}
            {groupedProfiles.Prime.length > 0 && <h2 style={{ gridColumn: '1/-1', color: '#e91e63' }}>Prime Profiles</h2>}
            {groupedProfiles.Prime.map((p, i) => (
              <ProfileCard key={i} p={p} router={router} />
            ))}
            {groupedProfiles.Regular.map((p, i) => (
              <ProfileCard key={i} p={p} router={router} />
            ))}
          </>
        ) : (
          filteredProfiles.map((p, i) => (
            <ProfileCard key={i} p={p} router={router} />
          ))
        )}
        {filteredProfiles.length === 0 && <p style={{ textAlign: 'center', color: '#777', gridColumn: '1/-1' }}>No profiles found.</p>}
      </div>
      {showLogin && (
        <Modal title='Login' onClose={() => setShowLogin(false)}>
          <form onSubmit={handleLogin}>
            <input
              type='email'
              placeholder='Email'
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              style={inputStyle}
              required
            />
            <input
              type='password'
              placeholder='Password'
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              style={inputStyle}
              required
            />
            <button type='submit' style={btnStyle}>
              Login
            </button>
          </form>
        </Modal>
      )}
      {showRegister && (
        <Modal title='Register' onClose={() => setShowRegister(false)}>
          <form onSubmit={handleRegister}>
            <input
              type='text'
              placeholder='Full Name'
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              style={inputStyle}
              required
            />
            <input
              type='email'
              placeholder='Email'
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              style={inputStyle}
              required
            />
            <input
              type='password'
              placeholder='Password'
              value={registerForm.password}
              onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
              style={inputStyle}
              required
            />
            <button type='submit' style={btnStyle}>
              Register
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: 10, margin: '10px 0', borderRadius: 8, border: '1px solid #e91e63' };
const btnStyle = { padding: '8px 15px', background: '#e91e63', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer' };
const selectStyle = { padding: 8, borderRadius: 8, border: '1px solid #e91e63' };

function ProfileCard({ p, router }) {
  const handleClick = () => {
    if (!p.username || p.username.trim() === '') {
      console.error('Missing or empty username for profile:', p);
      alert('This profile lacks a username. Please update it in Profile Setup.');
      return;
    }
    console.log('Navigating to /view-profile/' + p.username);
    router.push(`/view-profile/${encodeURIComponent(p.username)}`);
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 15,
        padding: 15,
        textAlign: 'center',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        transition: 'transform 0.3s',
      }}
      onClick={handleClick}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {p.profilePic ? (
        <Image
          src={p.profilePic}
          alt={p.name || 'Profile'}
          width={100}
          height={100}
          style={{ borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }}
        />
      ) : (
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#ffe6ee', margin: '0 auto 8px' }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
        <h3 style={{ margin: 0, color: '#e91e63' }}>{p.name}</h3>
        {p.membership && p.membership !== 'Regular' && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 5px',
              background:
                p.membership === 'VVIP' ? '#ff4500' : p.membership === 'VIP' ? '#ffd700' : p.membership === 'Prime' ? '#ff80ab' : '#aaa',
              borderRadius: 5,
              color: '#fff',
            }}
          >
            {p.membership}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: '#555' }}>{p.area || p.city || 'Nairobi'}</p>
      {p.services && (
        <div style={{ marginTop: 4 }}>
          {p.services.map((s, idx) => (
            <span
              key={idx}
              style={{ display: 'inline-block', margin: '2px 4px', padding: '2px 5px', background: '#ffe6ee', borderRadius: 5, fontSize: 11 }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
      {p.phone && (
        <p style={{ marginTop: 6 }}>
          <a href={`tel:${p.phone}`} style={{ color: '#e91e63', textDecoration: 'underline' }}>
            {p.phone}
          </a>
        </p>
      )}
    </div>
  );
}

function Modal({ children, title, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
      }}
    >
      <div style={{ background: '#fff', padding: 20, borderRadius: 10, width: 300, position: 'relative' }}>
        <h2 style={{ marginTop: 0, color: '#e91e63' }}>{title}</h2>
        <span
          onClick={onClose}
          style={{ position: 'absolute', top: 10, right: 15, cursor: 'pointer', fontWeight: 'bold' }}
        >
          X
        </span>
        {children}
      </div>
    </div>
  );
}