
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Head from 'next/head';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, serverTimestamp, setDoc, arrayUnion, updateDoc } from 'firebase/firestore';
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

  const [profileViewers, setProfileViewers] = useState([]);
  const [showViewersModal, setShowViewersModal] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
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

  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [postFiles, setPostFiles] = useState([]);
  const [postPreviews, setPostPreviews] = useState([]);
  const [postCaption, setPostCaption] = useState('');
  const [postIsExclusive, setPostIsExclusive] = useState(false);
  const [postUploading, setPostUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [storyFiles, setStoryFiles] = useState([]);
  const [storyPreviews, setStoryPreviews] = useState([]);
  const [storyUploading, setStoryUploading] = useState(false);
  const storyFileInputRef = useRef(null);

  const [showPicMenu, setShowPicMenu] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [viewers, setViewers] = useState([]);
  const profilePicInputRef = useRef(null);

  const isOwnProfile = user && !user.isAnonymous && user.uid === id;

  // ─── Active stories helper (24h) ────────────────────────────────────────────
  const getActiveStories = (stories) => {
    if (!Array.isArray(stories)) return [];
    const now = Date.now();
    return stories.filter(s => {
      const created = s.createdAt ? new Date(s.createdAt).getTime() : 0;
      return now - created < 24 * 60 * 60 * 1000;
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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
        if (user && !user.isAnonymous) {
          const subSnap = await getDoc(doc(db, 'subscriptions', `${user.uid}_${id}`));
          const active = subSnap.exists() && subSnap.data()?.expiresAt?.toDate() > new Date();
          setIsSubscribed(active);
          if (user.uid !== id) {
            const profileRef = doc(db, 'profiles', id);
            const existingViews = profileData.profileViews || [];
            const alreadyViewed = existingViews.some(v => v.uid === user.uid);
            if (!alreadyViewed) {
              const viewEntry = { uid: user.uid, viewedAt: new Date().toISOString() };
              await updateDoc(profileRef, { profileViews: arrayUnion(viewEntry) });
            }
          }
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

  useEffect(() => {
    if (!isOwnProfile || !profile) return;
    const fetchProfileViewers = async () => {
      const views = profile.profileViews || [];
      const unique = [...new Map(views.map(v => [v.uid, v])).values()];
      const resolved = await Promise.all(
        unique.map(async (v) => {
          const snap = await getDoc(doc(db, 'profiles', v.uid));
          return {
            name: snap.exists() ? snap.data().name || 'Anonymous' : 'Unknown',
            profilePic: snap.exists() ? snap.data().profilePic || '/default-avatar.svg' : '/default-avatar.svg',
            uid: v.uid,
            viewedAt: v.viewedAt,
          };
        })
      );
      resolved.sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));
      setProfileViewers(resolved);
    };
    fetchProfileViewers();
  }, [isOwnProfile, profile]);

  useEffect(() => {
    if (!profile) { setPosts([]); return; }
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

  useEffect(() => {
    if (showStoryViewer && user && profile?.id !== user.uid) {
      const recordView = async () => {
        try {
          const profileRef = doc(db, 'profiles', profile.id);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            let stories = profileSnap.data().stories || [];
            stories = stories.map((s, i) => {
              if (i === currentStoryIndex && !s.views?.includes(user.uid)) {
                return { ...s, views: [...(s.views || []), user.uid] };
              }
              return s;
            });
            await updateDoc(profileRef, { stories });
          }
        } catch (err) {
          console.error('Failed to record view', err);
        }
      };
      recordView();
    }
  }, [showStoryViewer, currentStoryIndex, user, profile?.id]);

  useEffect(() => {
    if (showStoryViewer && isOwnProfile && profile?.stories?.[currentStoryIndex]?.views) {
      const fetchViewers = async () => {
        const views = profile.stories[currentStoryIndex].views || [];
        const uniqueViews = [...new Set(views)];
        const viewerProfiles = await Promise.all(
          uniqueViews.map(async (uid) => {
            const userSnap = await getDoc(doc(db, 'profiles', uid));
            return userSnap.exists() ? userSnap.data().name || 'Anonymous' : 'Unknown';
          })
        );
        setViewers(viewerProfiles);
      };
      fetchViewers();
    } else {
      setViewers([]);
    }
  }, [showStoryViewer, currentStoryIndex, isOwnProfile, profile?.stories]);

  const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(String(url || ''));

  const getThumbnail = (url) => {
    if (isVideo(url) && url.includes('cloudinary')) {
      return url
        .replace('/video/upload/', '/image/upload/c_thumb,w_400,h_400,g_faces/')
        .replace(/\.(mp4|webm|ogg)$/i, '.jpg');
    }
    return url;
  };

  const requireRealLogin = (action, prompt) => {
    if (!user || user.isAnonymous) {
      setPendingAction(action);
      setLoginPrompt(prompt);
      setShowLogin(true);
      return true;
    }
    return false;
  };

  const handleDeleteStory = async () => {
    if (!isOwnProfile || !profile?.stories) return;
    const confirmed = window.confirm('Delete this story?');
    if (!confirmed) return;
    try {
      const newStories = profile.stories.filter((_, i) => i !== currentStoryIndex);
      const profileRef = doc(db, 'profiles', id);
      await updateDoc(profileRef, { stories: newStories });
      setProfile(prev => ({ ...prev, stories: newStories }));
      if (newStories.length === 0) {
        setShowStoryViewer(false);
      } else {
        setCurrentStoryIndex(i => Math.min(i, newStories.length - 1));
      }
    } catch (err) {
      alert('Failed to delete story');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      setShowLogin(false);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, registerForm.email, registerForm.password);
      await setDoc(doc(db, 'profiles', cred.user.uid), {
        name: registerForm.name,
        email: registerForm.email,
        createdAt: serverTimestamp(),
      }, { merge: true });
      setShowRegister(false);
    } catch (err) {
      setAuthError(err.message || 'Registration failed.');
    }
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
    const gallery = posts.filter(p => p.type !== 'exclusive_placeholder').map(p => p.url);
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
        body: JSON.stringify({ userId: user.uid, creatorId: profile.id, amount: plan.amount, durationDays: plan.duration, phoneNumber })
      });
      const data = await res.json();
      if (data.success) {
        alert('STK push sent! Check your phone.');
        setShowPaymentModal(false);
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

  const handleStoryTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleStoryTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setCurrentStoryIndex(i => (i < profile.stories.length - 1 ? i + 1 : i));
      } else {
        setCurrentStoryIndex(i => {
          if (i > 0) return i - 1;
          setShowStoryViewer(false);
          return i;
        });
      }
    }
  };

  const handleProfilePicClick = () => {
    const activeStories = getActiveStories(profile?.stories);
    if (activeStories.length > 0) {
      setCurrentStoryIndex(0);
      setShowStoryViewer(true);
    }
  };

  const handleProfilePicSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large (max 5MB)'); return; }
    const fd = new FormData();
    fd.append('media', file);
    fd.append('userId', id);
    fd.append('isProfilePic', 'true');
    fetch('/api/uploadPost', { method: 'POST', body: fd })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setDoc(doc(db, 'profiles', id), { profilePic: data.url }, { merge: true });
          setProfile(prev => ({ ...prev, profilePic: data.url }));
        } else {
          alert('Upload failed');
        }
      })
      .catch(() => alert('Upload error'));
  };

  const handlePostFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPreviews = files.map(f => URL.createObjectURL(f));
    setPostFiles(prev => [...prev, ...files]);
    setPostPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const handleRemovePostPreview = (index) => {
    URL.revokeObjectURL(postPreviews[index]);
    setPostFiles(prev => prev.filter((_, i) => i !== index));
    setPostPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    if (!postFiles.length || postUploading) return;
    if (requireRealLogin('post', 'create posts')) return;
    setPostUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of postFiles) {
        const fd = new FormData();
        fd.append('media', file);
        fd.append('userId', id);
        fd.append('isExclusive', postIsExclusive ? 'true' : 'false');
        const res = await fetch('/api/uploadPost', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) uploadedUrls.push(data.url);
        else throw new Error('Upload failed for one file');
      }
      const profileRef = doc(db, 'profiles', id);
      const field = postIsExclusive ? 'exclusivePics' : 'normalPics';
      await updateDoc(profileRef, { [field]: arrayUnion(...uploadedUrls) });
      setProfile(prev => ({ ...prev, [field]: [...(prev[field] || []), ...uploadedUrls] }));
      postPreviews.forEach(u => URL.revokeObjectURL(u));
      setPostFiles([]); setPostPreviews([]); setPostCaption(''); setShowCreatePostModal(false);
      alert('Post created!');
    } catch (err) {
      console.error(err);
      alert('Failed to create post. Try again.');
    } finally {
      setPostUploading(false);
    }
  };

  const handleStoryFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPreviews = files.map(f => URL.createObjectURL(f));
    setStoryFiles(prev => [...prev, ...files]);
    setStoryPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const handleRemoveStoryPreview = (index) => {
    URL.revokeObjectURL(storyPreviews[index]);
    setStoryFiles(prev => prev.filter((_, i) => i !== index));
    setStoryPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateStory = async () => {
    if (!storyFiles.length || storyUploading) return;
    if (requireRealLogin('story', 'create stories')) return;
    setStoryUploading(true);
    try {
      const uploadedStories = [];
      for (const file of storyFiles) {
        const fd = new FormData();
        fd.append('media', file);
        fd.append('userId', id);
        fd.append('isStory', 'true');
        const res = await fetch('/api/uploadPost', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) {
          uploadedStories.push({ url: data.url, createdAt: new Date().toISOString(), views: [] });
        } else {
          throw new Error('Upload failed for one story');
        }
      }
      const profileRef = doc(db, 'profiles', id);
      const currentSnap = await getDoc(profileRef);
      const existingStories = currentSnap.data()?.stories || [];
      const now = Date.now();
      const validStories = existingStories.filter(s => {
        const created = s.createdAt ? new Date(s.createdAt).getTime() : 0;
        return now - created < 24 * 60 * 60 * 1000;
      });
      const newStories = [...validStories, ...uploadedStories];
      await updateDoc(profileRef, { stories: newStories });
      setProfile(prev => ({ ...prev, stories: newStories }));
      storyPreviews.forEach(u => URL.revokeObjectURL(u));
      setStoryFiles([]); setStoryPreviews([]); setShowCreateStoryModal(false);
      alert('Story posted!');
    } catch (err) {
      console.error(err);
      alert('Failed to post story. Try again.');
    } finally {
      setStoryUploading(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading profile...</div>;
  if (error) return <div className={styles.notFound}>{error}</div>;
  if (!profile) return <div className={styles.notFound}>Profile not found</div>;

  const nearby = profile.nearby || [];
  const cleanPhone = profile.phone?.replace(/\D/g, '') || '';
  const phoneLink = cleanPhone.startsWith('254') ? cleanPhone : '254' + cleanPhone.replace(/^0/, '');
  const activeStories = getActiveStories(profile.stories);
  const hasStories = activeStories.length > 0;

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <main className={styles.main}>

          {/* ── Top bar: Back (left) + Settings (right) ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <button onClick={() => router.back()} className={styles.backButton}>← Back</button>
            {isOwnProfile && (
              <button
                onClick={() => router.push('/profile-setup')}
                className={styles.settingsButton}
                style={{ position: 'static', margin: 0 }}
              >
                ⚙ Settings
              </button>
            )}
          </div>

          <div className={styles.header}>

            {/* ── Profile pic — matches index.js story ring exactly ── */}
            <div style={{ position: 'relative', display: 'inline-block' }}>

              {/* Outer story ring (pink gradient border) */}
              <div
                onClick={handleProfilePicClick}
                style={{
                  cursor: hasStories ? 'pointer' : 'default',
                  width: 118,
                  height: 118,
                  borderRadius: '50%',
                  padding: hasStories ? 3 : 0,
                  background: hasStories
                    ? 'linear-gradient(45deg, #ff69b4, #ff1493, #ff69b4)'
                    : 'transparent',
                  boxShadow: hasStories ? '0 0 0 3px rgba(255,105,180,0.45)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {/* White gap between ring and photo */}
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  padding: hasStories ? 2 : 0,
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}>
                  {/* Photo container */}
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: hasStories ? 'none' : '3px solid white',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
                    boxSizing: 'border-box',
                    position: 'relative',
                  }}>
                    <Image
                      src={profile.profilePic || '/default-avatar.svg'}
                      alt={profile.name || ''}
                      width={110}
                      height={110}
                      className={styles.profilePic}
                      style={{ borderRadius: '50%', objectFit: 'cover', display: 'block', width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* STORY label badge — same as index.js */}
              {hasStories && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
                  color: '#fff',
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  padding: '2px 9px',
                  borderRadius: 10,
                  letterSpacing: '0.5px',
                  boxShadow: '0 2px 6px rgba(255,20,147,0.5)',
                  whiteSpace: 'nowrap',
                }}>STORY</div>
              )}

              {profile.verified && (
                <span className={styles.verifiedBadge}>✓ Verified</span>
              )}

              {/* + button for own profile */}
              {isOwnProfile && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowPicMenu(true); }}
                  style={{
                    position: 'absolute', bottom: 4, right: -4,
                    background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
                    color: 'white', border: '2px solid white',
                    width: 28, height: 28, borderRadius: '50%',
                    fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    lineHeight: 1,
                  }}
                >+</button>
              )}
            </div>

            <h1 className={styles.name}>{profile.name || 'Anonymous'}</h1>
            {profile.membership && profile.membership !== 'Regular' && (
              <span className={`${styles.badge} ${styles[profile.membership.toLowerCase()]}`}>
                {profile.membership}
              </span>
            )}

            {isOwnProfile && profileViewers.length > 0 && (
              <button
                onClick={() => setShowViewersModal(true)}
                style={{
                  marginTop: 8,
                  background: 'none',
                  border: '1px solid #ff69b4',
                  borderRadius: 20,
                  padding: '6px 16px',
                  color: '#ff69b4',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                👁 {profileViewers.length} Profile {profileViewers.length === 1 ? 'View' : 'Views'}
              </button>
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

          {profile.bio && (
            <div className={styles.infoCard}>
              <h3>Bio</h3>
              <p>{profile.bio}</p>
            </div>
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

          {!isOwnProfile && (
            <div className={styles.callButtonContainer}>
              <button onClick={handleMessage} className={styles.callButton}>✉ Send Message</button>
            </div>
          )}

          <div className={styles.tabButtons}>
            <button onClick={() => setCurrentTab('posts')} className={currentTab === 'posts' ? styles.activeTab : ''}>Posts</button>
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
                    <Image src={getThumbnail(post.url)} alt="" width={400} height={400} className={locked ? styles.blurred : ''} />
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

          {isOwnProfile && (
            <div style={{ textAlign: 'center', margin: '30px 0', padding: '20px', borderTop: '1px solid #eee' }}>
              {currentTab === 'posts' && (
                <button onClick={() => { setPostIsExclusive(false); setShowCreatePostModal(true); }} className={styles.button} style={{ background: '#ff69b4', color: 'white', padding: '14px 32px', fontSize: '1.05rem' }}>
                  + Create New Post
                </button>
              )}
              {currentTab === 'exclusive' && (
                <button onClick={() => { setPostIsExclusive(true); setShowCreatePostModal(true); }} className={styles.button} style={{ background: '#c2185b', color: 'white', padding: '14px 32px', fontSize: '1.05rem' }}>
                  + Create Exclusive Post
                </button>
              )}
            </div>
          )}
        </main>

        {/* ── Profile Viewers Modal ── */}
        {showViewersModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowViewersModal(false)}>
            <div style={{ width: '100%', background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>👁 Profile Views ({profileViewers.length})</h3>
                <button onClick={() => setShowViewersModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#999' }}>×</button>
              </div>
              {profileViewers.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Image src={v.profilePic} alt={v.name} width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover' }} unoptimized />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{v.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                      {v.viewedAt ? new Date(v.viewedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile Pic Menu */}
        {showPicMenu && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowPicMenu(false)}>
            <div style={{ width: '100%', background: 'white', borderRadius: '20px 20px 0 0', padding: 20 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowPicMenu(false); setShowCreateStoryModal(true); }} style={{ display: 'block', width: '100%', padding: 15, border: 'none', background: 'none', textAlign: 'left', fontSize: 16 }}>Add to Story</button>
              <button onClick={() => { setShowPicMenu(false); profilePicInputRef.current.click(); }} style={{ display: 'block', width: '100%', padding: 15, border: 'none', background: 'none', textAlign: 'left', fontSize: 16 }}>Change Profile Picture</button>
              <input type="file" accept="image/*" onChange={handleProfilePicSelect} ref={profilePicInputRef} style={{ display: 'none' }} />
              <button onClick={() => setShowPicMenu(false)} style={{ display: 'block', width: '100%', padding: 15, border: 'none', background: 'none', textAlign: 'left', fontSize: 16, color: 'red' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Story Viewer ── */}
        {showStoryViewer && profile.stories?.length > 0 && (
          <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 3000, display: 'flex', flexDirection: 'column' }} onTouchStart={handleStoryTouchStart} onTouchEnd={handleStoryTouchEnd}>
            <div style={{ display: 'flex', gap: 4, padding: '12px 16px 0' }}>
              {profile.stories.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= currentStoryIndex ? '#ff69b4' : 'rgba(255,255,255,0.3)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', color: 'white' }}>
              <Image src={profile.profilePic || '/default-avatar.svg'} alt={profile.name || ''} width={40} height={40} style={{ borderRadius: '50%' }} unoptimized />
              <span style={{ fontWeight: 600 }}>{profile.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginLeft: 'auto' }}>
                {profile.stories[currentStoryIndex]?.createdAt
                  ? new Date(profile.stories[currentStoryIndex].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
            <button onClick={() => setShowStoryViewer(false)} style={{ position: 'absolute', top: 20, right: 16, background: 'none', border: 'none', color: 'white', fontSize: 30, zIndex: 10, cursor: 'pointer' }}>×</button>
            {isOwnProfile && (
              <button onClick={handleDeleteStory} style={{ position: 'absolute', top: 60, right: 16, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontSize: '0.8rem', padding: '6px 12px', borderRadius: 20, cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                🗑 Delete
              </button>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {isVideo(profile.stories[currentStoryIndex].url) ? (
                <video src={profile.stories[currentStoryIndex].url} autoPlay loop muted style={{ maxWidth: '100%', maxHeight: '100%' }} />
              ) : (
                <Image src={profile.stories[currentStoryIndex].url} alt="Story" fill style={{ objectFit: 'contain' }} unoptimized />
              )}
            </div>
            {isOwnProfile && (
              <div style={{ padding: '12px 20px 24px', color: 'white', background: 'rgba(0,0,0,0.6)' }}>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  👁 {viewers.length} {viewers.length === 1 ? 'view' : 'views'}
                </div>
                {viewers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {viewers.map((name, i) => (
                      <span key={i} style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem' }}>{name}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Story Modal */}
        {showCreateStoryModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreateStoryModal(false)}>
            <div className={styles.createPostModal} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowCreateStoryModal(false)} className={styles.modalBack}>←</button>
              <h2>Create Story</h2>
              <p className={styles.tip}>Photos/videos uploaded to Cloudinary. Stories expire after 24 hours.</p>
              <button onClick={() => storyFileInputRef.current.click()} className={styles.button}>Select Photos/Videos</button>
              <input type="file" accept="image/*,video/*" multiple onChange={handleStoryFileSelect} className={styles.hiddenFileInput} ref={storyFileInputRef} />
              <div className={styles.postPreviewGrid}>
                {storyPreviews.length === 0 && <p style={{ color: '#999', fontSize: '0.85rem' }}>No files selected</p>}
                {storyPreviews.map((preview, i) => (
                  <div key={i} className={styles.postPreviewItem}>
                    {storyFiles[i] && isVideo(storyFiles[i].name) ? (
                      <video src={preview} className={styles.postPreviewImg} controls muted />
                    ) : (
                      <Image src={preview} alt={`preview-${i}`} width={100} height={100} className={styles.postPreviewImg} unoptimized />
                    )}
                    <button onClick={() => handleRemoveStoryPreview(i)} className={styles.removePreview}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <button onClick={handleCreateStory} disabled={storyFiles.length === 0 || storyUploading} className={styles.button}>
                  {storyUploading ? 'Uploading...' : 'Post Story'}
                </button>
                <button onClick={() => { storyPreviews.forEach(u => URL.revokeObjectURL(u)); setStoryPreviews([]); setStoryFiles([]); setShowCreateStoryModal(false); }} className={styles.closeButton}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Create Post Modal */}
        {showCreatePostModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreatePostModal(false)}>
            <div className={styles.createPostModal} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowCreatePostModal(false)} className={styles.modalBack}>←</button>
              <h2>{postIsExclusive ? 'Create Exclusive Post' : 'Create Post'}</h2>
              <p className={styles.tip}>{postIsExclusive ? 'Only subscribers will see this.' : 'Visible to all visitors.'}</p>
              <button onClick={() => fileInputRef.current.click()} className={styles.button}>Select Photos/Videos</button>
              <input type="file" accept="image/*,video/*" multiple onChange={handlePostFileSelect} className={styles.hiddenFileInput} ref={fileInputRef} />
              <div className={styles.postPreviewGrid}>
                {postPreviews.length === 0 && <p style={{ color: '#999', fontSize: '0.85rem' }}>No files selected</p>}
                {postPreviews.map((preview, i) => (
                  <div key={i} className={styles.postPreviewItem}>
                    {postFiles[i] && isVideo(postFiles[i].name) ? (
                      <video src={preview} className={styles.postPreviewImg} controls muted />
                    ) : (
                      <Image src={preview} alt={`preview-${i}`} width={100} height={100} className={styles.postPreviewImg} unoptimized />
                    )}
                    <button onClick={() => handleRemovePostPreview(i)} className={styles.removePreview}>×</button>
                  </div>
                ))}
              </div>
              <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value.slice(0, 500))} placeholder="Caption..." rows={4} style={{ backgroundColor: '#ffffff', color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light', width: '100%', marginTop: 12, padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: '0.95rem', resize: 'vertical' }} />
              <div style={{ fontSize: '0.78rem', color: '#999', textAlign: 'right' }}>{postCaption.length}/500</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={postIsExclusive} onChange={(e) => setPostIsExclusive(e.target.checked)} />
                Mark as Exclusive
              </label>
              <div style={{ marginTop: 16 }}>
                <button onClick={handleCreatePost} disabled={postFiles.length === 0 || postUploading} className={styles.button}>
                  {postUploading ? 'Uploading...' : 'Post'}
                </button>
                <button onClick={() => { postPreviews.forEach(u => URL.revokeObjectURL(u)); setPostPreviews([]); setPostFiles([]); setShowCreatePostModal(false); }} className={styles.closeButton}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <h3>Subscribe to Unlock Exclusive Content</h3>
              <div className={styles.planGrid}>
                {subscriptionPlans.map(plan => (
                  <div key={plan.label} className={`${styles.planCard} ${selectedPlan?.label === plan.label ? styles.activePlan : ''}`} onClick={() => setSelectedPlan(plan)}>
                    <h4>{plan.label}</h4>
                    <p>KSh {plan.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              {selectedPlan && <p className={styles.selectedPlan}>Selected: {selectedPlan.label} – KSh {selectedPlan.amount.toLocaleString()}</p>}
              <input type="tel" placeholder="07xxxxxxxx" value={phoneNumber} onChange={handlePhoneChange} className={styles.phoneInput} />
              {phoneError && <p className={styles.phoneError}>{phoneError}</p>}
              <div className={styles.modalActions}>
                <button disabled={!selectedPlan || !!phoneError} onClick={() => handlePay(selectedPlan)}>Pay with M-Pesa</button>
                <button onClick={() => setShowPaymentModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Login Modal */}
        {showLogin && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { setShowLogin(false); setPendingAction(null); setLoginPrompt(''); }}>
            <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '40px 30px', width: '100%', maxWidth: '380px', color: '#333', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <span style={{ position: 'absolute', top: '10px', right: '20px', fontSize: '24px', cursor: 'pointer', color: '#ff69b4' }} onClick={() => { setShowLogin(false); setPendingAction(null); setLoginPrompt(''); }}>×</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '20px', color: '#ff69b4', textAlign: 'center' }}>Welcome Back</h2>
              {loginPrompt && <p style={{ color: '#ff69b4', fontWeight: 'bold', textAlign: 'center', margin: '0 0 15px' }}>Please login to {loginPrompt}</p>}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 6 }}>Email</label>
                  <input type="email" placeholder="you@example.com" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} required disabled={loginLoading} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 6 }}>Password</label>
                  <input type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} required disabled={loginLoading} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }} />
                </div>
                {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: '12px', borderRadius: '8px', marginBottom: 16 }}>{authError}</p>}
                <button type="submit" disabled={loginLoading} style={{ width: '100%', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', border: 'none', padding: '12px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: loginLoading ? 'not-allowed' : 'pointer' }}>
                  {loginLoading ? 'Logging in...' : 'Login'}
                </button>
                <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.9rem' }}>
                  Don&apos;t have an account?{' '}
                  <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setShowLogin(false); setShowRegister(true); }}>Register</span>
                </p>
              </form>
            </div>
          </div>
        )}

        {/* Register Modal */}
        {showRegister && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowRegister(false)}>
            <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '40px 30px', width: '100%', maxWidth: '380px', color: '#333', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <span style={{ position: 'absolute', top: '10px', right: '20px', fontSize: '24px', cursor: 'pointer', color: '#ff69b4' }} onClick={() => setShowRegister(false)}>×</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '20px', color: '#ff69b4', textAlign: 'center' }}>Create Account</h2>
              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 6 }}>Full Name</label>
                  <input type="text" placeholder="Full Name" value={registerForm.name} onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })} required style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 6 }}>Email</label>
                  <input type="email" placeholder="you@example.com" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} required style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 6 }}>Password (min 8 chars)</label>
                  <input type="password" placeholder="••••••••" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} required minLength={8} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }} />
                </div>
                {authError && <p style={{ color: '#d32f2f', background: '#ffebee', padding: '12px', borderRadius: '8px', marginBottom: 16 }}>{authError}</p>}
                <button type="submit" style={{ width: '100%', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', border: 'none', padding: '12px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Register</button>
                <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.9rem' }}>
                  Already have an account?{' '}
                  <span style={{ color: '#ff69b4', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setShowRegister(false); setShowLogin(true); }}>Login</span>
                </p>
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
                <Image src={selectedGallery[selectedIndex]} alt="" fill className={styles.viewerMedia} unoptimized />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}