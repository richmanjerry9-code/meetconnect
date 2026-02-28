import { useState, useEffect, useMemo, useCallback, memo, useRef, forwardRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import * as counties from '../data/locations';
import styles from '../styles/Home.module.css';
import { db as firestore } from '../lib/firebase.js';
import { auth } from '../lib/firebase.js';
import { collection, query, orderBy, getDocs, doc, setDoc, getDoc, serverTimestamp, onSnapshot, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { createOrGetChat } from '../lib/chat';

// ─── GLOBAL PAGE LOADING INDICATOR ────────────────────────────────────────────
const GlobalLoadingBar = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const start = () => {
      setLoading(true);
      setProgress(10);
      timerRef.current = setInterval(() => {
        setProgress(p => (p < 85 ? p + Math.random() * 8 : p));
      }, 300);
    };
    const done = () => {
      clearInterval(timerRef.current);
      setProgress(100);
      setTimeout(() => { setLoading(false); setProgress(0); }, 400);
    };
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError', done);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError', done);
      clearInterval(timerRef.current);
    };
  }, [router]);

  if (!loading) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, zIndex: 9999,
      width: `${progress}%`, height: '3px',
      background: 'linear-gradient(90deg, #ff69b4, #ff1493)',
      transition: 'width 0.3s ease',
      boxShadow: '0 0 8px rgba(255,105,180,0.7)',
    }} />
  );
};

