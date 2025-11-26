import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import styles from '../../styles/Profile.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  // ----- State -----
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [currentTab, setCurrentTab] = useState('posts');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const subscriptionPlans = [
    { label: '3 Days', amount: 499, duration: 3 },
    { label: '7 Days', amount: 999, duration: 7 },
    { label: '15 Days', amount: 1999, duration: 15 },
    { label: '30 Days', amount: 4999, duration: 30 },
  ];

  // ----- Auth listener -----
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) signInAnonymously(auth).catch(console.error);
    });
    return unsubscribe;
  }, []);

  // ----- Fetch profile & subscription -----
  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      try {
        const q = query(collection(db, 'profiles'), where('username', '==', id));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

        if (data.membershipExpiresAt?.toDate) data.membershipExpiresAt = data.membershipExpiresAt.toDate();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();

        setProfile({ id: docSnap.id, ...data });

        // Check if user is subscribed
        if (user) {
          const subRef = doc(db, 'subscriptions', `${user.uid}_${docSnap.id}`);
          const subDoc = await getDoc(subRef);
          if (subDoc.exists() && subDoc.data().expiresAt > new Date()) setIsSubscribed(true);
        }

        setLoading(false);
      } catch (err) {
        console.error('Firestore error:', err);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, user]);

  // ----- Build posts array -----
  useEffect(() => {
    if (!profile) return;

    const normalPics = Array.isArray(profile.normalPics) ? profile.normalPics : [];
    const exclusivePics = Array.isArray(profile.exclusivePics) ? profile.exclusivePics : [];

    let postList = [];

    if (currentTab === 'posts') {
      let latestExclusive = null;
      if (exclusivePics.length > 0) {
        const exWithDates = exclusivePics.map((url) => ({
          url,
          type: 'exclusive',
          createdAt: profile.exclusivePicsDates?.[url] || profile.createdAt,
        }));
        exWithDates.sort((a, b) => b.createdAt - a.createdAt);
        latestExclusive = exWithDates[0];
      }

      const normalPosts = normalPics.map((url) => ({
        url,
        type: 'normal',
        createdAt: profile.normalPicsDates?.[url] || profile.createdAt,
      })).sort((a, b) => b.createdAt - a.createdAt);

      postList = latestExclusive ? [latestExclusive, ...normalPosts] : normalPosts;
    } else if (currentTab === 'exclusive') {
      postList = exclusivePics.map((url) => ({
        url,
        type: 'exclusive',
        createdAt: profile.exclusivePicsDates?.[url] || profile.createdAt,
      }));
      postList.sort((a, b) => b.createdAt - a.createdAt);
    }

    setPosts(postList);
  }, [currentTab, profile]);

  // ----- Loading & Not Found -----
  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!profile) return <div className={styles.notFound}>Profile not found</div>;

  // ----- Helpers -----
  const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);
  const getThumbnail = (url) => {
    if (!isVideo(url)) return url;
    let thumb = url.replace('/video/upload/', '/image/upload/c_thumb,w_200,h_200,g_center/');
    return thumb.replace(/\.(mp4|webm|ogg)$/, '.jpg');
  };

  const handleMediaClick = (post) => {
    if (post.type === 'exclusive' && !isSubscribed) {
      setSelectedPlan(subscriptionPlans[subscriptionPlans.length - 1]); // default 30 days
      setShowPaymentModal(true);
    } else {
      setSelectedMedia(post.url);
    }
  };

  const normalizePhoneNumber = (value) => {
    let val = value.trim().replace(/\D/g, '');
    if (val.startsWith('07')) val = '254' + val.slice(1);
    return val;
  };

  const handlePhoneChange = (e) => {
    const normalized = normalizePhoneNumber(e.target.value);
    setPhoneNumber(normalized);
    setPhoneError(/^2547\d{8}$/.test(normalized) ? '' : 'Enter a valid phone number e.g. 2547XXXXXXXX');
  };

  const handlePay = async (plan) => {
    if (!user) return alert('Please log in to subscribe.');
    if (!phoneNumber || phoneError) return alert('Enter a valid phone number to proceed.');

    try {
      const res = await fetch('/api/mpesa-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          creatorId: profile.id,
          amount: plan.amount,
          durationDays: plan.duration,
          phoneNumber,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('Payment initiated! Check your phone for the STK prompt.');
        setShowPaymentModal(false);
      } else {
        alert('Payment failed: ' + data.message);
      }
    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment failed. Try again.');
    }
  };

  // ----- JSX -----
  return (
    <div className={styles.container}>
      <main className={styles.main}>

        {/* Profile Picture */}
        <div className={styles.profilePicSection}>
          <Image
            src={profile.profilePic || '/placeholder.jpg'}
            alt={profile.name}
            width={180}
            height={180}
            className={styles.profilePic}
          />
        </div>

        {/* Profile Info */}
        <div className={styles.profileInfo}>
          <h1>{profile.name}</h1>
          <p><strong>Gender:</strong> {profile.gender || '—'}</p>
          <p><strong>Orientation:</strong> {profile.sexualOrientation || '—'}</p>
          <p><strong>Age:</strong> {profile.age || '—'}</p>
          <p><strong>Nationality:</strong> {profile.nationality || '—'}</p>
          <p><strong>County:</strong> {profile.county || '—'}</p>
          <p><strong>Ward:</strong> {profile.ward || '—'}</p>
          <p><strong>Area:</strong> {profile.area || '—'}</p>

          {/* Nearby & Services */}
          <div className={styles.nearby}>
            <strong>Nearby:</strong>
            {profile.nearby?.length ? profile.nearby.map((n, i) => (
              <span key={i} className={styles.tagItem}>{n}</span>
            )) : <p>—</p>}
          </div>

          <div className={styles.services}>
            <strong>Services:</strong>
            {profile.services?.length ? profile.services.map((s, i) => (
              <span key={i} className={styles.tagItem}>{s}</span>
            )) : <p>—</p>}
          </div>

          {profile.phone && (
            <div className={styles.callButton}>
              <a href={`tel:${profile.phone}`}>Call {profile.phone}</a>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className={styles.tabButtons}>
          <button onClick={() => setCurrentTab('posts')} className={currentTab === 'posts' ? styles.activeTab : ''}>Posts</button>
          <button onClick={() => setCurrentTab('exclusive')} className={currentTab === 'exclusive' ? styles.activeTab : ''}>Exclusive</button>
        </div>

        {/* Feed */}
        <div className={styles.feed}>
          {posts.length ? posts.map((post, i) => {
            const isEx = post.type === 'exclusive';
            return (
              <div key={i} className={styles.postItem} onClick={() => handleMediaClick(post)}>
                <Image
                  src={getThumbnail(post.url)}
                  alt="Post"
                  width={300}
                  height={300}
                  style={{ objectFit: 'cover' }}
                  className={isEx && !isSubscribed ? styles.blurred : ''}
                />
                {isEx && !isSubscribed && <div className={styles.lockOverlay}>For Fans</div>}
              </div>
            );
          }) : <p>No posts yet</p>}
        </div>

      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Subscribe to Exclusive Content</h3>
            <p>Select a plan:</p>

            <div className={styles.planGrid}>
              {subscriptionPlans.map((plan) => (
                <div
                  key={plan.label}
                  className={`${styles.planCard} ${selectedPlan?.label === plan.label ? styles.activePlan : ''}`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <h4>{plan.label}</h4>
                  <p className={styles.planAmount}>KSh {plan.amount.toLocaleString()}</p>
                  <p className={styles.planDuration}>{plan.duration} {plan.duration > 1 ? 'days' : 'day'}</p>
                </div>
              ))}
            </div>

            <input
              type="tel"
              placeholder="Enter phone number e.g. 2547XXXXXXXX"
              value={phoneNumber}
              onChange={handlePhoneChange}
              className={styles.phoneInput}
            />
            {phoneError && <p style={{ color: 'red' }}>{phoneError}</p>}

            <div className={styles.modalActions}>
              <button onClick={() => selectedPlan && handlePay(selectedPlan)} disabled={!selectedPlan || !phoneNumber || phoneError}>Pay Now</button>
              <button onClick={() => setShowPaymentModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Media Viewer */}
      {selectedMedia && (
        <div className={styles.modalOverlay} onClick={() => setSelectedMedia(null)}>
          <div className={styles.mediaViewer}>
            {isVideo(selectedMedia) ? (
              <video src={selectedMedia} controls autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Image src={selectedMedia} alt="Media" width={600} height={600} style={{ objectFit: 'contain' }} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
