// pages/view-profile/[id].js
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
  const [copied, setCopied] = useState(false); // ← for copy feedback
  const touchStartX = useRef(0);

  const subscriptionPlans = [
    { label: '3 Days', amount: 499, duration: 3 },
    { label: '7 Days', amount: 999, duration: 7 },
    { label: '15 Days', amount: 1999, duration: 15 },
    { label: '30 Days', amount: 4999, duration: 30 }
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) signInAnonymously(auth);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!id) return;

    async function loadProfile() {
      try {
        const q = query(collection(db, 'profiles'), where('username', '==', id));
        const snap = await getDocs(q);
        if (snap.empty) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data();
        setProfile({ id: docSnap.id, ...data });

        if (user) {
          const subRef = doc(db, 'subscriptions', `${user.uid}_${docSnap.id}`);
          const subDoc = await getDoc(subRef);
          if (subDoc.exists() && subDoc.data().expiresAt?.toDate() > new Date()) {
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

  useEffect(() => {
    if (!profile) return;

    const normal = profile.normalPics || [];
    const exclusive = profile.exclusivePics || [];

    let list = [];

    if (currentTab === 'posts') {
      const normalPosts = normal.map(url => ({ url, type: 'normal' }));
      if (exclusive.length > 0) {
        const placeholder = {
          url: exclusive[0],
          type: 'exclusive_placeholder',
          count: exclusive.length > 1 ? exclusive.length - 1 : 0
        };
        list = isSubscribed 
          ? [{ url: exclusive[0], type: 'exclusive' }, ...normalPosts] 
          : [placeholder, ...normalPosts];
      } else {
        list = normalPosts;
      }
    }

    if (currentTab === 'exclusive') {
      if (isSubscribed && exclusive.length > 0) {
        list = exclusive.map(url => ({ url, type: 'exclusive' }));
      } else if (exclusive.length > 0) {
        list = [{
          url: exclusive[0],
          type: 'exclusive_placeholder',
          count: exclusive.length > 1 ? exclusive.length - 1 : 0
        }];
      }
    }

    setPosts(list);
  }, [profile, currentTab, isSubscribed]);

  const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);
  const getThumb = (url) => isVideo(url)
    ? url.replace('/video/upload/', '/image/upload/c_thumb,w_400,h_400,g_faces/').replace(/\.(mp4|webm|ogg)$/i, '.jpg')
    : url;

  const handleMediaClick = (post) => {
    if (post.type === 'exclusive_placeholder' || (post.type === 'exclusive' && !isSubscribed)) {
      setSelectedPlan(subscriptionPlans[3]);
      setShowPaymentModal(true);
      return;
    }

    const gallery = posts
      .filter(p => p.type !== 'exclusive_placeholder' && (isSubscribed || p.type !== 'exclusive'))
      .map(p => p.url);

    const idx = gallery.indexOf(post.url);
    setSelectedGallery(gallery);
    setSelectedIndex(idx >= 0 ? idx : 0);
    setShowMediaViewer(true);
  };

  const normalizePhone = (v) => {
    let n = v.replace(/\D/g, '');
    if (n.startsWith('254')) {
      return n;
    } else if (n.startsWith('0')) {
      return '254' + n.slice(1);
    } else if (n.startsWith('1')) {
      return '254' + n;
    } else if (n.startsWith('+254')) {
      return n.slice(1);
    }
    return n;
  };

  const handlePhoneChange = (e) => {
    const v = normalizePhone(e.target.value);
    setPhoneNumber(v);
    setPhoneError(/^254[17]\d{8}$/.test(v) ? '' : 'Invalid phone number.');
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

  // Copy phone number (formatted as stored)
  const handleCopyPhone = () => {
    if (!profile.phone) return;
    navigator.clipboard.writeText(profile.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTouchStart = (e) => touchStartX.current = e.touches[0].clientX;
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setSelectedIndex(i => diff > 0
        ? (i < selectedGallery.length - 1 ? i + 1 : 0)
        : (i > 0 ? i - 1 : selectedGallery.length - 1)
      );
    }
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!profile) return <div className={styles.notFound}>Profile not found</div>;

  const services = profile.services || [];
  const nearby = profile.nearby || [];
  const cleanPhone = profile.phone?.replace(/\D/g, '') || '';
  const phoneForTel = cleanPhone.startsWith('254') ? cleanPhone : '254' + cleanPhone.replace(/^0/, '');

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.backContainer}>
          <button onClick={() => router.back()} className={styles.backButton}>
            <span style={{ color: 'pink' }}>← Back</span>
          </button>
        </div>

        {/* Profile Header */}
        <div className={styles.header}>
          <div className={styles.picWrapper}>
            <Image
              src={profile.profilePic || '/placeholder.jpg'}
              alt={profile.name}
              width={150}
              height={150}
              className={styles.profilePic}
            />
            {profile.verified && <span className={styles.verifiedBadge}>Verified</span>}
          </div>
          <h1 className={styles.name}>{profile.name || 'Anonymous'}</h1>
          <p className={styles.username}>@{profile.username}</p>
        </div>

        {/* About Info */}
        <div className={styles.infoCard}>
          <h3>About</h3>
          <p><strong>Age:</strong> {profile.age || '—'}</p>
          <p><strong>Gender:</strong> {profile.gender || '—'}</p>
          <p><strong>Orientation:</strong> {profile.sexualOrientation || '—'}</p>
          <p><strong>Nationality:</strong> {profile.nationality || '—'}</p>
          {profile.area && <p><strong>Area:</strong> {profile.area}</p>}
        </div>

        {/* Nearby Areas */}
        {nearby.length > 0 && (
          <>
            <p className={styles.pinkLabel}>Nearby areas</p>
            <div className={styles.tags}>
              {nearby.map((place, i) => (
                <span key={i}Ā className={styles.tag}>{place}</span>
              ))}
            </div>
          </>
        )}

        {/* Services Offered */}
        {services.length > 0 && (
          <>
            <p className={styles.pinkLabel}>Services offered</p>
            <div className={styles.tags}>
              {services.map((s, i) => (
                <span key={i} className={styles.tag}>{s}</span>
              ))}
            </div>
          </>
        )}

        {/* PHONE NUMBER IS NOW DISPLAYED + CALL & COPY BUTTONS */}
        {cleanPhone && (
          <div className={styles.callButtonContainer}>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {/* Call button - shows the actual number with phone emoji */}
              <a
                href={`tel:+${phoneForTel}`}
                className={styles.callButton}
              >
                📞 {profile.phone}
              </a>

              {/* Copy button */}
              <button
                onClick={handleCopyPhone}
                className={styles.callButton}
                style={{ background: copied ? '#28a745' : '', color: copied ? 'white' : '' }}
              >
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className={styles.tabButtons}>
          <button onClick={() => setCurrentTab('posts')} className={currentTab === 'posts' ? styles.activeTab : ''}>
            Posts
          </button>
          <button onClick={() => setCurrentTab('exclusive')} className={currentTab === 'exclusive' ? styles.activeTab : ''}>
            Exclusive {profile.exclusivePics?.length > 0 && !isSubscribed && '(Locked)'}
          </button>
        </div>

        {/* Gallery Feed */}
        <div className={styles.feed}>
          {posts.length === 0 ? (
            <p className={styles.noPosts}>No posts yet</p>
          ) : (
            posts.map((post, i) => {
              const locked = post.type === 'exclusive_placeholder' || (post.type === 'exclusive' && !isSubscribed);
              return (
                <div key={i} className={styles.postItem} onClick={() => handleMediaClick(post)}>
                  <Image
                    src={getThumb(post.url)}
                    alt=""
                    width={400}
                    height={400}
                    className={locked ? styles.blurred : ''}
                  />
                  {locked && (
                    <div className={styles.lockOverlay}>
                      <span>Locked</span>
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
              {selectedPlan && (
                <p className={styles.selectedPlan}>
                  You are about to subscribe for {selectedPlan.label} at KSh {selectedPlan.amount.toLocaleString()}
                </p>
              )}
              <input
                type="tel"
                placeholder="Enter phone number (e.g., 071 встречи2345678, 712345678, +254712345678)"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className={styles.phoneInput}
              />
              {phoneError && <p className={styles.phoneError}>{phoneError}</p>}
              <div className={styles.modalActions}>
                <button
                  disabled={!selectedPlan || !!phoneError}
                  onClick={() => handlePay(selectedPlan)}
                >
                  Pay Now
                </button>
                <button onClick={() => setShowPaymentModal(false)}>Cancel</button>
              </div>
            </div>
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
