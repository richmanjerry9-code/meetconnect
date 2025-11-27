import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { auth, db } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInAnonymously
} from 'firebase/auth';
import styles from '../../styles/Profile.module.css';

export default function ViewProfile() {
  const router = useRouter();
  const { id } = router.query;

  // State
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [currentTab, setCurrentTab] = useState('posts');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Full-screen media viewer
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Touch
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const subscriptionPlans = [
    { label: '3 Days', amount: 499, duration: 3 },
    { label: '7 Days', amount: 999, duration: 7 },
    { label: '15 Days', amount: 1999, duration: 15 },
    { label: '30 Days', amount: 4999, duration: 30 }
  ];

  // --- Auth Listener ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) signInAnonymously(auth);
    });
    return unsub;
  }, []);

  // --- Load Profile ---
  useEffect(() => {
    if (!id) return;

    async function loadProfile() {
      try {
        const q = query(
          collection(db, 'profiles'),
          where('username', '==', id)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data();

        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.membershipExpiresAt?.toDate)
          data.membershipExpiresAt = data.membershipExpiresAt.toDate();

        setProfile({ id: docSnap.id, ...data });

        // check subscription
        if (user) {
          const sref = doc(db, 'subscriptions', `${user.uid}_${docSnap.id}`);
          const sdoc = await getDoc(sref);
          if (sdoc.exists() && sdoc.data().expiresAt > new Date()) {
            setIsSubscribed(true);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }

    loadProfile();
  }, [id, user]);

  // --- Build Posts ---
  useEffect(() => {
    if (!profile) return;

    const normal = profile.normalPics || [];
    const exclusive = profile.exclusivePics || [];

    let list = [];

    if (currentTab === 'posts') {
      let latestExclusive = null;

      if (exclusive.length) {
        const ex = exclusive
          .map((url) => ({
            url,
            type: 'exclusive',
            createdAt:
              profile.exclusivePicsDates?.[url] || profile.createdAt
          }))
          .sort((a, b) => b.createdAt - a.createdAt);

        latestExclusive = ex[0];
      }

      const normalPosts = normal
        .map((url) => ({
          url,
          type: 'normal',
          createdAt:
            profile.normalPicsDates?.[url] || profile.createdAt
        }))
        .sort((a, b) => b.createdAt - a.createdAt);

      list = latestExclusive ? [latestExclusive, ...normalPosts] : normalPosts;
    }

    if (currentTab === 'exclusive') {
      list = exclusive
        .map((url) => ({
          url,
          type: 'exclusive',
          createdAt:
            profile.exclusivePicsDates?.[url] || profile.createdAt
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    }

    setPosts(list);
  }, [profile, currentTab]);

  // --- Helpers ---
  const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);

  const getThumb = (url) => {
    if (!isVideo(url)) return url;
    return url
      .replace('/video/upload/', '/image/upload/c_thumb,w_300,h_300,g_center/')
      .replace(/\.(mp4|webm|ogg)$/i, '.jpg');
  };

  // --- FIXED: Open unblurred clean viewer ---
  const handleMediaClick = (post) => {
    if (post.type === 'exclusive' && !isSubscribed) {
      setSelectedPlan(subscriptionPlans[3]);
      setShowPaymentModal(true);
      return;
    }

    const gallery = posts
      .filter((p) => isSubscribed || p.type !== 'exclusive')
      .map((p) => p.url);

    const idx = gallery.indexOf(post.url);

    setSelectedGallery(gallery);
    setSelectedIndex(idx === -1 ? 0 : idx);
    setShowMediaViewer(true);
  };

  // Touch Swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

    const diffX = touchStartX.current - endX;
    const diffY = touchStartY.current - endY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      // horizontal: next / prev
      if (diffX > 50) {
        setSelectedIndex((i) =>
          i < selectedGallery.length - 1 ? i + 1 : 0
        );
      } else if (diffX < -50) {
        setSelectedIndex((i) =>
          i > 0 ? i - 1 : selectedGallery.length - 1
        );
      }
    } else {
      // vertical scroll between photos
      if (diffY > 50) {
        setSelectedIndex((i) =>
          i < selectedGallery.length - 1 ? i + 1 : 0
        );
      } else if (diffY < -50) {
        setSelectedIndex((i) =>
          i > 0 ? i - 1 : selectedGallery.length - 1
        );
      }
    }
  };

  // Wheel scroll for desktop
  const handleWheel = (e) => {
    if (e.deltaY > 0) {
      setSelectedIndex((i) =>
        i < selectedGallery.length - 1 ? i + 1 : 0
      );
    } else if (e.deltaY < 0) {
      setSelectedIndex((i) =>
        i > 0 ? i - 1 : selectedGallery.length - 1
      );
    }
  };

  const normalizePhone = (v) => {
    let n = v.replace(/\D/g, '');
    if (n.startsWith('07')) n = '254' + n.slice(1);
    return n;
  };

  const handlePhoneChange = (e) => {
    const v = normalizePhone(e.target.value);
    setPhoneNumber(v);
    setPhoneError(/^2547\d{8}$/.test(v) ? '' : 'Invalid phone number.');
  };

  const handlePay = async (plan) => {
    if (!user) return alert('Login first');
    if (!phoneNumber || phoneError) return alert('Invalid phone');

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
        alert('STK sent to phone');
        setShowPaymentModal(false);
      } else alert('Payment failed');
    } catch (err) {
      alert('Error');
    }
  };

  // UI
  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!profile) return <div className={styles.notFound}>Profile not found</div>;

  return (
    <div className={styles.container}>
      <main className={styles.main}>

        {/* Profile Photo */}
        <div className={styles.profilePicSection}>
          <Image
            src={profile.profilePic || '/placeholder.jpg'}
            alt={profile.name}
            width={180}
            height={180}
            className={styles.profilePic}
          />
        </div>

        {/* Info */}
        <div className={styles.profileInfo}>
          <h1>{profile.name}</h1>
          <p><strong>Gender:</strong> {profile.gender || '—'}</p>
          <p><strong>Orientation:</strong> {profile.sexualOrientation || '—'}</p>
          <p><strong>Age:</strong> {profile.age || '—'}</p>
          <p><strong>Nationality:</strong> {profile.nationality || '—'}</p>
          <p><strong>County:</strong> {profile.county || '—'}</p>
          <p><strong>Ward:</strong> {profile.ward || '—'}</p>
          <p><strong>Area:</strong> {profile.area || '—'}</p>
        </div>

        {/* Tabs */}
        <div className={styles.tabButtons}>
          <button
            onClick={() => setCurrentTab('posts')}
            className={currentTab === 'posts' ? styles.activeTab : ''}
          >
            Posts
          </button>
          <button
            onClick={() => setCurrentTab('exclusive')}
            className={currentTab === 'exclusive' ? styles.activeTab : ''}
          >
            Exclusive
          </button>
        </div>

        {/* Feed */}
        <div className={styles.feed}>
          {posts.map((post, i) => {
            const locked = post.type === 'exclusive' && !isSubscribed;

            return (
              <div
                key={i}
                className={styles.postItem}
                onClick={() => handleMediaClick(post)}
              >
                <Image
                  src={getThumb(post.url)}
                  alt="Post"
                  width={300}
                  height={300}
                  style={{ objectFit: 'cover' }}
                  className={locked ? styles.blurred : ''}
                />
              </div>
            );
          })}
        </div>
      </main>

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Subscribe</h3>

            <div className={styles.planGrid}>
              {subscriptionPlans.map((p) => (
                <div
                  key={p.label}
                  className={`${styles.planCard} ${
                    selectedPlan?.label === p.label ? styles.activePlan : ''
                  }`}
                  onClick={() => setSelectedPlan(p)}
                >
                  <h4>{p.label}</h4>
                  <p>KSh {p.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <input
              type="tel"
              placeholder="2547XXXXXXXX"
              value={phoneNumber}
              onChange={handlePhoneChange}
              className={styles.phoneInput}
            />
            {phoneError && <p style={{ color: 'red' }}>{phoneError}</p>}

            <div className={styles.modalActions}>
              <button
                disabled={!selectedPlan || phoneError}
                onClick={() => handlePay(selectedPlan)}
              >
                Pay Now
              </button>
              <button onClick={() => setShowPaymentModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN MEDIA VIEWER */}
      {showMediaViewer && (
        <div
          className={styles.mediaViewerOverlay}
          onClick={() => setShowMediaViewer(false)}
        >
          <div
            className={styles.mediaViewerContainer}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            {/* Prev */}
            <button
              className={styles.viewerNavPrev}
              onClick={() =>
                setSelectedIndex((i) =>
                  i > 0 ? i - 1 : selectedGallery.length - 1
                )
              }
            >
              &lt;
            </button>

            {/* Content */}
            <div className={styles.viewerMediaWrapper}>
              {isVideo(selectedGallery[selectedIndex]) ? (
                <video
                  src={selectedGallery[selectedIndex]}
                  controls
                  autoPlay
                  loop
                  className={styles.viewerMedia}
                  style={{ filter: 'none' }}
                />
              ) : (
                <Image
                  src={selectedGallery[selectedIndex]}
                  alt="Media"
                  fill
                  sizes="100vw"
                  className={styles.viewerMedia}
                  style={{
                    objectFit: 'contain',
                    filter: 'none'
                  }}
                />
              )}
            </div>

            {/* Next */}
            <button
              className={styles.viewerNavNext}
              onClick={() =>
                setSelectedIndex((i) =>
                  i < selectedGallery.length - 1 ? i + 1 : 0
                )
              }
            >
              &gt;
            </button>

            <button
              className={styles.viewerClose}
              onClick={() => setShowMediaViewer(false)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
