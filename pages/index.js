import { useState, useEffect, useMemo, useCallback, memo, useRef, forwardRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import * as counties from '../data/locations';
import styles from '../styles/Home.module.css';
import { db as firestore } from '../lib/firebase.js';
import { auth } from '../lib/firebase.js';
import { collection, query, orderBy, getDocs, doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { createOrGetChat } from '../lib/chat'; // Import the chat utility

/**
 * Custom hook for debouncing values.
 */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const isProfileComplete = (p) => {
  return (
    p &&
    p.username?.trim() &&
    p.name?.trim() &&
    p.phone?.trim() &&
    p.county?.trim() &&
    p.ward?.trim() &&
    p.area?.trim()
  );
};

const convertTimestamps = (obj) => {
  if (!obj) return obj;
  if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) result[key] = convertTimestamps(obj[key]);
    return result;
  }
  return obj;
};

const sortProfiles = (profiles) => {
  const membershipPriority = { VVIP: 4, VIP: 3, Prime: 2, Regular: 1 };

  const premium = [];
  const regular = [];

  profiles.forEach(p => {
    const mem = p.effectiveMembership;
    if (membershipPriority[mem] > 1) {
      premium.push(p);
    } else {
      regular.push(p);
    }
  });

  // Sort premium: highest tier first, then newest first within tier
  premium.sort((a, b) => {
    const priA = membershipPriority[a.effectiveMembership];
    const priB = membershipPriority[b.effectiveMembership];
    if (priA !== priB) return priB - priA; // Descending priority
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Newest first
  });

  // Sort regular: oldest first (first created at top, newest at bottom)
  regular.sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return [...premium, ...regular];
};

