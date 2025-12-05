// /pages/view-profile/[id].js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';

import { createOrGetChat } from '../../lib/chat';

import styles from '../../styles/Profile.module.css';

export default function ViewProfile() {
  const router = useRouter();
  const { id } = router.query || {};

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [currentTab, setCurrentTab] = useState('posts');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const touchStartX = useRef(0);

  // Login / Register states
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'message' | 'subscribe'
  const [loginPrompt, setLoginPrompt] = useState('');
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  const subscriptionPlans = [
    { label: '3 Days', amount: 499, duration: 3 },
    { label: '7 Days', amount: 999, duration: 7 },
    { label: '15 Days', amount: 1999, duration: 15 },
    { label: '30 Days', amount: 4999, duration: 30 }
  ];

  // Auth listener - automatically closes login modal when real login happens
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Auto-close login modal & clear pending when real user logs in
      if (currentUser && !currentUser.isAnonymous) {
        setShowLogin(false);
        setShowRegister(false);
        setPendingAction(null);
        setLoginPrompt('');
        setAuthError('');
      }

      if (!currentUser) {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch profile + subscription status (re-runs on user change)
  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      try {
        const profileSnap = await getDoc(doc(db, 'profiles', id));
        if (!profileSnap.exists()) {
          setError('Profile not found');
          setLoading(false);
          return;
        }

        const profileData = { id: profileSnap.id, ...profileSnap.data() };
        setProfile(profileData);

        // Re-check subscription when user changes (including after login)
        if (user && !user.isAnonymous) {
          const subSnap = await getDoc(doc(db, 'subscriptions', `${user.uid}_${id}`));
          const active = subSnap.exists() && subSnap.data()?.expiresAt?.toDate() > new Date();
          setIsSubscribed(active);
        } else {
          setIsSubscribed(false);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Failed to load profile');
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, user]);

  // Build posts array
  useEffect(() => {
    if (!profile) {
      setPosts([]);
      return;
    }

    const normal = (profile.normalPics || []).map(url => ({ url, type: 'normal' }));
    const exclusive = profile.exclusivePics || [];
    let newPosts = [];

    if (currentTab === 'posts') {
      newPosts = isSubscribed
        ? exclusive.map(url => ({ url, type: 'exclusive' })).concat(normal)
        : exclusive.length > 0
          ? [{ url: exclusive[0], type: 'exclusive_placeholder', count: exclusive.length > 1 ? exclusive.length - 1 : 0 }, ...normal]
          : normal;
    } else {
      newPosts = isSubscribed
        ? exclusive.map(url => ({ url, type: 'exclusive' }))
        : exclusive.length > 0
          ? [{ url: exclusive[0], type: 'exclusive_placeholder', count: exclusive.length > 1 ? exclusive.length - 1 : 0 }]
          : [];
    }

    setPosts(newPosts);
  }, [profile, currentTab, isSubscribed]);

  const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);

  const getThumbnail = (url) => {
    if (isVideo(url) && url.includes('cloudinary')) {
      return url
        .replace('/video/upload/', '/image/upload/c_thumb,w_400,h_400,g_faces/')
        .replace(/\.(mp4|webm|ogg)$/i, '.jpg');
    }
    return url;
  };

  // Require real login
  const requireRealLogin = (action, prompt) => {
    if (!user || user.isAnonymous) {
      setPendingAction(action);
      setLoginPrompt(prompt);
      setShowLogin(true);
      return true;
    }
    return false;
  };

  const handleMessage = async () => {
    if (requireRealLogin('message', 'send messages')) return;

    try {
      const chatId = await createOrGetChat(user.uid, profile.id);
      router.push(`/inbox/${chatId}`);
    } catch (err) {
      alert('Could not open chat. Try again.');
    }
  };

  const openSubscribeModal = () => {
    setSelectedPlan(subscriptionPlans[3]);
    setShowPaymentModal(true);
  };

  const handleMediaClick = (post) => {
    const locked = post.type === 'exclusive_placeholder' || (post.type === 'exclusive' && !isSubscribed);
    if (locked) {
      if (requireRealLogin('subscribe', 'unlock exclusive content')) return;
      openSubscribeModal();
      return;
    }

    const gallery = posts
      .filter(p => p.type !== 'exclusive_placeholder')
      .map(p => p.url);

    const idx = gallery.indexOf(post.url);
    setSelectedGallery(gallery);
    setSelectedIndex(idx >= 0 ? idx : 0);
    setShowMediaViewer(true);
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    let formatted = val;
    if (val.startsWith('0')) formatted = '254' + val.slice(1);
    else if (!val.startsWith('254') && val.length === 9) formatted = '254' + val;

    setPhoneNumber(formatted);
    setPhoneError(/^254[71]\d{8}$/.test(formatted) ? '' : 'Invalid Kenyan number');
  };

  const handlePay = async (plan) => {
    if (requireRealLogin('subscribe', 'complete payment')) return;
    if (phoneError || !phoneNumber) return alert('Valid phone required');

    try {
      const res = await fetch('/api/mpesa-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          creatorId: profile.id,
          amount: plan.amount,
          durationDays: plan.duration,
          phoneNumber
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('STK push sent! Check your phone.');
        setShowPaymentModal(false);
        // Force refresh subscription status
        const subSnap = await getDoc(doc(db, 'subscriptions', `${user.uid}_${id}`));
        if (subSnap.exists()) setIsSubscribed(true);
      } else {
        alert(data.message || 'Payment failed');
      }
    } catch (err) {
      alert('Payment error');
    }
  };

  const handleCopyPhone = () => {
    if (profile?.phone) {
      navigator.clipboard.writeText(profile.phone);
      setCopied(true);
    }
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setSelectedIndex(i => diff > 0
        ? (i < selectedGallery.length - 1 ? i + 1 : 0)
        : (i > 0 ? i - 1 : selectedGallery.length - 1)
      );
    }
  };

  // Login success → close modal + execute pending
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoginLoading(true);

    try {
      await signInWithEmailAndPassword(auth, loginForm.email.trim().toLowerCase(), loginForm.password);

      setTimeout(() => {
        setShowLogin(false);
        setLoginLoading(false);

        if (pendingAction === 'message') handleMessage();
        else if (pendingAction === 'subscribe') openSubscribeModal();

        setPendingAction(null);
        setLoginPrompt('');
      }, 800);
    } catch (err) {
      setAuthError(
        err.code.includes('wrong-password') || err.code.includes('invalid-credential')
          ? 'Wrong email/password'
          : 'Login failed'
      );
      setLoginLoading(false);
    }
  };

  // Register success
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (registerForm.password.length < 8) return setAuthError('Password must be 8+ characters');

    try {
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, registerForm.email, registerForm.password);
      await setDoc(doc(db, 'profiles', fbUser.uid), {
        uid: fbUser.uid,
        name: registerForm.name || registerForm.email.split('@')[0],
        email: registerForm.email,
        username: registerForm.email.split('@')[0],
        membership: 'Regular',
        createdAt: serverTimestamp()
      });

      setTimeout(() => {
        setShowRegister(false);
        if (pendingAction === 'message') handleMessage();
        else if (pendingAction === 'subscribe') openSubscribeModal();
        setPendingAction(null);
      }, 800);
    } catch (err) {
      setAuthError(err.code === 'auth/email-already-in-use' ? 'Email already registered' : 'Registration failed');
    }
  };

  if (loading) return <div className={styles.loading}>Loading profile...</div>;
  if (error) return <div className={styles.notFound}>{error}</div>;
  if (!profile) return <div className={styles.notFound}>Profile not found</div>;

  const services = profile.services || [];
  const nearby = profile.nearby || [];
  const cleanPhone = profile.phone?.replace(/\D/g, '') || '';
  const phoneLink = cleanPhone.startsWith('254') ? cleanPhone : '254' + cleanPhone.replace(/^0/, '');

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.backContainer}>
          <button onClick={() => router.back()} className={styles.backButton}>
            ← Back
          </button>
        </div>

        <div className={styles.header}>
          <div className={styles.picWrapper}>
            <Image
              src={profile.profilePic || '/placeholder.jpg'}
              alt={profile.name}
              width={150}
              height={150}
              className={styles.profilePic}
            />
            {profile.verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
          </div>
          <h1 className={styles.name}>{profile.name || 'Anonymous'}</h1>
          {profile.membership && profile.membership !== 'Regular' && (
            <span className={`${styles.badge} ${styles[profile.membership.toLowerCase()]}`}>
              {profile.membership}
            </span>
          )}
        </div>

        <div className={styles.infoCard}>
          <h3>About</h3>
          <p><strong>Age:</strong> {profile.age || '—'}</p>
          <p><strong>Gender:</strong> {profile.gender || '—'}</p>
          <p><strong>Orientation:</strong> {profile.sexualOrientation || '—'}</p>
          <p><strong>Nationality:</strong> {profile.nationality || '—'}</p>
          {profile.area && <p><strong>Area:</strong> {profile.area}</p>}
          {profile.ward && <p><strong>Ward:</strong> {profile.ward}</p>}
        </div>

        {nearby.length > 0 && (
          <>
            <p className={styles.pinkLabel}>Nearby areas</p>
            <div className={styles.tags}>
              {nearby.map((p, i) => <span key={i} className={styles.tag}>{p}</span>)}
            </div>
          </>
        )}

        {services.length > 0 && (
          <>
            <p className={styles.pinkLabel}>Services offered</p>
            <div className={styles.tags}>
              {services.map((s, i) => <span key={i} className={styles.tag}>{s}</span>)}
            </div>
          </>
        )}

        {cleanPhone && (
          <div className={styles.callButtonContainer}>
            <div style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={`tel:+${phoneLink}`} className={styles.callButton}>{profile.phone}</a>
              <button onClick={handleCopyPhone} className={styles.callButton} style={{ background: copied ? '#28a745' : '', color: copied ? 'white' : '' }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className={styles.callButtonContainer}>
          <button onClick={handleMessage} className={styles.callButton}>💬 Send Message</button>
        </div>

        <div className={styles.tabButtons}>
          <button onClick={() => setCurrentTab('posts')} className={currentTab === 'posts' ? styles.activeTab : ''}>
            Posts
          </button>
          <button onClick={() => setCurrentTab('exclusive')} className={currentTab === 'exclusive' ? styles.activeTab : ''}>
            Exclusive {profile.exclusivePics?.length > 0 && !isSubscribed && '(Locked)'}
          </button>
        </div>

        <div className={styles.feed}>
          {posts.length === 0 ? (
            <p className={styles.noPosts}>No posts available yet.</p>
          ) : (
            posts.map((post, i) => {
              const locked = post.type === 'exclusive_placeholder' || (post.type === 'exclusive' && !isSubscribed);
              return (
                <div key={i} className={styles.postItem} onClick={() => handleMediaClick(post)}>
                  <Image
                    src={getThumbnail(post.url)}
                    alt=""
                    width={400}
                    height={400}
                    className={locked ? styles.blurred : ''}
                  />
                  {locked && (
                    <div className={styles.lockOverlay}>
                      <span>Subscribe to unlock</span>
                      {post.count > 0 && <div>+{post.count} more</div>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Subscribe to Unlock Exclusive Content</h3>
            <div className={styles.planGrid}>
              {subscriptionPlans.map(plan => (
                <div
                  key={plan.label}
                  className={`${styles.planCard} ${selectedPlan?.label === plan.label ? styles.activePlan : ''}`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <h4>{plan.label}</h4>
                  <p>KSh {plan.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
            {selectedPlan && <p className={styles.selectedPlan}>Selected: {selectedPlan.label} – KSh {selectedPlan.amount.toLocaleString()}</p>}
            <input type="tel" placeholder="07xxxxxxxx" value={phoneNumber} onChange={handlePhoneChange} className={styles.phoneInput} />
            {phoneError && <p className={styles.phoneError}>{phoneError}</p>}
            <div className={styles.modalActions}>
              <button disabled={!selectedPlan || phoneError} onClick={() => handlePay(selectedPlan)}>Pay with M-Pesa</button>
              <button onClick={() => setShowPaymentModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLogin && (
        <div className={styles.modalOverlay} onClick={() => { setShowLogin(false); setPendingAction(null); setLoginPrompt(''); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Login Required</h3>
            {loginPrompt && <p style={{ color: '#e91e63', fontWeight: 'bold', textAlign: 'center' }}>
              Please login to {loginPrompt}
            </p>}
            <form onSubmit={handleLogin}>
              <input type="email" placeholder="Email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} required />
              <input type="password" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} required />
              {authError && <p className={styles.error}>{authError}</p>}
              <button type="submit" disabled={loginLoading}>{loginLoading ? 'Logging in...' : 'Login'}</button>
              <button type="button" onClick={() => { setShowLogin(false); setShowRegister(true); }}>
                Create New Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegister && (
        <div className={styles.modalOverlay} onClick={() => setShowRegister(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Create Account</h3>
            <form onSubmit={handleRegister}>
              <input type="text" placeholder="Full Name" value={registerForm.name} onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })} required />
              <input type="email" placeholder="Email" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} required />
              <input type="password" placeholder="Password (8+ chars)" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} required minLength={8} />
              {authError && <p className={styles.error}>{authError}</p>}
              <button type="submit">Register</button>
            </form>
          </div>
        </div>
      )}

      {/* Media Viewer */}
      {showMediaViewer && (
        <div className={styles.mediaViewerOverlay} onClick={() => setShowMediaViewer(false)}>
          <div className={styles.mediaViewerContainer} onClick={e => e.stopPropagation()} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <span className={styles.viewerCloseX} onClick={() => setShowMediaViewer(false)}>×</span>
            {isVideo(selectedGallery[selectedIndex]) ? (
              <video src={selectedGallery[selectedIndex]} controls autoPlay loop className={styles.viewerMedia} />
            ) : (
              <Image src={selectedGallery[selectedIndex]} alt="" fill className={styles.viewerMedia} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}