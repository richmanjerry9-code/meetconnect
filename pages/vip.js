// vip.js
import { useState, useEffect, useMemo, useCallback, memo, useRef, forwardRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import * as Counties from '../data/locations';
import styles from '../styles/Home.module.css';
import { db as firestore } from '../lib/firebase.js';
import { auth } from '../lib/firebase.js';
import { collection, query, orderBy, limit, getDocs, startAfter, doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const isProfileComplete = (p) => {
  return (
    p &&
    p.username &&
    p.username.trim() !== '' &&
    p.name &&
    p.name.trim() !== '' &&
    p.profilePic &&
    p.profilePic.trim() !== '' &&
    p.county &&
    p.county.trim() !== '' &&
    p.ward &&
    p.ward.trim() !== '' &&
    p.area &&
    p.area.trim() !== ''
  );
};

export default function Vip({ initialProfiles = [] }) {
  const router = useRouter();
  const [allProfiles, setAllProfiles] = useState(initialProfiles);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const debouncedSearchLocation = useDebounce(searchLocation, 300);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const loginModalRef = useRef(null);
  const registerModalRef = useRef(null);
  const sentinelRef = useRef(null);
  const cacheRef = useRef(new Map());
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    setUserLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const profileDoc = await getDoc(doc(firestore, 'profiles', currentUser.uid));
          let userData;
          if (profileDoc.exists()) {
            userData = { id: profileDoc.id, ...profileDoc.data() };
          } else {
            const basicProfile = {
              uid: currentUser.uid,
              name: currentUser.email.split('@')[0],
              email: currentUser.email,
              username: currentUser.email.split('@')[0],
              membership: 'Regular',
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(firestore, 'profiles', currentUser.uid), basicProfile);
            userData = { id: currentUser.uid, ...basicProfile };
          }
          setUser(userData);
        } catch (err) {
          console.error('Error fetching profile:', err);
          setUser({ uid: currentUser.uid, email: currentUser.email });
        }
      } else {
        setUser(null);
      }
      setUserLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(
      collection(firestore, 'profiles'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const profileData = doc.data();
        if (profileData.createdAt && profileData.createdAt.toDate) {
          profileData.createdAt = profileData.createdAt.toDate().toISOString();
        }
        return { id: doc.id, ...profileData };
      });
      const validProfiles = data.filter(isProfileComplete);
      setAllProfiles(validProfiles);
      setLastDoc(snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null);
      setHasMore(snapshot.size === 100);
      setError(null);
    }, (err) => {
      console.error('Snapshot error:', err);
      setError('Failed to load profiles in real-time. Please refresh.');
    });
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const loadMoreProfiles = useCallback(async () => {
    if (isLoadingMore || !hasMore || !lastDoc) return;
    const cacheKey = `profiles_loadmore_${lastDoc.id}`;
    if (cacheRef.current.has(cacheKey) ) {
      const cachedData = cacheRef.current.get(cacheKey);
      setAllProfiles(prev => [...prev, ...cachedData.profiles]);
      setLastDoc(cachedData.lastDoc);
      setHasMore(cachedData.hasMore);
      setIsLoadingMore(false);
      return;
    }
    setError(null);
    setIsLoadingMore(true);
    try {
      const q = query(
        collection(firestore, 'profiles'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const profileData = doc.data();
        if (profileData.createdAt && profileData.createdAt.toDate) {
          profileData.createdAt = profileData.createdAt.toDate().toISOString();
        }
        return { id: doc.id, ...profileData };
      });
      const validProfiles = data.filter(isProfileComplete);
      setAllProfiles(prev => [...prev, ...validProfiles]);
      setLastDoc(snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null);
      setHasMore(snapshot.size === 20);
      cacheRef.current.set(cacheKey, { 
        profiles: validProfiles, 
        lastDoc: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null, 
        hasMore: snapshot.size === 20 
      });
    } catch (err) {
      console.error('Error fetching more profiles:', err);
      setError('Failed to load more profiles. Please try scrolling again.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, lastDoc]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          loadMoreProfiles();
        }
      },
      { threshold: 0 }
    );
    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }
    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, isLoadingMore, loadMoreProfiles]);

  useEffect(() => {
    if (!debouncedSearchLocation || !Counties) return setFilteredLocations([]);
    const matches = [];
    Object.keys(Counties).forEach((county) => {
      Object.keys(Counties[county]).forEach((ward) => {
        Counties[county][ward].forEach((area) => {
          if (
            area.toLowerCase().includes(debouncedSearchLocation.toLowerCase()) ||
            ward.toLowerCase().includes(debouncedSearchLocation.toLowerCase()) ||
            county.toLowerCase().includes(debouncedSearchLocation.toLowerCase())
          ) {
            matches.push({ county, ward, area });
          }
        });
      });
    });
    setFilteredLocations(matches.slice(0, 5));
  }, [debouncedSearchLocation]);

  useEffect(() => {
    if (!debouncedSearchLocation) {
      setSelectedWard('');
      setSelectedCounty('');
      return;
    }
    const lowerSearch = debouncedSearchLocation.trim().toLowerCase();
    let foundWard = null;
    let foundCounty = null;
    Object.keys(Counties).some((county) => {
      return Object.keys(Counties[county]).some((ward) => {
        if (ward.toLowerCase() === lowerSearch) {
          foundWard = ward;
          foundCounty = county;
          return true;
        }
        return false;
      });
    });
    if (foundWard && foundCounty) {
      setSelectedCounty(foundCounty);
      setSelectedWard(foundWard);
      setSelectedArea('');
      setSearchLocation(`${foundCounty}, ${foundWard}`);
      setFilteredLocations([]);
    }
  }, [debouncedSearchLocation]);

  const handleLocationSelect = (ward, area, county) => {
    setSelectedCounty(county);
    setSelectedWard(ward);
    setSelectedArea(area);
    setSearchLocation(`${county}, ${ward}, ${area}`);
    setFilteredLocations([]);
  };

  const membershipPriority = useMemo(() => ({ VVIP: 4, VIP: 3, Prime: 2, Regular: 1 }), []);

  const filteredProfiles = useMemo(() => {
    const searchTerm = debouncedSearchLocation.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
    let filtered = allProfiles.filter((p) => {
      const countyMatch = selectedCounty ? p.county === selectedCounty : true;
      const wardMatch = selectedWard ? p.ward === selectedWard : true;
      const areaMatch = selectedArea ? p.area === selectedArea : true;
      const searchMatch = debouncedSearchLocation
        ? [p.county || '', p.ward || '', p.area || '', ...(p.nearby || [])]
          .map(s => s.toLowerCase())
          .join(' ')
          .includes(searchTerm)
        : true;
      const membershipMatch = p.membership === 'VIP';
      return countyMatch && wardMatch && areaMatch && searchMatch && membershipMatch;
    });
    filtered.sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return bDate - aDate;
    });
    return filtered;
  }, [allProfiles, debouncedSearchLocation, selectedWard, selectedArea, selectedCounty]);

  const validateForm = (form, isRegister = false) => {
    if (isRegister) {
      if (!form.name?.trim()) return 'Please enter your full name.';
      if (!form.email?.trim()) return 'Please enter your email.';
      if (form.email && !/\S+@\S+\.\S+/.test(form.email)) return 'Please enter a valid email.';
      if (!form.password?.trim()) return 'Please enter a password.';
      if (form.password.length < 8) return 'Password must be at least 8 characters.';
    } else {
      if (!form.email?.trim()) return 'Please enter your email.';
      if (form.email && !/\S+@\S+\.\S+/.test(form.email)) return 'Please enter a valid email.';
      if (!form.password?.trim()) return 'Please enter your password.';
      if (form.password.length < 6) return 'Password must be at least 6 characters.';
    }
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    const validationError = validateForm(registerForm, true);
    if (validationError) {
      setAuthError(validationError);
      return;
    }
    try {
      const { user } = await createUserWithEmailAndPassword(auth, registerForm.email, registerForm.password);
      const newUserProfile = {
        uid: user.uid,
        name: registerForm.name,
        email: registerForm.email,
        username: registerForm.email.split('@')[0],
        membership: 'Regular',
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(firestore, 'profiles', user.uid), newUserProfile);
      const fullUser = { id: user.uid, ...newUserProfile };
      localStorage.setItem('loggedInUser', JSON.stringify(fullUser));
      setUser(fullUser);
      setAuthError(' Registration successful!');
      setTimeout(() => {
        router.push({ pathname: '/profile-setup', query: { t: Date.now() } });
        setShowRegister(false);
      }, 1500);
    } catch (err) {
      console.error('Registration error:', err);
      setAuthError(err.code === 'auth/email-already-in-use' ? 'Email already registered!' : 'Error during registration. Try again.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoginLoading(true);
    const { email, password } = loginForm;
    if (!email || !password) {
      setAuthError('Please enter email and password.');
      setLoginLoading(false);
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      setLoginLoading(false);
      return;
    }
    if (trimmedPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      setLoginLoading(false);
      return;
    }
    try {
      const { user } = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const profileDoc = await getDoc(doc(firestore, 'profiles', user.uid));
      let profileData;
      if (profileDoc.exists()) {
        profileData = { id: profileDoc.id, ...profileDoc.data() };
      } else {
        const basicProfile = {
          uid: user.uid,
          name: user.email.split('@')[0],
          email: user.email,
          username: user.email.split('@')[0],
          membership: 'Regular',
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(firestore, 'profiles', user.uid), basicProfile);
        profileData = { id: user.uid, ...basicProfile };
        alert('Welcome back! Quick setup needed—let\'s add your details.');
      }
      localStorage.setItem('loggedInUser', JSON.stringify(profileData));
      setUser(profileData);
      setAuthError('Login successful!');
      setTimeout(() => {
        router.push({ pathname: '/profile-setup', query: { t: Date.now() } });
        setShowLogin(false);
      }, 1500);
    } catch (err) {
      console.error('Login error details:', err.code, err.message);
      let userMessage = 'Login failed. Please try again.';
      switch (err.code) {
        case 'auth/invalid-credential':
          userMessage = 'Oops! Wrong email or password. Double-check and try again.';
          break;
        case 'auth/user-not-found':
          userMessage = 'No account here yet. Hit Register to join the fun!';
          break;
        case 'auth/wrong-password':
          userMessage = 'Password doesn\'t match. Forgot it? We can add reset later.';
          break;
        case 'auth/invalid-email':
          userMessage = 'That email looks funny—try again?';
          break;
        case 'auth/too-many-requests':
          userMessage = 'Whoa, too many tries! Wait a bit or use a different email.';
          break;
        case 'auth/network-request-failed':
          userMessage = 'Spotty connection? Check WiFi and retry.';
          break;
        default:
          userMessage = 'Something wiggly—try refresh or email support@yourapp.com.';
      }
      setAuthError(userMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('loggedInUser');
    await signOut(auth);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowLogin(false);
        setShowRegister(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showLogin && loginModalRef.current && !loginModalRef.current.contains(e.target)) {
        setShowLogin(false);
      }
      if (showRegister && registerModalRef.current && !registerModalRef.current.contains(e.target)) {
        setShowRegister(false);
      }
    };
    if (showLogin || showRegister) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogin, showRegister]);

  const countyOptions = Object.keys(Counties);
  const wardOptions = selectedCounty && Counties[selectedCounty] ? Object.keys(Counties[selectedCounty]) : [];
  const areaOptions = selectedCounty && selectedWard && Counties[selectedCounty][selectedWard] ? Counties[selectedCounty][selectedWard] : [];

  if (userLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Meet Connect Ladies - VIP</title>
        <meta
          name="description"
          content="Discover VIP ladies across Kenya on Meet Connect Ladies."
        />
        <meta name="keywords" content="dating Kenya, ladies Nairobi, meet connect, gentlemen profiles" />
        <meta property="og:title" content="Meet Connect Ladies - VIP" />
        <meta property="og:description" content="Connect with VIP ladies across Kenya." />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://yourdomain.com/vip" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <h1 onClick={() => router.push('/')} className={styles.title}>
            Meet Connect 
          </h1>
        </div>
        <div className={styles.nav}>
          <Link href="/vvip">VVIP</Link>
          <Link href="/vip">VIP</Link>
          <Link href="/prime">Prime</Link>
        </div>
        <div className={styles.authButtons}>
          {!user && (
            <>
              <button onClick={() => setShowRegister(true)} className={styles.button}>Register</button>
              <button onClick={() => setShowLogin(true)} className={`${styles.button} ${styles.login}`}>Login</button>
            </>
          )}
          {user && (
            <>
              <button onClick={() => router.push({ pathname: '/profile-setup', query: { t: Date.now() } })} className={styles.button}>My Profile</button>
              <button onClick={handleLogout} className={`${styles.button} ${styles.logout}`}>Logout</button>
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search ladies by location (e.g., 'Kilimani', 'Busia')..."
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            className={styles.searchInput}
            aria-label="Search by location"
          />
          {filteredLocations.length > 0 && (
            <div className={styles.dropdown} role="listbox">
              {filteredLocations.map((loc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleLocationSelect(loc.ward, loc.area, loc.county)}
                  className={styles.dropdownItem}
                  role="option"
                  aria-selected="false"
                >
                  {loc.county}, {loc.ward}, {loc.area}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.filters}>
          <select
            value={selectedCounty}
            onChange={(e) => {
              setSelectedCounty(e.target.value);
              setSelectedWard('');
              setSelectedArea('');
            }}
            className={styles.select}
            aria-label="Select County"
          >
            <option value="">All Counties</option>
            {countyOptions.map((county) => (
              <option key={county} value={county}>{county}</option>
            ))}
          </select>

          <select
            value={selectedWard}
            onChange={(e) => {
              setSelectedWard(e.target.value);
              setSelectedArea('');
            }}
            className={styles.select}
            disabled={!selectedCounty}
            aria-label="Select Ward"
          >
            <option value="">All Wards</option>
            {wardOptions.map((ward) => (
              <option key={ward} value={ward}>{ward}</option>
            ))}
          </select>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className={styles.select}
            disabled={!selectedWard}
            aria-label="Select Area"
          >
            <option value="">All Areas</option>
            {areaOptions.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>

        <div className={styles.profiles} role="list">
          {filteredProfiles.map((p) => <ProfileCard key={p.id} p={p} router={router} />)}
          {error && <p className={styles.noProfiles} style={{ color: 'red' }}>{error}</p>}
          {isLoadingMore && (
            <>
              <p className={styles.noProfiles}>Loading more profiles...</p>
              {[1,2,3].map((i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonImage}></div>
                  <div className={styles.skeletonInfo}>
                    <div className={styles.skeletonText}></div>
                    <div className={styles.skeletonTextSmall}></div>
                  </div>
                </div>
              ))}
            </>
          )}
          {filteredProfiles.length === 0 && !isLoadingMore && !error && (
            <p className={styles.noProfiles}>
              No ladies found in this tier. Try a different location or view other tiers.
            </p>
          )}
          {hasMore && <div ref={sentinelRef} style={{ height: '1px' }} />}
        </div>
      </main>

      {showLogin && (
        <Modal title="Login" onClose={() => setShowLogin(false)} ref={loginModalRef}>
          <form onSubmit={handleLogin}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="Email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              className={styles.input}
              required
              disabled={loginLoading}
            />
            <label htmlFor="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              className={styles.input}
              required
              disabled={loginLoading}
            />
            {authError && <p className={styles.error}>{authError}</p>}
            <button type="submit" className={styles.button} disabled={loginLoading}>
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </Modal>
      )}

      {showRegister && (
        <Modal title="Register" onClose={() => setShowRegister(false)} ref={registerModalRef}>
          <form onSubmit={handleRegister}>
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              placeholder="Full Name"
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              className={styles.input}
              required
            />
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              placeholder="Email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              className={styles.input}
              required
            />
            <label htmlFor="reg-password">Password</label>
            <input
              type="password"
              id="reg-password"
              placeholder="Password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
              className={styles.input}
              required
              minLength={8}
            />
            {authError && <p className={styles.error}>{authError}</p>}
            <button type="submit" className={styles.button}>Register</button>
          </form>
        </Modal>
      )}

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
          <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}

const ProfileCard = memo(({ p, router }) => {
  const { username = '', profilePic = null, name = 'Anonymous Lady', membership = 'Regular', verified = false, area = '', ward = '', county = 'Nairobi', services = [], phone = '' } = p;
  const handleClick = () => {
    if (!username || username.trim() === '') {
      console.warn('Skipping click: Missing username for profile:', p.id);
      return;
    }
    router.push(`/view-profile/${encodeURIComponent(username)}`);
  };
  const handleImageError = (e) => {
    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVlZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMSIvPjxjaXJjbGUgY3g9Ijc1IiBjeT0iNTAiIHI9IjMwIiBmaWxsPSIjZWRlZGUiLz48dGV4dCB4PSI3NSIgWT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk1pc3NpbmcgUGljPC90ZXh0Pjwvc3ZnPg==';
  };
  const locationDisplay = ward ? `${ward} (${area || 'All Areas'})` : (area || county || 'Location TBD');
  return (
    <div className={styles.profileCard} onClick={handleClick} role="listitem">
      <div className={styles.imageContainer}>
        <Image 
          src={profilePic || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVlZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMSIvPjxjaXJjbGUgY3g9Ijc1IiBjeT0iNTAiIHI9IjMwIiBmaWxsPSIjZWRlZGUiLz48dGV4dCB4PSI3NSIgWT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIFBpYzwvdGV4dD48L3N2Zz4='} 
          alt={`${name} Profile`} 
          width={150} 
          height={150} 
          className={styles.profileImage}
          loading="lazy"
          sizes="(max-width: 768px) 100vw, 150px"
          quality={75}
          onError={handleImageError}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8Alt4mM5mC4RnhUFm0GM1iWySHWP/AEYX/xAAUEQEAAAAAAAAAAAAAAAAAAAAQ/9oADAMBAAIAAwAAABAL/ztt/8QAGxABAAIDAQAAAAAAAAAAAAAAAQACEhEhMVGh/9oACAEBAAE/It5l0M8wCjQ7Yg6Q6q5h8V4f/2gAIAQMBAT8B1v/EABYRAQEBAAAAAAAAAAAAAAAAAAERIf/aAAgBAgEBPwGG/8QAJBAAAQMCAwQDAAAAAAAAAAAAAAARECEiIxQQNRYXGRsfgZH/2gAIAQEABj8C4yB5W9w0rY4S5x2mY0g1j0lL8Z6W/9oADAMBAAIAAwAAABDUL/zlt/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPxAX/8QAFxEBAAMAAAAAAAAAAAAAAAAAAAARIf/aAAgBAgEBPxBIf//EAB0QAQEAAgIDAAAAAAAAAAAAAAERACExQVFhcYGR/9oADABGAAMAAAAK4nP/2gAIAQMBAT8Q1v/EABkRAAMBAQEAAAAAAAAAAAAAAABESEhQdHw/9oACAECAQE/EMkY6H/8QAJxAAAQQCAwADAAAAAAAAAAAAAAARESExQVFhcYHh8EHR0f/aAAwDAQACEAMAAAAQ+9P/2gAIAQMBAT8Q4v/EABkRAQADAQEAAAAAAAAAAAAAAAEAESExQVFx/9oACAECAQE/EMkY6H/xAAaEAEAAwEBAQAAAAAAAAAAAAABAhEhMUFRwdHw/9oADABGAAMAABAMG1v/2Q==" 
        />
        {verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
      </div>
      <div className={styles.profileInfo}>
        <h3>{name}</h3>
        {membership && membership !== 'Regular' && (
          <span className={`${styles.badge} ${styles[membership.toLowerCase()]}`}>{membership}</span>
        )}
      </div>
      <p className={styles.location}>{locationDisplay}</p>
      {services && services.length > 0 && (
        <div className={styles.services}>
          {services.slice(0, 3).map((s, idx) => (
            <span key={idx} className={styles.serviceTag}>{s}</span>
          ))}
        </div>
      )}
      {phone && (
        <p><a href={`tel:${phone}`} className={styles.phoneLink}>{phone}</a></p>
      )}
    </div>
  );
});

ProfileCard.displayName = 'ProfileCard';

const Modal = forwardRef(({ children, title, onClose }, ref) => (
  <div className={styles.modal} ref={ref}>
    <div className={styles.modalContent}>
      <h2>{title}</h2>
      <span onClick={onClose} className={styles.close} role="button" aria-label="Close modal">×</span>
      {children}
    </div>
  </div>
));

Modal.displayName = 'Modal';

export async function getStaticProps() {
  let initialProfiles = [];
  try {
    const q = query(
      collection(firestore, 'profiles'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(q);
    initialProfiles = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        if (data.createdAt && data.createdAt.toDate) {
          data.createdAt = data.createdAt.toDate().toISOString();
        }
        return { id: doc.id, ...data };
      })
      .filter(isProfileComplete);
  } catch (err) {
    console.error('Error fetching initial profiles:', err);
  }
  return {
    props: { initialProfiles },
    revalidate: 60,
  };
}