export default function Home({ initialProfiles = [] }) {
  const router = useRouter();
  const [allProfiles, setAllProfiles] = useState(initialProfiles);
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
  const [protectedFeature, setProtectedFeature] = useState('');
  const [pendingPath, setPendingPath] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // New: For pending actions like messaging a specific profile
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const loginModalRef = useRef(null);
  const registerModalRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const allProfilesRef = useRef(allProfiles);
  useEffect(() => { allProfilesRef.current = allProfiles; }, [allProfiles]);

  // Session storage restore
  useEffect(() => {
    const KEY = 'meetconnect_home_state_final_2025';
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Date.now() - parsed.timestamp < 300000) {
          setAllProfiles(sortProfiles(parsed.profiles));
          setTimeout(() => window.scrollTo(0, parsed.scroll), 10);
        } else {
          sessionStorage.removeItem(KEY);
        }
      } catch (e) {
        console.error('Invalid saved state:', e);
        sessionStorage.removeItem(KEY);
      }
    }
  }, []);

  // Save scroll + profiles on navigation
  useEffect(() => {
    const KEY = 'meetconnect_home_state_final_2025';
    const saveState = () => {
      sessionStorage.setItem(KEY, JSON.stringify({
        profiles: allProfilesRef.current,
        scroll: window.scrollY,
        timestamp: Date.now(),
      }));
    };
    router.events.on('routeChangeStart', saveState);
    return () => router.events.off('routeChangeStart', saveState);
  }, [router]);

  // Auth state
  useEffect(() => {
    setUserLoading(true);
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) setUser(JSON.parse(storedUser));
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
              name: currentUser.displayName || currentUser.email.split('@')[0],
              email: currentUser.email,
              username: currentUser.email.split('@')[0],
              membership: 'Regular',
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(firestore, 'profiles', currentUser.uid), basicProfile);
            userData = { id: currentUser.uid, ...basicProfile };
          }
          setUser(userData);
          localStorage.setItem('loggedInUser', JSON.stringify(userData));
        } catch (err) {
          console.error('Error fetching profile:', err);
          setUser({ uid: currentUser.uid, email: currentUser.email });
        }
      } else {
        setUser(null);
        localStorage.removeItem('loggedInUser');
      }
      setUserLoading(false);
    });
    return unsubscribe;
  }, []);

  // Real-time profiles
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = query(collection(firestore, 'profiles'), orderBy('createdAt', 'desc'));
      unsubscribeRef.current = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }));
        const profilesWithEffective = data.map(p => {
          let effective = p.membership || 'Regular';
          if (p.membershipExpiresAt) {
            const expiresAt = new Date(p.membershipExpiresAt);
            if (expiresAt < new Date()) {
              effective = 'Regular';
            }
          }
          return { ...p, effectiveMembership: effective };
        });
        const validProfiles = profilesWithEffective.filter(p => 
          isProfileComplete(p) && 
          p.active !== false && 
          p.hidden !== true
        );
        setAllProfiles(sortProfiles(validProfiles));
        setError(null);
      }, (err) => {
        console.error('Snapshot error:', err);
        setError('Failed to load profiles in real-time. Please refresh.');
      });
    }, 1000);
    return () => {
      clearTimeout(timer);
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  // Location search filtering
  useEffect(() => {
    if (!debouncedSearchLocation) return setFilteredLocations([]);
    const matches = [];
    Object.keys(counties).forEach(county => {
      Object.keys(counties[county]).forEach(ward => {
        counties[county][ward].forEach(area => {
          if (area.toLowerCase().includes(debouncedSearchLocation.toLowerCase()) ||
              ward.toLowerCase().includes(debouncedSearchLocation.toLowerCase()) ||
              county.toLowerCase().includes(debouncedSearchLocation.toLowerCase())) {
            matches.push({ county, ward, area });
          }
        });
      });
    });
    setFilteredLocations(matches.slice(0, 5));
  }, [debouncedSearchLocation]);

  // Auto-set ward or area-based ward if partial match
  useEffect(() => {
    if (!debouncedSearchLocation) {
      setSelectedWard('');
      setSelectedCounty('');
      return;
    }
    const lower = debouncedSearchLocation.trim().toLowerCase();
    let foundWard = null, foundCounty = null;
    Object.keys(counties).some(county => {
      return Object.keys(counties[county]).some(ward => {
        if (ward.toLowerCase().includes(lower)) {
          foundWard = ward;
          foundCounty = county;
          return true;
        }
        if (counties[county][ward].some(area => area.toLowerCase().includes(lower))) {
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
      setFilteredLocations([]);
    }
  }, [debouncedSearchLocation]);

  const handleLocationSelect = (ward, area, county) => {
    setSelectedCounty(county);
    setSelectedWard(ward);
    setSelectedArea(area);
    setSearchLocation(`${county}, ${ward}${area ? `, ${area}` : ''}`);
    setFilteredLocations([]);
  };

  const filteredProfiles = useMemo(() => {
    const searchTerm = debouncedSearchLocation.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
    let filtered = allProfiles.filter(p => {
      const countyMatch = selectedCounty ? p.county === selectedCounty : true;
      const wardMatch = selectedWard ? p.ward === selectedWard : true;
      const areaMatch = selectedArea ? p.area === selectedArea : true;
      const searchMatch = debouncedSearchLocation
        ? [p.county || '', p.ward || '', p.area || '', ...(p.nearby || [])].map(s => s.toLowerCase()).join(' ').includes(searchTerm)
        : true;
      return countyMatch && wardMatch && areaMatch && searchMatch;
    });
    return filtered;
  }, [allProfiles, debouncedSearchLocation, selectedWard, selectedArea, selectedCounty]);

  // Protected navigation (for general paths like /inbox)
  const handleAccessProtected = (path, featureName) => {
    if (user) {
      router.push(path);
    } else {
      setPendingPath(path);
      setProtectedFeature(featureName);
      setShowLogin(true);
    }
  };

  // Specific message handler for a profile
  const handleMessageClick = async (e, profileId) => {
    e.preventDefault();
    e.stopPropagation();
    if (user) {
      try {
        const chatId = await createOrGetChat(user.uid || user.id, profileId);
        router.push(`/inbox/${chatId}`);
      } catch (err) {
        alert('Could not open chat. Try again.');
      }
    } else {
      setPendingAction({ type: 'message', profileId });
      setProtectedFeature('Messaging');
      setShowLogin(true);
    }
  };

  // Google Login/Signup handler
  const handleGoogleAuth = async (customName = '') => {
    setAuthError('');
    setLoginLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const profileDoc = await getDoc(doc(firestore, 'profiles', firebaseUser.uid));
      let profileData;
      let isNewUser = false;
      if (profileDoc.exists()) {
        profileData = { id: profileDoc.id, ...profileDoc.data() };
      } else {
        const basicProfile = {
          uid: firebaseUser.uid,
          name: customName || firebaseUser.displayName || firebaseUser.email.split('@')[0],
          email: firebaseUser.email,
          username: firebaseUser.email.split('@')[0],
          membership: 'Regular',
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(firestore, 'profiles', firebaseUser.uid), basicProfile);
        profileData = { id: firebaseUser.uid, ...basicProfile };
        isNewUser = true;
      }
      localStorage.setItem('loggedInUser', JSON.stringify(profileData));
      setUser(profileData);
      setAuthError('Success!');
      setTimeout(async () => {
        setShowLogin(false);
        setShowRegister(false);
        let target = pendingPath || (isNewUser ? '/profile-setup?t=' + Date.now() : '/');
        if (pendingAction?.type === 'message') {
          try {
            const chatId = await createOrGetChat(firebaseUser.uid, pendingAction.profileId);
            target = `/inbox/${chatId}`;
          } catch (err) {
            alert('Could not open chat after login. Try again.');
          }
        }
        router.push(target);
        setPendingPath(null);
        setPendingAction(null);
        setProtectedFeature('');
        if (isNewUser) {
          setTimeout(() => alert('Welcome! Please complete your profile to appear in searches.'), 800);
        }
      }, 1500);
    } catch (err) {
      console.error('Google auth error:', err);
      let msg = 'Authentication failed. Please try again.';
      switch (err.code) {
        case 'auth/popup-closed-by-user': msg = 'Popup closed. Try again.'; break;
        case 'auth/account-exists-with-different-credential': msg = 'Account exists with different credential.'; break;
        default: msg = 'Something went wrong.';
      }
      setAuthError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoginLoading(true);
    const trimmedEmail = loginForm.email.trim().toLowerCase();
    const trimmedPassword = loginForm.password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setAuthError('Please enter email and password.');
      setLoginLoading(false);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      setLoginLoading(false);
      return;
    }
    try {
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const profileDoc = await getDoc(doc(firestore, 'profiles', firebaseUser.uid));
      let profileData;
      let isNewUser = false;
      if (profileDoc.exists()) {
        profileData = { id: profileDoc.id, ...profileDoc.data() };
      } else {
        const basicProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.email.split('@')[0],
          email: firebaseUser.email,
          username: firebaseUser.email.split('@')[0],
          membership: 'Regular',
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(firestore, 'profiles', firebaseUser.uid), basicProfile);
        profileData = { id: firebaseUser.uid, ...basicProfile };
        isNewUser = true;
      }
      localStorage.setItem('loggedInUser', JSON.stringify(profileData));
      setUser(profileData);
      setAuthError('Login successful!');
      setTimeout(async () => {
        setShowLogin(false);
        let target = pendingPath || '/';
        if (pendingAction?.type === 'message') {
          try {
            const chatId = await createOrGetChat(firebaseUser.uid, pendingAction.profileId);
            target = `/inbox/${chatId}`;
          } catch (err) {
            alert('Could not open chat after login. Try again.');
          }
        }
        router.push(target);
        setPendingPath(null);
        setPendingAction(null);
        setProtectedFeature('');
        if (isNewUser) {
          setTimeout(() => alert('Welcome! Please complete your profile to appear in searches.'), 800);
        }
      }, 1500);
    } catch (err) {
      console.error('Login error:', err);
      let msg = 'Login failed. Please try again.';
      switch (err.code) {
        case 'auth/invalid-credential': msg = 'Wrong email or password.'; break;
        case 'auth/user-not-found': msg = 'No account found. Register first!'; break;
        case 'auth/wrong-password': msg = 'Incorrect password.'; break;
        case 'auth/too-many-requests': msg = 'Too many attempts. Try again later.'; break;
        default: msg = 'Something went wrong. Try again.';
      }
      setAuthError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // Forgot password handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotMessage('');
    setAuthError('');
    setForgotLoading(true);
    const trimmedEmail = forgotEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      setForgotLoading(false);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setForgotMessage('Password reset link sent! Check your email.');
      setTimeout(() => {
        setForgotPasswordMode(false);
        setForgotEmail('');
      }, 3000);
    } catch (err) {
      console.error('Forgot password error:', err);
      let msg = 'Failed to send reset link. Try again.';
      if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
      setAuthError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('loggedInUser');
    await signOut(auth);
  };

  // Close login modal
  const closeLoginModal = () => {
    setShowLogin(false);
    setPendingPath(null);
    setPendingAction(null);
    setProtectedFeature('');
    setForgotPasswordMode(false);
    setForgotEmail('');
    setForgotMessage('');
  };

  // ESC & click outside
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setShowLogin(false);
        setShowRegister(false);
        setPendingPath(null);
        setPendingAction(null);
        setProtectedFeature('');
        setForgotPasswordMode(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (showLogin && loginModalRef.current && !loginModalRef.current.contains(e.target)) closeLoginModal();
      if (showRegister && registerModalRef.current && !registerModalRef.current.contains(e.target)) setShowRegister(false);
    };
    if (showLogin || showRegister) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLogin, showRegister]);

  const countyOptions = Object.keys(counties);
  const wardOptions = selectedCounty && counties[selectedCounty] ? Object.keys(counties[selectedCounty]) : [];
  const areaOptions = selectedCounty && selectedWard && counties[selectedCounty][selectedWard] ? counties[selectedCounty][selectedWard] : [];

  // Handle logo click: Navigate or reload depending on current path
  const handleLogoClick = () => {
    if (router.pathname === '/') {
      window.location.reload();
    } else {
      router.push('/');
    }
  };

  const ProfileCard = memo(({ p }) => {
    if (!p?.username?.trim()) return null;

    const handlePhoneClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `tel:${p.phone}`;
    };

    const defaultSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iNjAiIHI9IjUwIiBmaWxsPSIjQkRCREJEIiAvPgogIDxwYXRoIGQ9Ik01MCAxNTAgUTEwMCAxMTAgMTUwIDE1NCBRMTUwIDIwMCA1MCAyMDAgWiIgZmlsbD0iI0JEQkRCRCIgLz4KPC9zdmc+Cg==';
    const blurData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8Alt4mM5mC4RnhUFm0GM1iWySHWP/AEYX/xAAUEQEAAAAAAAAAAAAAAAAAAAAQ/9oADAMBAAIAAwAAABAL/ztt/8QAGxABAAIDAQAAAAAAAAAAAAAAAQACEhEhMVGh/9oACAEBAAE/It5l0M8wCjQ7Yg6Q6q5h8V4f/2gAIAQMBAT8B1v/EABYRAQEBAAAAAAAAAAAAAAAAAAERIf/aAAgBAgEBPwGG/8QAJBAAAQMCAwQDAAAAAAAAAAAAAAARECEiIxQQNRYXGRsfgZH/2gAIAQEABj8C4yB5W9w0rY4S5x2mY0g1j0lL8Z6W/9oADAMBAAIAAwAAABDUL/zlt/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPxAX/8QAFxEBAAMAAAAAAAAAAAAAAAAAAAARIf/aAAgBAgEBPxBIf//EAB0QAQEAAgIDAAAAAAAAAAAAAAERACExQVFhcYGR/9oADABGAAMAAAAK4nP/2gAIAQMBAT8Q1v/EABkRAAMBAQEAAAAAAAAAAAAAAAEAESExQVFx/9oACAECAQE/EMkY6H/8QAJxAAAQQCAwADAAAAAAAAAAAAAAARESExQVFhcYHh8EHR0f/aAAwDAQACEAMAAAAQ+9P/2gAIAQMBAT8Q4v/EABkRAQADAQEAAAAAAAAAAAAAAAEAESExQVFx/9oACAECAQE/EMkY6H/xAAaEAEAAwEBAQAAAAAAAAAAAAABAhEhMUFRwdHw/9oADABGAAMAABAMG1v/2Q==";
    const hasCustomPic = !!p.profilePic;

    const isOwnProfile = user && (p.id === user.id || p.id === user.uid);

    return (
      <Link href={`/view-profile/${p.id}`} className={styles.profileLink}>
        <div className={styles.profileCard} role="listitem">
          <div className={styles.imageContainer}>
            <Image
              src={hasCustomPic ? p.profilePic : defaultSrc}
              alt={`${p.name} Profile`}
              width={150}
              height={150}
              className={styles.profileImage}
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 150px"
              quality={75}
              placeholder={hasCustomPic ? "blur" : "empty"}
              blurDataURL={hasCustomPic ? blurData : undefined}
            />
            {p.verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
          </div>
          <div className={styles.profileInfo}>
            <h3>{p.name}</h3>
            {p.effectiveMembership && p.effectiveMembership !== 'Regular' && (
              <span className={`${styles.badge} ${styles[p.effectiveMembership.toLowerCase()]}`}>{p.effectiveMembership}</span>
            )}
          </div>
          <p className={styles.location}>{p.ward.toLowerCase()}/{p.area.toLowerCase()}</p>
          <div className={styles.profileSummary}>
            <p>{p.age} year old {p.gender.toLowerCase()}</p>
            <p>from {p.ward}, {p.county} in {p.area}</p>
          </div>
          {!isOwnProfile && (
            <button 
              className={styles.messageButton}
              onClick={(e) => handleMessageClick(e, p.id)}
            >
              💬 Send Message
            </button>
          )}
          {p.phone && (
            <p>
              <span className={styles.phoneLink} onClick={handlePhoneClick}>{p.phone}</span>
            </p>
          )}
        </div>
      </Link>
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

  if (userLoading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.logoContainer}>
            <h1 onClick={handleLogoClick} className={styles.title}> Meet Connect </h1>
          </div>
          <div className={styles.authButtons}>
            <button className={`${styles.button} ${styles.login}`}>Login</button>
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.searchContainer}>
            <input type="text" placeholder="Search ladies by location..." className={styles.searchInput} disabled />
          </div>
          <div className={styles.filters}>
            <select className={styles.select} disabled><option>All Counties</option></select>
            <select className={styles.select} disabled><option>All Wards</option></select>
            <select className={styles.select} disabled><option>All Areas</option></select>
          </div>
          <div className={styles.profiles} role="list">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonImage}></div>
                <div className={styles.skeletonInfo}>
                  <div className={styles.skeletonText}></div>
                  <div className={styles.skeletonTextSmall}></div>
                </div>
              </div>
            ))}
          </div>
        </main>
        <footer className={styles.footer}>
          <div className={styles.footerLinks}>
            <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Meet Connect Ladies - For Gentlemen</title>
        <meta name="description" content="Discover stunning ladies across Kenya on Meet Connect Ladies, designed for gentlemen seeking meaningful connections." />
        <meta name="keywords" content="dating Kenya, ladies Nairobi, meet connect, gentlemen profiles" />
        <meta property="og:title" content="Meet Connect Ladies - For Gentlemen" />
        <meta property="og:description" content="Connect with elegant ladies across Kenya." />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://yourdomain.com" />
      </Head>
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <h1 onClick={handleLogoClick} className={styles.title}> Meet Connect </h1>
        </div>
        <div className={styles.authButtons}>
          <button onClick={() => handleAccessProtected('/inbox', 'Inbox')} className={styles.button}>
            Inbox
          </button>
          {user ? (
            <>
              <Link href="/profile-setup">
                <button className={styles.button}>My Profile</button>
              </Link>
            </>
          ) : (
            <>
              <button onClick={() => { setPendingPath(null); setShowLogin(true); }} className={styles.callButton}>
                Login
              </button>
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
            onChange={e => setSearchLocation(e.target.value)}
            className={styles.searchInput}
            aria-label="Search by location"
            style={{
              backgroundColor: "#ffffff",
              color: "#000000",
              WebkitTextFillColor: "#000000",
              colorScheme: "light"
            }}
          />
        </div>
        <div className={styles.filters}>
          <select value={selectedCounty} onChange={e => { setSelectedCounty(e.target.value); setSelectedWard(''); setSelectedArea(''); }} className={styles.select}>
            <option value="">All Counties</option>
            {countyOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={selectedWard} onChange={e => { setSelectedWard(e.target.value); setSelectedArea(''); }} className={styles.select} disabled={!selectedCounty}>
            <option value="">All Wards</option>
            {wardOptions.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)} className={styles.select} disabled={!selectedWard}>
            <option value="">All Areas</option>
            {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className={styles.profiles} role="list">
          {filteredProfiles.map(p => <ProfileCard key={p.id} p={p} />)}
          {error && <p className={styles.noProfiles} style={{color:'red'}}>{error}</p>}
          {filteredProfiles.length === 0 && !error && (
            <p className={styles.noProfiles}>No ladies found. Complete your profile to appear in searches.</p>
          )}
        </div>
      </main>
      {showLogin && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={closeLoginModal}>
          <div style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '40px 30px', boxShadow: '0 8px 15px rgba(0, 0, 0, 0.2)', textAlign: 'center', width: '100%', maxWidth: '380px', color: '#333', position: 'relative' }} onClick={e => e.stopPropagation()} >
            <span style={{ position: 'absolute', top: '10px', right: '20px', fontSize: '24px', cursor: 'pointer', color: '#ff69b4' }} onClick={closeLoginModal}>×</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '20px', color: '#ff69b4' }}>{forgotPasswordMode ? 'Reset Password' : 'Welcome Back'}</h2>
            {protectedFeature && !forgotPasswordMode && (
              <p style={{color:'#ff69b4',fontWeight:'bold',textAlign:'center',margin:'0 0 15px 0'}}>
                Please login to access {protectedFeature}
              </p>
            )}
            {!forgotPasswordMode ? (
              <>
                <button onClick={handleGoogleAuth} disabled={loginLoading} style={{ width: '100%', background: 'linear-gradient(115deg, #4285f4, #db4437)', border: 'none', padding: '12px 16px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: loginLoading ? 'not-allowed' : 'pointer', transition: 'transform 0.2s ease, box-shadow 0.3s ease', marginBottom: '20px' }} onMouseOver={(e) => !loginLoading && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 15px rgba(0,0,0,0.2)')} onMouseOut={(e) => !loginLoading && (e.target.style.transform = '', e.target.style.boxShadow = '') }>
                  {loginLoading ? 'Authenticating...' : 'Continue with Google'}
                </button>
                <p style={{ margin: '10px 0', color: '#666' }}>or</p>
                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                    <label style={{ fontWeight: 400, marginBottom: '8px', display: 'block', fontSize: '0.9rem', color: '#444' }}>Email Address</label>
                    <input type="email" placeholder="you@example.com" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} required disabled={loginLoading} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)', transition: 'border 0.3s, box-shadow 0.3s' }} onFocus={(e) => { e.target.style.border = '1px solid #ff69b4'; e.target.style.boxShadow = '0 0 8px rgba(255,105,180,0.5)'; }} onBlur={(e) => { e.target.style.border = '1px solid #ddd'; e.target.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.1)'; }} />
                  </div>
                  <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                    <label style={{ fontWeight: 400, marginBottom: '8px', display: 'block', fontSize: '0.9rem', color: '#444' }}>Password</label>
                    <input type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required disabled={loginLoading} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)', transition: 'border 0.3s, box-shadow 0.3s' }} onFocus={(e) => { e.target.style.border = '1px solid #ff69b4'; e.target.style.boxShadow = '0 0 8px rgba(255,105,180,0.5)'; }} onBlur={(e) => { e.target.style.border = '1px solid #ddd'; e.target.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.1)'; }} />
                  </div>
                  {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{authError}</p>}
                  <button type="submit" disabled={loginLoading} style={{ width: '100%', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', border: 'none', padding: '12px 16px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: loginLoading ? 'not-allowed' : 'pointer', transition: 'transform 0.2s ease, box-shadow 0.3s ease' }} onMouseOver={(e) => !loginLoading && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 15px rgba(0,0,0,0.2)')} onMouseOut={(e) => !loginLoading && (e.target.style.transform = '', e.target.style.boxShadow = '') }>
                    {loginLoading ? 'Logging in...' : 'Login'}
                  </button>
                  <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#444' }}>
                    <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setForgotPasswordMode(true)}>Forgot Password?</span>
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#444' }}>
                    Don't have an account? <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setShowLogin(false); setTimeout(() => setShowRegister(true), 100); }}>Create New Account</span>
                  </div>
                </form>
              </>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <label style={{ fontWeight: 400, marginBottom: '8px', display: 'block', fontSize: '0.9rem', color: '#444' }}>Email Address</label>
                  <input type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required disabled={forgotLoading} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)', transition: 'border 0.3s, box-shadow 0.3s' }} onFocus={(e) => { e.target.style.border = '1px solid #ff69b4'; e.target.style.boxShadow = '0 0 8px rgba(255,105,180,0.5)'; }} onBlur={(e) => { e.target.style.border = '1px solid #ddd'; e.target.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.1)'; }} />
                </div>
                {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{authError}</p>}
                {forgotMessage && <p style={{ color: '#388e3c', background: '#e8f5e9', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{forgotMessage}</p>}
                <button type="submit" disabled={forgotLoading} style={{ width: '100%', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', border: 'none', padding: '12px 16px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: forgotLoading ? 'not-allowed' : 'pointer', transition: 'transform 0.2s ease, box-shadow 0.3s ease' }} onMouseOver={(e) => !forgotLoading && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 15px rgba(0,0,0,0.2)')} onMouseOut={(e) => !forgotLoading && (e.target.style.transform = '', e.target.style.boxShadow = '') }>
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#444' }}>
                  <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setForgotPasswordMode(false)}>Back to Login</span>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {showRegister && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowRegister(false)}>
          <div style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '40px 30px', boxShadow: '0 8px 15px rgba(0, 0, 0, 0.2)', textAlign: 'center', width: '100%', maxWidth: '380px', color: '#333', position: 'relative' }} onClick={e => e.stopPropagation()} >
            <span style={{ position: 'absolute', top: '10px', right: '20px', fontSize: '24px', cursor: 'pointer', color: '#ff69b4' }} onClick={() => setShowRegister(false)}>×</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '20px', color: '#ff69b4' }}>Create Account</h2>
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <label style={{ fontWeight: 400, marginBottom: '8px', display: 'block', fontSize: '0.9rem', color: '#444' }}>Full Name</label>
              <input type="text" placeholder="Full Name" value={registerForm.name} onChange={e => setRegisterForm({...registerForm, name: e.target.value})} required style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)', transition: 'border 0.3s, box-shadow 0.3s' }} onFocus={(e) => { e.target.style.border = '1px solid #ff69b4'; e.target.style.boxShadow = '0 0 8px rgba(255,105,180,0.5)'; }} onBlur={(e) => { e.target.style.border = '1px solid #ddd'; e.target.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.1)'; }} />
            </div>
            <button onClick={() => handleGoogleAuth(registerForm.name)} disabled={loginLoading} style={{ width: '100%', background: 'linear-gradient(115deg, #4285f4, #db4437)', border: 'none', padding: '12px 16px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: loginLoading ? 'not-allowed' : 'pointer', transition: 'transform 0.2s ease, box-shadow 0.3s ease', marginBottom: '20px' }} onMouseOver={(e) => !loginLoading && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 15px rgba(0,0,0,0.2)')} onMouseOut={(e) => !loginLoading && (e.target.style.transform = '', e.target.style.boxShadow = '') }>
              {loginLoading ? 'Authenticating...' : 'Continue with Google'}
            </button>
            {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{authError}</p>}
          </div>
        </div>
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

export async function getStaticProps() {
  let initialProfiles = [];
  try {
    const q = query(collection(firestore, 'profiles'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    let profiles = snapshot.docs
      .map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }))
      .filter(p => isProfileComplete(p) && p.active !== false && p.hidden !== true);
    const profilesWithEffective = profiles.map(p => {
      let effective = p.membership || 'Regular';
      if (p.membershipExpiresAt) {
        const expiresAt = new Date(p.membershipExpiresAt);
        if (expiresAt < new Date()) {
          effective = 'Regular';
        }
      }
      return { ...p, effectiveMembership: effective };
    });
    initialProfiles = sortProfiles(profilesWithEffective);
  } catch (err) {
    console.error('Error fetching homepage profiles:', err);
  }
  return {
    props: { initialProfiles },
    revalidate: 60,
  };
}