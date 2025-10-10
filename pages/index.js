import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { Nairobi } from '../data/locations';
import styles from '../styles/Home.module.css';

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
    <div className={styles.container}>
      <Head>
        <title>Meetconnect - Find Your Match</title>
        <meta name="description" content="Connect with people in Nairobi on Meetconnect" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
      </Head>
      <header className={styles.header}>
        <h1 onClick={() => router.push('/')} className={styles.title}>
          MeetConnect ❤️
        </h1>
        <div className={styles.authButtons}>
          {!user && (
            <>
              <button onClick={() => setShowRegister(true)} className={styles.button}>
                Register
              </button>
              <button onClick={() => setShowLogin(true)} className={`${styles.button} ${styles.login}`}>
                Login
              </button>
            </>
          )}
          {user && (
            <>
              <button onClick={() => router.push('/profile-setup')} className={styles.button}>
                My Profile
              </button>
              <button onClick={handleLogout} className={`${styles.button} ${styles.logout}`}>
                Logout
              </button>
            </>
          )}
        </div>
      </header>
      <div className={styles.search}>
        <select value={selectedCounty} onChange={(e) => setSelectedCounty(e.target.value)} className={styles.select}>
          <option value="">Select County</option>
          {counties.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className={styles.select}>
          <option value="">Select Area</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search location..."
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          className={styles.searchInput}
        />
        {filteredLocations.length > 0 && (
          <div className={styles.dropdown}>
            {filteredLocations.map((loc, idx) => (
              <div
                key={idx}
                onClick={() => handleLocationSelect(loc.county, loc.area)}
                className={styles.dropdownItem}
              >
                {loc.county} - {loc.area}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.profiles}>
        {searchLocation ? (
          <>
            {groupedProfiles.VIP.length > 0 && <h2 className={styles.sectionTitle}>VIP Profiles</h2>}
            {groupedProfiles.VIP.map((p, i) => (
              <ProfileCard key={i} p={p} router={router} />
            ))}
            {groupedProfiles.Prime.length > 0 && <h2 className={styles.sectionTitle}>Prime Profiles</h2>}
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
        {filteredProfiles.length === 0 && <p className={styles.noProfiles}>No profiles found.</p>}
      </div>
      {showLogin && (
        <Modal title="Login" onClose={() => setShowLogin(false)}>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              className={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              className={styles.input}
              required
            />
            <button type="submit" className={styles.button}>
              Login
            </button>
          </form>
        </Modal>
      )}
      {showRegister && (
        <Modal title="Register" onClose={() => setShowRegister(false)}>
          <form onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Full Name"
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              className={styles.input}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              className={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
              className={styles.input}
              required
            />
            <button type="submit" className={styles.button}>
              Register
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProfileCard({ p, router }) {
  const handleClick = () => {
    if (!p.username || p.username.trim() === '') {
      console.error('Missing or empty username for profile:', p);
      alert('This profile lacks a username. Please update it in Profile Setup.');
      return;
    }
    router.push(`/view-profile/${encodeURIComponent(p.username)}`);
  };

  return (
    <div className={styles.profileCard} onClick={handleClick}>
      {p.profilePic ? (
        <Image
          src={p.profilePic}
          alt={p.name || 'Profile'}
          layout="responsive"
          width={100}
          height={100}
          className={styles.profileImage}
        />
      ) : (
        <div className={styles.placeholderImage} />
      )}
      <div className={styles.profileInfo}>
        <h3>{p.name}</h3>
        {p.membership && p.membership !== 'Regular' && (
          <span className={`${styles.badge} ${styles[p.membership.toLowerCase()]}`}>
            {p.membership}
          </span>
        )}
      </div>
      <p className={styles.location}>{p.area || p.city || 'Nairobi'}</p>
      {p.services && (
        <div className={styles.services}>
          {p.services.map((s, idx) => (
            <span key={idx} className={styles.serviceTag}>
              {s}
            </span>
          ))}
        </div>
      )}
      {p.phone && (
        <p>
          <a href={`tel:${p.phone}`} className={styles.phoneLink}>
            {p.phone}
          </a>
        </p>
      )}
    </div>
  );
}

function Modal({ children, title, onClose }) {
  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <h2>{title}</h2>
        <span onClick={onClose} className={styles.close}>
          X
        </span>
        {children}
      </div>
    </div>
  );
}