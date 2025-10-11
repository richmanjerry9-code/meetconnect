import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { Nairobi } from '../data/locations';
import styles from '../styles/Home.module.css';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  addDoc,
  query,
  where
} from 'firebase/firestore';

export default function Home() {
  const router = useRouter();
  const [profiles, setProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    // Load profiles from Firestore (filter incomplete)
    const fetchProfiles = async () => {
      const querySnapshot = await getDocs(collection(db, 'profiles'));
      const data = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((p) => p.username && p.name && p.email);
      setProfiles(data);
    };
    fetchProfiles();

    // Keep user login from localStorage
    const loggedIn = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    setUser(loggedIn);
  }, []);

  useEffect(() => {
    if (!searchLocation || !Nairobi) return setFilteredLocations([]);
    const matches = [];
    Object.keys(Nairobi).forEach((ward) => {
      Nairobi[ward].forEach((area) => {
        if (
          area.toLowerCase().includes(searchLocation.toLowerCase()) ||
          ward.toLowerCase().includes(searchLocation.toLowerCase())
        ) {
          matches.push({ ward, area });
        }
      });
    });
    setFilteredLocations(matches.slice(0, 5));
  }, [searchLocation]);

  const handleLocationSelect = (ward, area) => {
    setSelectedWard(ward);
    setSelectedArea(area);
    setSearchLocation(`${ward}, ${area}`);
    setFilteredLocations([]);
  };

  const membershipPriority = { VVIP: 4, VIP: 3, Prime: 2, Regular: 1 };

  let filteredProfiles = profiles.filter((p) => {
    if (!searchLocation && !selectedWard && !selectedArea) return true;
    const wardMatch = selectedWard ? p.ward === selectedWard : true;
    const areaMatch = selectedArea ? p.area === selectedArea : true;
    const searchMatch = searchLocation
      ? [p.county, p.city, p.ward, p.area, ...(p.nearby || [])]
          .join(' ')
          .toLowerCase()
          .includes(searchLocation.toLowerCase())
      : true;
    return wardMatch && areaMatch && searchMatch;
  });

  if (!searchLocation && !selectedWard && !selectedArea) {
    const membershipGroups = ['VVIP', 'VIP', 'Prime', 'Regular'];
    let selectedGroup = [];
    for (const m of membershipGroups) {
      selectedGroup = filteredProfiles.filter(
        (p) => p.membership === m || (m === 'Regular' && !p.membership)
      );
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

  // 🔹 Firestore-only REGISTER
  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const { name, email, password } = registerForm;
      if (!name || !email || !password) {
        alert("Fill in all fields!");
        return;
      }

      // check if email exists
      const q = query(collection(db, "profiles"), where("email", "==", email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        alert("Email already registered!");
        return;
      }

      const newUser = {
        name,
        email,
        password, // temporary for test
        username: email.split("@")[0],
        membership: "Regular",
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "profiles"), newUser);
      const savedUser = { id: docRef.id, ...newUser };

      localStorage.setItem("loggedInUser", JSON.stringify(savedUser));
      setUser(savedUser);
      alert("✅ Registration successful!");
      router.push("/profile-setup");
      setShowRegister(false);
    } catch (err) {
      console.error("Registration error:", err);
      alert("Error during registration. Try again.");
    }
  };

  // 🔹 Firestore-only LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { email, password } = loginForm;
      if (!email || !password) {
        alert("Enter both email and password!");
        return;
      }

      const q = query(
        collection(db, "profiles"),
        where("email", "==", email),
        where("password", "==", password)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("Invalid email or password!");
        return;
      }

      const loggedUser = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      localStorage.setItem("loggedInUser", JSON.stringify(loggedUser));
      setUser(loggedUser);
      router.push("/profile-setup");
      setShowLogin(false);
    } catch (err) {
      console.error("Login error:", err);
      alert("Error logging in.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setUser(null);
  };

  const wards = Nairobi ? Object.keys(Nairobi) : [];
  const areas = selectedWard && Nairobi ? Nairobi[selectedWard] : [];

  return (
    <div className={styles.container}>
      <Head>
        <title>Meet Connect Ladies - For Gentlemen</title>
        <meta
          name="description"
          content="Discover stunning ladies in Nairobi on Meet Connect Ladies, designed for gentlemen."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <h1 onClick={() => router.push('/')} className={styles.title}>
            Meet Connect Ladies ❤️
          </h1>
        </div>
        <div className={styles.authButtons}>
          {!user && (
            <>
              <button onClick={() => setShowRegister(true)} className={styles.button}>
                Register
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className={`${styles.button} ${styles.login}`}
              >
                Login
              </button>
            </>
          )}
          {user && (
            <>
              <button
                onClick={() => router.push('/profile-setup')}
                className={styles.button}
              >
                My Profile
              </button>
              <button onClick={handleLogout} className={`${styles.button} ${styles.logout}`}>
                Logout
              </button>
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search ladies by location (e.g., 'Nairobi', 'Kilimani')..."
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            className={styles.searchInput}
          />
          {filteredLocations.length > 0 && (
            <div className={styles.dropdown}>
              {filteredLocations.map((loc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleLocationSelect(loc.ward, loc.area)}
                  className={styles.dropdownItem}
                >
                  {loc.ward}, {loc.area}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.filters}>
          <select
            value={selectedWard}
            onChange={(e) => {
              setSelectedWard(e.target.value);
              setSelectedArea('');
            }}
            className={styles.select}
          >
            <option value="">All Wards</option>
            {wards.map((ward) => (
              <option key={ward} value={ward}>
                {ward}
              </option>
            ))}
          </select>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className={styles.select}
            disabled={!selectedWard}
          >
            <option value="">All Areas</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.profiles}>
          {searchLocation ? (
            <>
              {groupedProfiles.VIP.length > 0 && (
                <h2 className={styles.sectionTitle}>VIP Ladies</h2>
              )}
              {groupedProfiles.VIP.map((p, i) => (
                <ProfileCard key={i} p={p} router={router} />
              ))}
              {groupedProfiles.Prime.length > 0 && (
                <h2 className={styles.sectionTitle}>Prime Ladies</h2>
              )}
              {groupedProfiles.Prime.map((p, i) => (
                <ProfileCard key={i} p={p} router={router} />
              ))}
              {groupedProfiles.Regular.length > 0 && (
                <h2 className={styles.sectionTitle}>Regular Ladies</h2>
              )}
              {groupedProfiles.Regular.map((p, i) => (
                <ProfileCard key={i} p={p} router={router} />
              ))}
            </>
          ) : (
            filteredProfiles.map((p, i) => <ProfileCard key={i} p={p} router={router} />)
          )}
          {filteredProfiles.length === 0 && (
            <p className={styles.noProfiles}>No ladies found.</p>
          )}
        </div>
      </main>

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
              onChange={(e) =>
                setRegisterForm({ ...registerForm, password: e.target.value })
              }
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
          alt={`${p.name || 'Lady'} Profile`}
          width={150}
          height={150}
          className={styles.profileImage}
        />
      ) : (
        <div className={styles.placeholderImage} />
      )}
      <div className={styles.profileInfo}>
        <h3>{p.name || 'Anonymous Lady'}</h3>
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