// ─── SKELETON CARD ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className={styles.skeletonCard} aria-hidden="true">
    <div className={styles.skeletonImage} style={{ background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
    <div className={styles.skeletonInfo}>
      <div className={styles.skeletonText} style={{ background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
      <div className={styles.skeletonTextSmall} style={{ background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite 0.2s' }} />
    </div>
  </div>
);

// ─── SHIMMER KEYFRAME ──────────────────────────────────────────────────────────
const ShimmerStyle = () => (
  <style>{`
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `}</style>
);

/** Custom hook for debouncing values. */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// STRICT PROFILE COMPLETION - No incomplete profiles allowed
const isProfileComplete = (p) => {
  if (!p) return false;
  const numericAge = parseInt(p.age, 10);
  const cleanPhone = (p.phone || '').replace(/[^\d]/g, '');
  return (
    p.username?.trim() &&
    p.name?.trim().length > 1 &&
    cleanPhone.length >= 9 &&
    !isNaN(numericAge) && numericAge >= 18 &&
    p.gender?.trim() &&
    p.county?.trim() &&
    p.ward?.trim() &&
    p.area?.trim() &&
    (p.profilePic || '').trim().length > 10 &&
    p.active !== false &&
    p.hidden !== true
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
    membershipPriority[p.effectiveMembership] > 1 ? premium.push(p) : regular.push(p);
  });
  premium.sort((a, b) => {
    const diff = membershipPriority[b.effectiveMembership] - membershipPriority[a.effectiveMembership];
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  regular.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return [...premium, ...regular];
};

// ─── CACHE KEY ────────────────────────────────────────────────────────────────
const CACHE_KEY = 'mc_profiles_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedProfiles() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function setCachedProfiles(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function Home({ initialProfiles = [] }) {
  const router = useRouter();

  const [allProfiles, setAllProfiles] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = getCachedProfiles();
      if (cached?.length) return cached;
    }
    return initialProfiles;
  });

  const [profilesLoading, setProfilesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // ── User is seeded synchronously from localStorage so the header renders
  //    instantly with the correct state — no shimmer skeleton needed.
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('loggedInUser');
      if (stored) {
        try { return JSON.parse(stored); } catch {}
      }
    }
    return null;
  });

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
  const [pendingAction, setPendingAction] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [unreadTotal, setUnreadTotal] = useState(0);
  const loginModalRef = useRef(null);
  const registerModalRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // ── Auth state ──────────────────────────────────────────────────────────────
  // We no longer gate the header on Firebase initialising. The localStorage
  // seed above gives us an instant render; Firebase then confirms or clears it.
  useEffect(() => {
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
    });
    return unsubscribe;
  }, []);

  // ── Real-time profiles with instant cache fallback ───────────────────────────
  useEffect(() => {
    if (!allProfiles.length) setProfilesLoading(true);

    const q = query(collection(firestore, 'profiles'), orderBy('createdAt', 'desc'));
    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) }));
        const withEffective = data.map(p => {
          let effective = p.membership || 'Regular';
          if (p.membershipExpiresAt && new Date(p.membershipExpiresAt) < new Date()) effective = 'Regular';
          return { ...p, effectiveMembership: effective };
        });
        const valid = withEffective.filter(p => isProfileComplete(p) && p.active !== false && p.hidden !== true);
        const sorted = sortProfiles(valid);
        setAllProfiles(sorted);
        setCachedProfiles(sorted);
        setProfilesLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Snapshot error:', err);
        setProfilesLoading(false);
        if (!allProfiles.length) setError('Failed to load profiles. Please check your connection.');
      }
    );
    return () => { if (unsubscribeRef.current) unsubscribeRef.current(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unread badge ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) { setUnreadTotal(0); return; }
    const q = query(collection(firestore, 'privateChats'), where('participants', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      let total = 0;
      snap.docs.forEach(d => { total += d.data().unreadCounts?.[user.uid] || 0; });
      setUnreadTotal(total);
    }, (err) => console.error('Unread snapshot error:', err));
    return () => unsub();
  }, [user?.uid]);

  // ── Location search ───────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!debouncedSearchLocation) { setSelectedWard(''); setSelectedCounty(''); return; }
    const lower = debouncedSearchLocation.trim().toLowerCase();
    let foundWard = null, foundCounty = null;
    Object.keys(counties).some(county =>
      Object.keys(counties[county]).some(ward => {
        if (ward.toLowerCase().includes(lower)) { foundWard = ward; foundCounty = county; return true; }
        if (counties[county][ward].some(a => a.toLowerCase().includes(lower))) { foundWard = ward; foundCounty = county; return true; }
        return false;
      })
    );
    if (foundWard && foundCounty) {
      setSelectedCounty(foundCounty); setSelectedWard(foundWard); setSelectedArea(''); setFilteredLocations([]);
    }
  }, [debouncedSearchLocation]);

  const handleLocationSelect = (ward, area, county) => {
    setSelectedCounty(county); setSelectedWard(ward); setSelectedArea(area);
    setSearchLocation(`${county}, ${ward}${area ? `, ${area}` : ''}`);
    setFilteredLocations([]);
  };

  const filteredProfiles = useMemo(() => {
    const searchTerm = debouncedSearchLocation.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
    return allProfiles.filter(p => {
      const countyMatch = selectedCounty ? p.county === selectedCounty : true;
      const wardMatch   = selectedWard   ? p.ward   === selectedWard   : true;
      const areaMatch   = selectedArea   ? p.area   === selectedArea   : true;
      const searchMatch = debouncedSearchLocation
        ? [p.county || '', p.ward || '', p.area || '', ...(p.nearby || [])].map(s => s.toLowerCase()).join(' ').includes(searchTerm)
        : true;
      return countyMatch && wardMatch && areaMatch && searchMatch;
    });
  }, [allProfiles, debouncedSearchLocation, selectedWard, selectedArea, selectedCounty]);

  const handleAccessProtected = (path, featureName) => {
    if (user) { router.push(path); }
    else { setPendingPath(path); setProtectedFeature(featureName); setShowLogin(true); }
  };

  const handleMessageClick = async (e, profileId) => {
    e.preventDefault(); e.stopPropagation();
    if (user) {
      try {
        const chatId = await createOrGetChat(user.uid || user.id, profileId);
        router.push(`/inbox/${chatId}`);
      } catch { alert('Could not open chat. Try again.'); }
    } else {
      setPendingAction({ type: 'message', profileId });
      setProtectedFeature('Messaging');
      setShowLogin(true);
    }
  };

  const handleGoogleAuth = async (customName = '') => {
    setAuthError(''); setAuthSuccess(''); setLoginLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      let profileData; let isNewUser = false;
      try {
        const profileDoc = await getDoc(doc(firestore, 'profiles', firebaseUser.uid));
        if (profileDoc.exists()) {
          profileData = { id: profileDoc.id, ...profileDoc.data() };
        } else {
          const basicProfile = { uid: firebaseUser.uid, name: customName || firebaseUser.displayName || firebaseUser.email.split('@')[0], email: firebaseUser.email, username: firebaseUser.email.split('@')[0], membership: 'Regular', createdAt: serverTimestamp() };
          await setDoc(doc(firestore, 'profiles', firebaseUser.uid), basicProfile);
          profileData = { id: firebaseUser.uid, ...basicProfile }; isNewUser = true;
        }
      } catch (profileErr) {
        console.error('Profile creation/fetch error:', profileErr);
        profileData = { id: firebaseUser.uid, name: customName || firebaseUser.displayName || firebaseUser.email.split('@')[0], email: firebaseUser.email, username: firebaseUser.email.split('@')[0] };
        isNewUser = true;
      }
      localStorage.setItem('loggedInUser', JSON.stringify(profileData));
      setUser(profileData); setAuthSuccess('Login successful!');
      setTimeout(async () => {
        setShowLogin(false); setShowRegister(false);
        let target = pendingPath || (isNewUser ? '/profile-setup?t=' + Date.now() : '/');
        if (pendingAction?.type === 'message') {
          try { const chatId = await createOrGetChat(firebaseUser.uid, pendingAction.profileId); target = `/inbox/${chatId}`; }
          catch { alert('Could not open chat after login. Try again.'); }
        }
        router.push(target); setPendingPath(null); setPendingAction(null); setProtectedFeature('');
        if (isNewUser) setTimeout(() => alert('Welcome! Please complete your profile to appear in searches.'), 800);
      }, 1000);
    } catch (err) {
      console.error('Google auth error:', err);
      const msgs = { 'auth/popup-closed-by-user': 'Popup closed. Try again.', 'auth/account-exists-with-different-credential': 'Account exists with different credential.' };
      setAuthError(msgs[err.code] || 'Something went wrong.');
    } finally { setLoginLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setAuthError(''); setAuthSuccess(''); setLoginLoading(true);
    const trimmedEmail = loginForm.email.trim().toLowerCase();
    const trimmedPassword = loginForm.password.trim();
    if (!trimmedEmail || !trimmedPassword) { setAuthError('Please enter email and password.'); setLoginLoading(false); return; }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) { setAuthError('Please enter a valid email address.'); setLoginLoading(false); return; }
    try {
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      let profileData; let isNewUser = false;
      try {
        const profileDoc = await getDoc(doc(firestore, 'profiles', firebaseUser.uid));
        if (profileDoc.exists()) {
          profileData = { id: profileDoc.id, ...profileDoc.data() };
        } else {
          const basicProfile = { uid: firebaseUser.uid, name: firebaseUser.email.split('@')[0], email: firebaseUser.email, username: firebaseUser.email.split('@')[0], membership: 'Regular', createdAt: serverTimestamp() };
          await setDoc(doc(firestore, 'profiles', firebaseUser.uid), basicProfile);
          profileData = { id: firebaseUser.uid, ...basicProfile }; isNewUser = true;
        }
      } catch (profileErr) {
        console.error('Profile creation/fetch error:', profileErr);
        profileData = { id: firebaseUser.uid, name: firebaseUser.email.split('@')[0], email: firebaseUser.email, username: firebaseUser.email.split('@')[0] };
        isNewUser = true;
      }
      localStorage.setItem('loggedInUser', JSON.stringify(profileData));
      setUser(profileData); setAuthSuccess('Login successful!');
      setTimeout(async () => {
        setShowLogin(false);
        let target = pendingPath || '/';
        if (pendingAction?.type === 'message') {
          try { const chatId = await createOrGetChat(firebaseUser.uid, pendingAction.profileId); target = `/inbox/${chatId}`; }
          catch { alert('Could not open chat after login. Try again.'); }
        }
        router.push(target); setPendingPath(null); setPendingAction(null); setProtectedFeature('');
        if (isNewUser) setTimeout(() => alert('Welcome! Please complete your profile to appear in searches.'), 800);
      }, 1000);
    } catch (err) {
      console.error('Login error:', err);
      const msgs = { 'auth/invalid-credential': 'Wrong email or password.', 'auth/user-not-found': 'No account found. Register first!', 'auth/wrong-password': 'Incorrect password.', 'auth/too-many-requests': 'Too many attempts. Try again later.' };
      setAuthError(msgs[err.code] || 'Something went wrong. Try again.');
    } finally { setLoginLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setForgotMessage(''); setAuthError(''); setForgotLoading(true);
    const trimmedEmail = forgotEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) { setAuthError('Please enter a valid email address.'); setForgotLoading(false); return; }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setForgotMessage('Password reset link sent! Check your email.');
      setTimeout(() => { setForgotPasswordMode(false); setForgotEmail(''); }, 3000);
    } catch (err) {
      console.error('Forgot password error:', err);
      setAuthError(err.code === 'auth/user-not-found' ? 'No account found with this email.' : 'Failed to send reset link. Try again.');
    } finally { setForgotLoading(false); }
  };

  const handleLogout = async () => {
    localStorage.removeItem('loggedInUser');
    await signOut(auth);
  };

  const closeLoginModal = () => {
    setShowLogin(false); setPendingPath(null); setPendingAction(null); setProtectedFeature('');
    setForgotPasswordMode(false); setShowEmailForm(false); setForgotEmail(''); setForgotMessage(''); setAuthSuccess('');
  };

  // Keyboard close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setShowLogin(false); setShowRegister(false);
        setPendingPath(null); setPendingAction(null); setProtectedFeature('');
        setForgotPasswordMode(false); setShowEmailForm(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Click-outside close
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

  const handleLogoClick = () => {
    if (router.pathname === '/') window.location.reload();
    else router.push('/');
  };

  // ── Profile card ──────────────────────────────────────────────────────────────
  const ProfileCard = memo(({ p }) => {
    if (!p?.username?.trim()) return null;
    const handlePhoneClick = (e) => { e.preventDefault(); e.stopPropagation(); if (p.phone) window.location.href = `tel:${p.phone}`; };
    const defaultSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iNjAiIHI9IjUwIiBmaWxsPSIjQkRCREJEIiAvPgogIDxwYXRoIGQ9Ik01MCAxNTAgUTEwMCAxMTAgMTUwIDE1NCBRMTUwIDIwMCA1MCAyMDAgWiIgZmlsbD0iI0JEQkRCRCIgLz4KPC9zdmc+Cg==';
    const blurData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8Alt4mM5mC4RnhUFm0GM1iWySHWP/AEYX/xAAUEQEAAAAAAAAAAAAAAAAAAAAQ/9oADAMBAAIAAwAAABAL/ztt/8QAGxABAAIDAQAAAAAAAAAAAAAAAQACEhEhMVGh/9oACAEBAAE/It5l0M8wCjQ7Yg6Q6q5h8V4f/2Q==";
    const hasCustomPic = !!p.profilePic;
    const isOwnProfile = user && (p.id === user.id || p.id === user.uid);
    return (
      <Link href={`/view-profile/${p.id}`} className={styles.profileLink}>
        <div className={styles.profileCard} role="listitem" style={{ animation: 'fadeIn 0.3s ease both' }}>
          <div className={styles.imageContainer}>
            <Image
              src={hasCustomPic ? p.profilePic : defaultSrc}
              alt={`${p.name || 'Profile'} Profile`}
              width={150} height={150}
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
            <h3>{p.name || 'Anonymous'}</h3>
            {p.effectiveMembership && p.effectiveMembership !== 'Regular' && (
              <span className={`${styles.badge} ${styles[p.effectiveMembership.toLowerCase()]}`}>{p.effectiveMembership}</span>
            )}
          </div>
          <p className={styles.location}>{(p.ward || '').toLowerCase()}/{(p.area || '').toLowerCase()}</p>
          <div className={styles.profileSummary}>
            <p>{p.age ? `${p.age} year old` : 'Adult'} {(p.gender || 'lady').toLowerCase()}</p>
            <p>from {p.ward || '—'}, {p.county || '—'} in {p.area || '—'}</p>
          </div>
          {!isOwnProfile && (
            <button className={styles.messageButton} onClick={(e) => handleMessageClick(e, p.id)}>
              💬 Send Message
            </button>
          )}
          {p.phone && <p><span className={styles.phoneLink} onClick={handlePhoneClick}>{p.phone}</span></p>}
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

  // ── Shared input style ────────────────────────────────────────────────────────
  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)', transition: 'border 0.3s, box-shadow 0.3s' };
  const inputFocus = (e) => { e.target.style.border = '1px solid #ff69b4'; e.target.style.boxShadow = '0 0 8px rgba(255,105,180,0.5)'; };
  const inputBlur  = (e) => { e.target.style.border = '1px solid #ddd'; e.target.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.1)'; };
  const btnStyle = (disabled) => ({ width: '100%', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', border: 'none', padding: '12px 16px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'transform 0.2s ease, box-shadow 0.3s ease' });
  const googleBtnStyle = (disabled) => ({ ...btnStyle(disabled), background: 'linear-gradient(115deg, #4285f4, #db4437)' });
  const btnHover  = (e, dis) => !dis && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 15px rgba(0,0,0,0.2)');
  const btnOut    = (e, dis) => !dis && (e.target.style.transform = '', e.target.style.boxShadow = '');

  const showSkeletons = profilesLoading && allProfiles.length === 0;

  return (
    <div className={styles.container}>
      <ShimmerStyle />
      <GlobalLoadingBar />

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
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="preconnect" href="https://www.googleapis.com" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <h1 onClick={handleLogoClick} className={styles.title}> Meet Connect </h1>
        </div>
        <div className={styles.authButtons}>
          <button onClick={() => handleAccessProtected('/inbox', 'Inbox')} className={styles.button}>
            Inbox {unreadTotal > 0 && <span className={styles.unreadBadge}>{unreadTotal > 99 ? '99+' : unreadTotal}</span>}
          </button>
          {/* No loading gate — user is seeded from localStorage synchronously so
              this renders correctly on first paint with zero flicker. */}
          {user ? (
            <Link href="/profile-setup">
              <button className={styles.button}>My Profile</button>
            </Link>
          ) : (
            <button onClick={() => { setPendingPath(null); setShowLogin(true); }} className={styles.callButton}>
              Login
            </button>
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
            style={{ backgroundColor: '#ffffff', color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
          />
          {filteredLocations.length > 0 && (
            <ul style={{ position: 'absolute', zIndex: 100, background: '#fff', border: '1px solid #ddd', borderRadius: 8, marginTop: 4, padding: 0, listStyle: 'none', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {filteredLocations.map((loc, i) => (
                <li key={i}
                  onClick={() => handleLocationSelect(loc.ward, loc.area, loc.county)}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.9rem', borderBottom: '1px solid #f0f0f0' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fff0f6'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  {loc.area}, {loc.ward} — <em style={{ color: '#888' }}>{loc.county}</em>
                </li>
              ))}
            </ul>
          )}
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
          {showSkeletons
            ? [1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)
            : filteredProfiles.map(p => <ProfileCard key={p.id} p={p} />)
          }

          {profilesLoading && allProfiles.length > 0 && (
            <div style={{ width: '100%', textAlign: 'center', padding: '8px', color: '#ff69b4', fontSize: '0.8rem', opacity: 0.7 }}>
              Refreshing…
            </div>
          )}

          {error && <p className={styles.noProfiles} style={{ color: 'red' }}>{error}</p>}
          {!showSkeletons && filteredProfiles.length === 0 && !error && (
            <p className={styles.noProfiles}>No ladies found. Complete your profile to appear in searches.</p>
          )}
        </div>
      </main>

      {/* ── Login Modal ──────────────────────────────────────────────────────────── */}
      {showLogin && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={closeLoginModal}>
          <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '40px 30px', boxShadow: '0 8px 15px rgba(0,0,0,0.2)', textAlign: 'center', width: '100%', maxWidth: 380, color: '#333', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <span style={{ position: 'absolute', top: 10, right: 20, fontSize: 24, cursor: 'pointer', color: '#ff69b4' }} onClick={closeLoginModal}>×</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 20, color: '#ff69b4' }}>{forgotPasswordMode ? 'Reset Password' : 'Welcome Back'}</h2>
            {protectedFeature && !forgotPasswordMode && <p style={{ color: '#ff69b4', fontWeight: 'bold', textAlign: 'center', margin: '0 0 15px' }}>Please login to access {protectedFeature}</p>}

            {forgotPasswordMode ? (
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: 20, textAlign: 'left' }}>
                  <label style={{ fontWeight: 400, marginBottom: 8, display: 'block', fontSize: '0.9rem', color: '#444' }}>Email Address</label>
                  <input type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required disabled={forgotLoading} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 20 }}>{authError}</p>}
                {forgotMessage && <p style={{ color: '#388e3c', background: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 20 }}>{forgotMessage}</p>}
                <button type="submit" disabled={forgotLoading} style={btnStyle(forgotLoading)} onMouseOver={e => btnHover(e, forgotLoading)} onMouseOut={e => btnOut(e, forgotLoading)}>
                  {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <div style={{ marginTop: 20, fontSize: '0.9rem', color: '#444' }}>
                  <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setForgotPasswordMode(false)}>Back to Login</span>
                </div>
              </form>
            ) : showEmailForm ? (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 20, textAlign: 'left' }}>
                  <label style={{ fontWeight: 400, marginBottom: 8, display: 'block', fontSize: '0.9rem', color: '#444' }}>Email Address</label>
                  <input type="email" placeholder="you@example.com" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} required disabled={loginLoading} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div style={{ marginBottom: 20, textAlign: 'left' }}>
                  <label style={{ fontWeight: 400, marginBottom: 8, display: 'block', fontSize: '0.9rem', color: '#444' }}>Password</label>
                  <input type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required disabled={loginLoading} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 20 }}>{authError}</p>}
                {authSuccess && <p style={{ color: '#388e3c', background: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 20 }}>{authSuccess}</p>}
                <button type="submit" disabled={loginLoading} style={btnStyle(loginLoading)} onMouseOver={e => btnHover(e, loginLoading)} onMouseOut={e => btnOut(e, loginLoading)}>
                  {loginLoading ? 'Logging in…' : 'Login'}
                </button>
                <div style={{ marginTop: 10, fontSize: '0.9rem', color: '#444' }}>
                  <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setForgotPasswordMode(true)}>Forgot Password?</span>
                </div>
                <div style={{ marginTop: 20, fontSize: '0.9rem', color: '#444' }}>
                  <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowEmailForm(false)}>Back</span>
                </div>
              </form>
            ) : (
              <>
                <button onClick={() => handleGoogleAuth()} disabled={loginLoading} style={googleBtnStyle(loginLoading)} onMouseOver={e => btnHover(e, loginLoading)} onMouseOut={e => btnOut(e, loginLoading)}>
                  {loginLoading ? 'Authenticating…' : 'Continue with Google'}
                </button>
                <p style={{ margin: '10px 0', color: '#666' }}>or</p>
                <button onClick={() => setShowEmailForm(true)} disabled={loginLoading} style={{ ...btnStyle(loginLoading), marginBottom: 20 }} onMouseOver={e => btnHover(e, loginLoading)} onMouseOut={e => btnOut(e, loginLoading)}>
                  Continue with Email
                </button>
                {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 20 }}>{authError}</p>}
                {authSuccess && <p style={{ color: '#388e3c', background: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 20 }}>{authSuccess}</p>}
                <div style={{ marginTop: 20, fontSize: '0.9rem', color: '#444' }}>
                  Don't have an account?{' '}
                  <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setShowLogin(false); setTimeout(() => setShowRegister(true), 100); }}>Create New Account</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Register Modal ───────────────────────────────────────────────────────── */}
      {showRegister && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowRegister(false)}>
          <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '40px 30px', boxShadow: '0 8px 15px rgba(0,0,0,0.2)', textAlign: 'center', width: '100%', maxWidth: 380, color: '#333', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <span style={{ position: 'absolute', top: 10, right: 20, fontSize: 24, cursor: 'pointer', color: '#ff69b4' }} onClick={() => setShowRegister(false)}>×</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 20, color: '#ff69b4' }}>Create Account</h2>
            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label style={{ fontWeight: 400, marginBottom: 8, display: 'block', fontSize: '0.9rem', color: '#444' }}>Full Name</label>
              <input type="text" placeholder="Full Name" value={registerForm.name} onChange={e => setRegisterForm({...registerForm, name: e.target.value})} required style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <button onClick={() => handleGoogleAuth(registerForm.name)} disabled={loginLoading} style={{ ...googleBtnStyle(loginLoading), marginBottom: 20 }} onMouseOver={e => btnHover(e, loginLoading)} onMouseOut={e => btnOut(e, loginLoading)}>
              {loginLoading ? 'Authenticating…' : 'Continue with Google'}
            </button>
            {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 20 }}>{authError}</p>}
            {authSuccess && <p style={{ color: '#388e3c', background: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 20 }}>{authSuccess}</p>}
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
      .map(d => ({ id: d.id, ...convertTimestamps(d.data()) }))
      .filter(p => isProfileComplete(p) && p.active !== false && p.hidden !== true);
    const withEffective = profiles.map(p => {
      let effective = p.membership || 'Regular';
      if (p.membershipExpiresAt && new Date(p.membershipExpiresAt) < new Date()) effective = 'Regular';
      return { ...p, effectiveMembership: effective };
    });
    initialProfiles = sortProfiles(withEffective);
  } catch (err) {
    console.error('Error fetching homepage profiles:', err);
  }
  return { props: { initialProfiles }, revalidate: 60 };
}