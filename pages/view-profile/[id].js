// /pages/view-profile/[id].js
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

// FIXED: Use the correct chat helper
import { createOrGetChat } from '../../lib/chat';

import styles from '../../styles/Profile.module.css';

export default function ViewProfile() {
  const router = useRouter();
  const { id } = router.query || {};  // Safely handle if query is undefined

  const [profile, setProfile] = useState(null);
  const profileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const userRef = useRef(null);
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
  const touchStartX = useRef(0);
  const [error, setError] = useState(null);

  const subscriptionPlans = [
    { label: '3 Days', amount: 499, duration: 3 },
    { label: '7 Days', amount: 999, duration: 7 },
    { label: '15 Days', amount: 1999, duration: 15 },
    { label: '30 Days', amount: 4999, duration: 30 }
  ];

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if ((currentUser && currentUser.uid) !== (userRef.current && userRef.current.uid)) {
        userRef.current = currentUser;
        setUser(currentUser);
      } else if (!currentUser && userRef.current) {
        userRef.current = null;
        setUser(null);
      }
      if (!currentUser) {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load profile + subscription status
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function fetchProfile() {
      try {
        const profileRef = doc(db, "profiles", id);
        const profileSnap = await getDoc(profileRef);
        if (cancelled) return;

        if (!profileSnap.exists()) {
          profileRef.current = null;
          setProfile(null);
          setError('Profile not found.');
          setLoading(false);
          setIsSubscribed(false);
          return;
        }

        const profileData = profileSnap.data();
        const newProfile = { id: profileSnap.id, ...profileData };

        profileRef.current = newProfile;
        setProfile(newProfile);

        if (user && user.uid) {
          const subRef = doc(db, 'subscriptions', `${user.uid}_${id}`);
          const subDoc = await getDoc(subRef);
          const active = !!(subDoc.exists() && subDoc.data()?.expiresAt?.toDate() > new Date());
          setIsSubscribed(active);
        } else {
          setIsSubscribed(false);
        }

        setError(null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile:', error);
        if (!cancelled) {
          setError(error.message || 'An unknown error occurred.');
          setProfile(null);
          setLoading(false);
          setIsSubscribed(false);
        }
      }
    }

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  // Update posts based on tab
  useEffect(() => {
    if (!profile) {
      if (posts.length !== 0) setPosts([]);
      return;
    }

    const normalPics = profile.normalPics || [];
    const exclusivePics = profile.exclusivePics || [];
    let updatedPosts = [];

    if (currentTab === 'posts') {
      const normalPosts = normalPics.map(url => ({ url, type: 'normal' }));
      if (exclusivePics.length > 0) {
        const placeholder = {
          url: exclusivePics[0],
          type: 'exclusive_placeholder',
          count: exclusivePics.length > 1 ? exclusivePics.length - 1 : 0
        };
        updatedPosts = isSubscribed
          ? [{ url: exclusivePics[0], type: 'exclusive' }, ...normalPosts]
          : [placeholder, ...normalPosts];
      } else {
        updatedPosts = normalPosts;
      }
    } else if (currentTab === 'exclusive') {
      updatedPosts = isSubscribed && exclusivePics.length > 0
        ? exclusivePics.map(url => ({ url, type: 'exclusive' }))
        : exclusivePics.length > 0
          ? [{
              url: exclusivePics[0],
              type: 'exclusive_placeholder',
              count: exclusivePics.length > 1 ? exclusivePics.length - 1 : 0
            }]
          : [];
    }

    const prevFirst = posts[0]?.url;
    const nextFirst = updatedPosts[0]?.url;
    if (posts.length !== updatedPosts.length || prevFirst !== nextFirst) {
      setPosts(updatedPosts);
    }
  }, [profile, currentTab, isSubscribed]);

  // Copied timeout
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Helpers
  const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);
  const getThumbnail = (url) => {
    if (isVideo(url)) {
      return url.replace('/video/upload/', '/image/upload/c_thumb,w_400,h_400,g_faces/').replace(/\.(mp4|webm|ogg)$/i, '.jpg');
    }
    return url;
  };

  // Click handlers
  const handleMediaClick = (post) => {
    if (post.type === 'exclusive_placeholder' || (post.type === 'exclusive' && !isSubscribed)) {
      setSelectedPlan(subscriptionPlans[3]);
      setShowPaymentModal(true);
      return;
    }

    const gallery = posts
      .filter(p => p.type !== 'exclusive_placeholder' && (isSubscribed || p.type !== 'exclusive'))
      .map(p => p.url);

    const index = gallery.indexOf(post.url);
    setSelectedGallery(gallery);
    setSelectedIndex(index >= 0 ? index : 0);
    setShowMediaViewer(true);
  };

  const normalizePhone = (value) => {
    let num = (value || '').replace(/\D/g, '');
    if (num.startsWith('254')) return num;
    if (num.startsWith('0')) return '254' + num.slice(1);
    if (num.startsWith('1')) return '254' + num;
    return num;
  };

  const handlePhoneChange = (e) => {
    const normalized = normalizePhone(e.target.value);
    setPhoneNumber(normalized);
    setPhoneError(/^254[17]\d{8}$/.test(normalized) ? '' : 'Invalid phone number.');
  };

  const handlePay = async (plan) => {
    if (!user) return alert('Please log in first.');
    if (!phoneNumber || phoneError) return alert('Invalid phone number.');
    if (!profile?.id) return alert('Profile missing.');

    try {
      const response = await fetch('/api/mpesa-pay', {
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
      const data = await response.json();
      if (data.success) {
        alert('STK push sent to your phone.');
        setShowPaymentModal(false);
      } else {
        alert('Payment initiation failed.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('An error occurred during payment.');
    }
  };

  const handleCopyPhone = () => {
    if (!profile?.phone) return;
    navigator.clipboard.writeText(profile.phone).then(() => setCopied(true));
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setSelectedIndex((prevIndex) => {
        if (diff > 0) {
          return prevIndex < selectedGallery.length - 1 ? prevIndex + 1 : 0;
        } else {
          return prevIndex > 0 ? prevIndex - 1 : selectedGallery.length - 1;
        }
      });
    }
  };

  // FIXED: Safe chat opener — no ghost chats!
  const handleMessage = async () => {
    if (!user) {
      alert('Please log in to send messages.');
      return;
    }
    if (!profile?.id) return;

    try {
      const chatId = await createOrGetChat(user.uid, profile.id);
      router.push(`/inbox/${chatId}`);
    } catch (err) {
      console.error("Failed to open chat:", err);
      alert("Could not open chat. Please try again.");
    }
  };

  // Render
  if (loading) return <div className={styles.loading}>Loading profile...</div>;
  if (error) return <div className={styles.notFound}>Error: {error}</div>;
  if (!profile) return <div className={styles.notFound}>Profile not found.</div>;

  const services = profile.services || [];
  const nearby = profile.nearby || [];
  const cleanPhone = profile.phone?.replace(/\D/g, '') || '';
  const phoneForTel = cleanPhone.startsWith('254') ? cleanPhone : '254' + cleanPhone.replace(/^0/, '');

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.backContainer}>
          <button onClick={() => router.back()} className={styles.backButton}>
            <span style={{ color: 'pink' }}>Back</span>
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

        {/* Nearby & Services */}
        {nearby.length > 0 && (
          <>
            <p className={styles.pinkLabel}>Nearby areas</p>
            <div className={styles.tags}>
              {nearby.map((place, i) => <span key={i} className={styles.tag}>{place}</span>)}
            </div>
          </>
        )}
        {services.length > 0 && (
          <>
            <p className={styles.pinkLabel}>Services offered</p>
            <div className={styles.tags}>
              {services.map((service, i) => <span key={i} className={styles.tag}>{service}</span>)}
            </div>
          </>
        )}

        {/* Phone + Copy Buttons */}
        {cleanPhone && (
          <div className={styles.callButtonContainer}>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={`tel:+${phoneForTel}`} className={styles.callButton}>
                {profile.phone}
              </a>
              <button
                onClick={handleCopyPhone}
                className={styles.callButton}
                style={{ background: copied ? '#28a745' : '', color: copied ? 'white' : '' }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Send Message Button - always shown if profile exists */}
        <div className={styles.callButtonContainer}>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleMessage} className={styles.callButton}>
              💬 Send Message
            </button>
          </div>
        </div>

        {/* Tabs & Gallery */}
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
            posts.map((post, index) => {
              const isLocked = post.type === 'exclusive_placeholder' || (post.type === 'exclusive' && !isSubscribed);
              return (
                <div key={index} className={styles.postItem} onClick={() => handleMediaClick(post)}>
                  <Image
                    src={getThumbnail(post.url)}
                    alt={`Post ${index + 1}`}
                    width={400}
                    height={400}
                    className={isLocked ? styles.blurred : ''}
                  />
                  {isLocked && (
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
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalContent}>
              <h3>Subscribe to Unlock</h3>
              <div className={styles.planGrid}>
                {subscriptionPlans.map((plan) => (
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
              {selectedPlan && (
                <p className={styles.selectedPlan}>
                  Subscribe for {selectedPlan.label} at KSh {selectedPlan.amount.toLocaleString()}
                </p>
              )}
              <input
                type="tel"
                placeholder="Enter phone (e.g., 0712345678)"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className={styles.phoneInput}
              />
              {phoneError && <p className={styles.phoneError}>{phoneError}</p>}
              <div className={styles.modalActions}>
                <button disabled={!selectedPlan || !!phoneError} onClick={() => handlePay(selectedPlan)}>
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
          <div className={styles.mediaViewerContainer} onClick={(e) => e.stopPropagation()} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <span className={styles.viewerCloseX} onClick={() => setShowMediaViewer(false)}>×</span>
            {isVideo(selectedGallery[selectedIndex]) ? (
              <video src={selectedGallery[selectedIndex]} controls autoPlay loop className={styles.viewerMedia} />
            ) : (
              <Image src={selectedGallery[selectedIndex]} alt="Media" fill className={styles.viewerMedia} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}