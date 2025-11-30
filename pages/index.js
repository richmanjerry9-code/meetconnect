// pages/index.js
import { useState, useEffect, useMemo, useCallback, memo, useRef, forwardRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import * as Counties from '../data/locations';
import styles from '../styles/Home.module.css';
import { db as firestore } from '../lib/firebase.js';
import { auth } from '../lib/firebase.js';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where, 
  startAfter, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const isProfileComplete = (p) => {
  return p && 
    p.username?.trim() && 
    p.name?.trim() && 
    p.profilePic?.trim() && 
    p.county?.trim() && 
    p.ward?.trim() && 
    p.area?.trim();
};

export default function Home({ initialProfiles = [] }) {
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
  const [shuffleKey, setShuffleKey] = useState(0);

  // =================== GOD MODE: FULL PAGE CACHE + INSTANT BACK BUTTON ===================
  useEffect(() => {
    const KEY = 'meetconnect_home_state_final';
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const { profiles, scroll } = JSON.parse(saved);
      setAllProfiles(profiles);
      setTimeout(() => window.scrollTo(0, scroll), 10);
    }

    const saveState = () => {
      const state = {
        profiles: allProfiles,
        scroll: window.scrollY,
        timestamp: Date.now()
      };
      sessionStorage.setItem(KEY, JSON.stringify(state));
    };

    router.events.on('routeChangeStart', saveState);
    return () => router.events.off('routeChangeStart', saveState);
  }, [allProfiles, router]);
  // =====================================================================================

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
      const q = query(collection(firestore, 'profiles'), orderBy('createdAt', 'desc'), limit(30));
      unsubscribeRef.current = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const validProfiles = data.filter(isProfileComplete);
        setAllProfiles(validProfiles);
        setLastDoc(snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null);
        setHasMore(snapshot.size === 30);
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

  const loadMoreProfiles = useCallback(async () => {
    if (isLoadingMore || !hasMore || !lastDoc) return;

    const cacheKey = `profiles_loadmore_${lastDoc.id}`;
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      setAllProfiles(prev => [...prev, ...cached.profiles]);
      setLastDoc(cached.lastDoc);
      setHasMore(cached.hasMore);
      setIsLoadingMore(false);
      return;
    }

    setIsLoadingMore(true);
    try {
      const q = query(collection(firestore, 'profiles'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(20));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      console.error('Error loading more:', err);
      setError('Failed to load more profiles.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, lastDoc]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !isLoadingMore) {
        loadMoreProfiles();
      }
    }, { threshold: 0 });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => sentinelRef.current && observer.unobserve(sentinelRef.current);
  }, [hasMore, isLoadingMore, loadMoreProfiles]);

  // Search filters, auto-detect ward, shuffling, etc. (all unchanged)
  useEffect(() => {
    if (!debouncedSearchLocation) {
      setFilteredLocations([]);
      return;
    }
    const matches = [];
    Object.keys(Counties).forEach(county => {
      Object.keys(Counties[county]).forEach(ward => {
        Counties[county][ward].forEach(area => {
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
    if (!debouncedSearchLocation) {
      setSelectedCounty(''); setSelectedWard(''); return;
    }
    const lower = debouncedSearchLocation.trim().toLowerCase();
    let foundCounty = null, foundWard = null;
    Object.keys(Counties).some(county => {
      return Object.keys(Counties[county]).some(ward => {
        if (ward.toLowerCase() === lower) {
          foundCounty = county; foundWard = ward; return true;
        }
        return false;
      });
    });
    if (foundCounty && foundWard) {
      setSelectedCounty(foundCounty);
      setSelectedWard(foundWard);
      setSearchLocation(`${foundCounty}, ${foundWard}`);
      setFilteredLocations([]);
    }
  }, [debouncedSearchLocation]);

  useEffect(() => {
    const interval = setInterval(() => setShuffleKey(k => k + 1), 40000);
    return () => clearInterval(interval);
  }, []);

  const filteredProfiles = useMemo(() => {
    const term = debouncedSearchLocation.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
    let filtered = allProfiles.filter(p => {
      const countyOk = selectedCounty ? p.county === selectedCounty : true;
      const wardOk = selectedWard ? p.ward === selectedWard : true;
      const areaOk = selectedArea ? p.area === selectedArea : true;
      const searchOk = !term || [p.county, p.ward, p.area, ...(p.nearby || [])]
        .join(' ').toLowerCase().includes(term);
      return countyOk && wardOk && areaOk && searchOk;
    });

    const groups = { VVIP: [], VIP: [], Prime: [], Regular: [] };
    filtered.forEach(p => {
      const mem = p.membership || 'Regular';
      groups[mem] ? groups[mem].push(p) : groups.Regular.push(p);
    });

    Object.keys(groups).forEach(key => groups[key].sort(() => Math.random() - 0.5));

    return [
      ...groups.VVIP,
      ...groups.VIP,
      ...groups.Prime,
      ...groups.Regular
    ];
  }, [allProfiles, debouncedSearchLocation, selectedCounty, selectedWard, selectedArea, shuffleKey]);

  // =================== PERFECT PROFILE CARD — NO ACCIDENTAL CLICKS ===================
  const ProfileCard = memo(({ p }) => {
    const { username, profilePic, name = 'Anonymous Lady', membership = 'Regular', verified = false, area, ward, county = 'Nairobi', services = [], phone } = p || {};

    const [touchStartY, setTouchStartY] = useState(null);
    const [touchStartX, setTouchStartX] = useState(null);
    const [isSwipe, setIsSwipe] = useState(false);
    const MIN_SWIPE = 40;

    const handleTouchStart = (e) => {
      setIsSwipe(false);
      setTouchStartY(e.touches[0].clientY);
      setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e) => {
      if (!touchStartY || !touchStartX) return;
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      if (dy > MIN_SWIPE && dy > dx) setIsSwipe(true);
    };

    const handleClick = () => {
      if (isSwipe || !username?.trim()) return;
      router.push(`/view-profile/${encodeURIComponent(username)}`, undefined, { scroll: false });
    };

    const locationDisplay = ward ? `${ward} (${area || 'All Areas'})` : (area || county || 'Location TBD');

    return (
      <div
        className={styles.profileCard}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        role="listitem"
      >
        <div className={styles.imageContainer}>
          <Image
            src={profilePic || '/no-pic.svg'}
            alt={name}
            width={150}
            height={150}
            className={styles.profileImage}
            loading="lazy"
            quality={80}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8Alt4mM5mC4RnhUFm0GM1iWySHWP/AEYX/xAAUEQEAAAAAAAAAAAAAAAAAAAAQ/9oADAMBAAIAAwAAABAL/ztt/8QAGxABAAIDAQAAAAAAAAAAAAAAAQACEhEhMVGh/9oACAEBAAE/It5l0M8wCjQ7Yg6Q6q5h8V4f/2gAIAQMBAT8B1v/EABYRAQEBAAAAAAAAAAAAAAAAAAERIf/aAAgBAgEBPwGG/8QAJBAAAQMCAwQDAAAAAAAAAAAAAAARECEiIxQQNRYXGRsfgZH/2gAIAQEABj8C4yB5W9w0rY4S5x2mY0g1j0lL8Z6W/9oADAMBAAIAAwAAABDUL/zlt/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPxAX/8QAFxEBAAMAAAAAAAAAAAAAAAAAAAARIf/aAAgBAgEBPxBIf//EAB0QAQEAAgIDAAAAAAAAAAAAAAERACExQVFhcYGR/9oADABGAAMAAAAK4nP/2gAIAQMBAT8Q1v/EABkRAAMBAQEAAAAAAAAAAAAAAABESEhQdHw/9oACAECAQE/EMkY6H/8QAJxAAAQQCAwADAAAAAAAAAAAAAAARESExQVFhcYHh8EHR0f/aAAwDAQACEAMAAAAQ+9P/2gAIAQMBAT8Q4v/EABkRAQADAQEAAAAAAAAAAAAAAAEAESExQVFx/9oACAECAQE/EMkY6H/xAAaEAEAAwEBAQAAAAAAAAAAAAABAhEhMUFRwdHw/9oADABGAAMAABAMG1v/2Q=="
          />
          {verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
        </div>
        <div className={styles.profileInfo}>
          <h3>{name}</h3>
          {membership !== 'Regular' && <span className={`${styles.badge} ${styles[membership.toLowerCase()]}`}>{membership}</span>}
        </div>
        <p className={styles.location}>{locationDisplay}</p>
        {services.length > 0 && (
          <div className={styles.services}>
            {services.slice(0, 3).map((s, i) => <span key={i} className={styles.serviceTag}>{s}</span>)}
          </div>
        )}
        {phone && <p><a href={`tel:${phone}`} className={styles.phoneLink}>{phone}</a></p>}
      </div>
    );
  });
  ProfileCard.displayName = 'ProfileCard';

  // Modal component
  const Modal = forwardRef(({ children, title, onClose }, ref) => (
    <div className={styles.modal} ref={ref}>
      <div className={styles.modalContent}>
        <h2>{title}</h2>
        <span onClick={onClose} className={styles.close}>×</span>
        {children}
      </div>
    </div>
  ));
  Modal.displayName = 'Modal';

  // Rest of your login/register handlers, JSX, getStaticProps — unchanged from your original

  if (userLoading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.logoContainer}>
            <h1 onClick={() => router.push('/')} className={styles.title}>Meet Connect</h1>
          </div>
          <div className={styles.authButtons}>
            <button className={styles.button}>Register</button>
            <button className={`${styles.button} ${styles.login}`}>Login</button>
          </div>
        </header>
        <main className={styles.main}>
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
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Meet Connect Ladies - For Gentlemen</title>
        <meta name="description" content="Discover stunning ladies across Kenya on Meet Connect Ladies, designed for gentlemen seeking meaningful connections." />
      </Head>

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <h1 onClick={() => router.push('/')} className={styles.title}>Meet Connect</h1>
        </div>
        <div className={styles.authButtons}>
          {!user ? (
            <>
              <button onClick={() => setShowRegister(true)} className={styles.button}>Register</button>
              <button onClick={() => setShowLogin(true)} className={`${styles.button} ${styles.login}`}>Login</button>
            </>
          ) : (
            <>
              <button onClick={() => router.push('/profile-setup')} className={styles.button}>My Profile</button>
              <button onClick={handleLogout} className={`${styles.button} ${styles.logout}`}>Logout</button>
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {/* Search, filters, profiles grid — all your existing JSX */}
        <div className={styles.profiles} role="list">
          {filteredProfiles.map(p => <ProfileCard key={p.id} p={p} />)}
          {hasMore && <div ref={sentinelRef} style={{ height: '1px' }} />}
        </div>
      </main>

      {/* Modals, footer — unchanged */}
    </div>
  );
}

export async function getStaticProps() {
  let initialProfiles = [];
  try {
    const q = query(collection(firestore, 'profiles'), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    initialProfiles = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(isProfileComplete);
  } catch (err) {
    console.error('getStaticProps error:', err);
  }
  return { props: { initialProfiles }, revalidate: 60 };
}
