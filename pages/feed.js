import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Head from 'next/head';
import Link from 'next/link';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { createOrGetChat } from '../lib/chat';
import styles from '../styles/Feed.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isVideo = (url) => /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(url || ''));

const getThumbnail = (url) => {
  if (!url) return '';
  try {
    if (/cloudinary\.com/i.test(url) && /\/video\/upload\//i.test(url)) {
      return url
        .replace('/video/upload/', '/image/upload/c_thumb,w_600,h_600,g_faces/')
        .replace(/\.(mp4|webm|ogg)(\?.*)?$/i, '.jpg');
    }
  } catch {}
  return url;
};

const getActiveStories = (stories) => {
  if (!Array.isArray(stories) || !stories.length) return [];
  const now = Date.now();
  return stories.filter(s => {
    const created = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
    return now - created.getTime() < 24 * 60 * 60 * 1000;
  });
};

// Firestore field keys cannot contain dots or slashes — encode the URL
const urlToKey = (url) => {
  // Replace all non-alphanumeric chars with underscores, keep it under 500 chars
  return String(url).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 400);
};

// ─── Login Modal ──────────────────────────────────────────────────────────────
const LoginModal = ({ onClose, onGoogleLogin, onEmailLogin, message }) => {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputStyle = {
    width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px',
    fontSize: '1rem', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)',
    boxSizing: 'border-box', marginBottom: 16,
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try { await onEmailLogin(email, password); onClose(); }
    catch (err) {
      const msgs = {
        'auth/invalid-credential': 'Wrong email or password.',
        'auth/user-not-found': 'No account found.',
        'auth/wrong-password': 'Incorrect password.',
      };
      setError(msgs[err.code] || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={onClose}>
      <div style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderRadius: 14, padding: '40px 30px', width: '100%', maxWidth: 380, color: '#333', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <span style={{ position: 'absolute', top: 12, right: 18, fontSize: 26, cursor: 'pointer', color: '#ff69b4', lineHeight: 1 }} onClick={onClose}>×</span>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 10, color: '#ff69b4', textAlign: 'center' }}>Welcome Back</h2>
        {message && <p style={{ color: '#ff69b4', fontWeight: 600, textAlign: 'center', marginBottom: 16, fontSize: '0.9rem' }}>{message}</p>}
        {!showEmail ? (
          <>
            <button
              onClick={async () => { setLoading(true); try { await onGoogleLogin(); onClose(); } catch {} setLoading(false); }}
              disabled={loading}
              style={{ width: '100%', background: 'linear-gradient(115deg, #4285f4, #db4437)', border: 'none', padding: '12px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: 'pointer', marginBottom: 12, fontWeight: 700 }}>
              {loading ? 'Authenticating…' : 'Continue with Google'}
            </button>
            <p style={{ textAlign: 'center', color: '#999', margin: '0 0 12px' }}>or</p>
            <button onClick={() => setShowEmail(true)} style={{ width: '100%', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', border: 'none', padding: '12px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
              Continue with Email
            </button>
          </>
        ) : (
          <form onSubmit={handleEmail}>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            {error && <p style={{ color: '#d32f2f', background: '#ffebee', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: '0.88rem' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', border: 'none', padding: '12px', fontSize: '1rem', color: '#fff', borderRadius: '8px', cursor: 'pointer', marginBottom: 10, fontWeight: 700 }}>
              {loading ? 'Logging in…' : 'Login'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: '#ff69b4', cursor: 'pointer', fontSize: '0.88rem', textDecoration: 'underline' }} onClick={() => setShowEmail(false)}>← Back</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Lock Overlay ─────────────────────────────────────────────────────────────
const LockOverlay = ({ count, onUnlock }) => (
  <div onClick={onUnlock} style={{
    position: 'absolute', inset: 0,
    background: 'linear-gradient(160deg, rgba(30,0,20,0.82) 0%, rgba(80,0,40,0.92) 100%)',
    backdropFilter: 'blur(12px)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 5, borderRadius: 'inherit',
  }}>
    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #ff69b4, #ff1493)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14, boxShadow: '0 0 30px rgba(255,20,147,0.6)' }}>🔒</div>
    <p style={{ color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Exclusive Content</p>
    {count > 0 && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', margin: '6px 0 0' }}>+{count} more inside</p>}
    <div style={{ marginTop: 18, padding: '10px 28px', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', borderRadius: 50, color: '#fff', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>Subscribe to Unlock</div>
  </div>
);

// ─── Feed Card ────────────────────────────────────────────────────────────────
const FeedCard = ({ profile, mediaUrl, isExclusive, isSubscribed, user, caption, onProfileClick, onMessage, onSubscribe, onRequireLogin }) => {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [liking, setLiking] = useState(false);

  const key = urlToKey(mediaUrl);

  // Seed likes from profile.postLikes[key] which is an array of uids
  const [likesArr, setLikesArr] = useState(() => {
    const stored = profile.postLikes?.[key];
    return Array.isArray(stored) ? stored : [];
  });

  const liked = user ? likesArr.includes(user.uid) : false;
  const locked = isExclusive && !isSubscribed;

  const membershipColor = {
    VVIP: 'linear-gradient(135deg, #ffd700, #ff8c00)',
    VIP:  'linear-gradient(135deg, #c084fc, #7c3aed)',
    Prime:'linear-gradient(135deg, #38bdf8, #0ea5e9)',
  }[profile.effectiveMembership || profile.membership] || null;

  const togglePlay = () => {
    if (!videoRef.current || locked) return;
    if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true); }
    else { videoRef.current.pause(); setPlaying(false); }
  };

  const handleLike = useCallback(async () => {
    if (!user) { onRequireLogin('Please login to like posts'); return; }
    if (liking) return;

    setLiking(true);
    const nowLiked = !liked;

    // Optimistic UI update
    setLikesArr(prev => nowLiked
      ? [...prev, user.uid]
      : prev.filter(id => id !== user.uid)
    );
    if (nowLiked) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 900); }

    try {
      // Read current array fresh from Firestore, then write back
      const profileRef = doc(db, 'profiles', profile.id);
      const snap = await getDoc(profileRef);
      const currentMap = snap.data()?.postLikes || {};
      const currentArr = Array.isArray(currentMap[key]) ? currentMap[key] : [];
      const updatedArr = nowLiked
        ? [...new Set([...currentArr, user.uid])]
        : currentArr.filter(id => id !== user.uid);

      await updateDoc(profileRef, {
        [`postLikes.${key}`]: updatedArr,
      });
    } catch (err) {
      console.error('Like failed:', err);
      // Revert on error
      setLikesArr(prev => nowLiked
        ? prev.filter(id => id !== user.uid)
        : [...prev, user.uid]
      );
    } finally {
      setLiking(false);
    }
  }, [user, liked, liking, profile.id, key, onRequireLogin]);

  const handleDoubleTap = () => {
    if (locked) return;
    if (!liked) handleLike();
  };

  return (
    <article style={{ width: '100%', maxWidth: 480, margin: '0 auto 20px', background: '#1a0010', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} onClick={() => onProfileClick(profile.id)}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', border: membershipColor ? '2px solid transparent' : '2px solid #ff69b4', background: membershipColor || '#ff69b4', padding: 2 }}>
            <div style={{ borderRadius: '50%', overflow: 'hidden', width: '100%', height: '100%' }}>
              <Image src={profile.profilePic || '/default-avatar.svg'} alt={profile.name || ''} width={46} height={46} style={{ objectFit: 'cover', width: '100%', height: '100%' }} unoptimized />
            </div>
          </div>
          {profile.verified && (
            <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#1d9bf0', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', border: '1.5px solid #1a0010' }}>✓</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{profile.name}</span>
            {(profile.effectiveMembership || profile.membership) && (profile.effectiveMembership || profile.membership) !== 'Regular' && (
              <span style={{ padding: '1px 8px', borderRadius: 50, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', color: '#fff', background: membershipColor || '#ff69b4' }}>
                {profile.effectiveMembership || profile.membership}
              </span>
            )}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', margin: 0 }}>
            {profile.ward && profile.county ? `${profile.ward}, ${profile.county}` : ''}
          </p>
        </div>
        {user && user.uid !== profile.id && (
          <button
            onClick={e => { e.stopPropagation(); onMessage(profile.id); }}
            style={{ padding: '6px 14px', borderRadius: 50, border: 'none', background: 'linear-gradient(115deg, #ff69b4, #ff1493)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Message
          </button>
        )}
      </div>

      {/* ── Media ── */}
      <div
        style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#0d000a', cursor: locked ? 'pointer' : isVideo(mediaUrl) ? 'pointer' : 'default' }}
        onDoubleClick={handleDoubleTap}
        onClick={isVideo(mediaUrl) && !locked ? togglePlay : undefined}
      >
        {isVideo(mediaUrl) ? (
          <>
            <video ref={videoRef} src={locked ? undefined : mediaUrl} poster={getThumbnail(mediaUrl)} loop muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: locked ? 'blur(18px) brightness(0.4)' : 'none' }} />
            {!locked && !playing && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                  <span style={{ color: '#fff', fontSize: 22, marginLeft: 4 }}>▶</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <Image src={locked ? getThumbnail(mediaUrl) : mediaUrl} alt="" fill sizes="480px"
            style={{ objectFit: 'cover', filter: locked ? 'blur(18px) brightness(0.4)' : 'none' }} unoptimized />
        )}

        {locked && (
          <LockOverlay
            count={Math.max(0, (profile.exclusivePics?.length || 1) - 1)}
            onUnlock={() => onSubscribe(profile)}
          />
        )}

        {likeAnim && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
            <span style={{ fontSize: 90, animation: 'heartBurst 0.9s ease forwards' }}>❤️</span>
          </div>
        )}

        {isExclusive && !locked && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 6, background: 'linear-gradient(115deg, #ff69b4, #ff1493)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: 50, letterSpacing: '0.04em' }}>EXCLUSIVE</div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={e => { e.stopPropagation(); handleLike(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center', gap: 5 }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(1.25)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span style={{ fontSize: 26, transition: 'transform 0.15s' }}>{liked ? '❤️' : '🤍'}</span>
          {likesArr.length > 0 && (
            <span style={{ color: liked ? '#ff69b4' : 'rgba(255,255,255,0.5)', fontSize: '0.82rem', fontWeight: 700 }}>
              {likesArr.length}
            </span>
          )}
        </button>
        <button onClick={() => onProfileClick(profile.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 24, lineHeight: 1 }}>💬</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => onProfileClick(profile.id)} style={{ background: 'none', border: '1px solid rgba(255,105,180,0.3)', color: '#ff69b4', fontSize: '0.75rem', fontWeight: 700, padding: '5px 14px', borderRadius: 50, cursor: 'pointer' }}>View Profile</button>
      </div>

      {/* ── Caption — same style/position as bio was ── */}
      {caption ? (
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', padding: '0 16px 14px', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          <span style={{ color: '#ff69b4', fontWeight: 700 }}>{profile.name?.split(' ')[0]} </span>
          {caption}
        </p>
      ) : null}
    </article>
  );
};

// ─── Story Viewer ─────────────────────────────────────────────────────────────
const StoryViewer = ({ profile, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const stories = profile.stories || [];
  const DURATION = 5000;

  useEffect(() => {
    const t = setTimeout(() => {
      if (currentIndex < stories.length - 1) setCurrentIndex(i => i + 1);
      else onClose();
    }, DURATION);
    return () => clearTimeout(t);
  }, [currentIndex, stories.length, onClose]);

  if (!stories.length) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9000, display: 'flex', flexDirection: 'column' }}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
          if (diff > 0 && currentIndex < stories.length - 1) setCurrentIndex(i => i + 1);
          else if (diff < 0 && currentIndex > 0) setCurrentIndex(i => i - 1);
        }
      }}
    >
      <div style={{ display: 'flex', gap: 4, padding: '12px 14px 0', position: 'relative', zIndex: 2 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #ff69b4, #ff1493)', width: i < currentIndex ? '100%' : '0%', animation: i === currentIndex ? `storyBarFill ${DURATION}ms linear forwards` : 'none' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', position: 'relative', zIndex: 2 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '3px solid #ff1493', flexShrink: 0 }}>
          <Image src={profile.profilePic || '/default-avatar.svg'} alt={profile.name || ''} width={40} height={40} style={{ objectFit: 'cover', display: 'block', width: '100%', height: '100%' }} unoptimized />
        </div>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{profile.name}</span>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', marginLeft: 4 }}>
          {stories[currentIndex]?.createdAt
            ? new Date(stories[currentIndex].createdAt?.toDate ? stories[currentIndex].createdAt.toDate() : stories[currentIndex].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''}
        </span>
      </div>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 14, background: 'none', border: 'none', color: '#fff', fontSize: 30, cursor: 'pointer', zIndex: 10, lineHeight: 1 }}>×</button>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 3 }}>
        <div style={{ flex: 1 }} onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} />
        <div style={{ flex: 1 }} onClick={() => { if (currentIndex < stories.length - 1) setCurrentIndex(i => i + 1); else onClose(); }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {isVideo(stories[currentIndex].url)
          ? <video src={stories[currentIndex].url} autoPlay loop muted playsInline style={{ maxWidth: '100%', maxHeight: '100%' }} />
          : <Image src={stories[currentIndex].url} alt="Story" fill style={{ objectFit: 'contain' }} unoptimized />}
      </div>
      <div style={{ padding: '16px 20px 36px', textAlign: 'center', zIndex: 4, position: 'relative' }}>
        <Link href={`/view-profile/${profile.id}`}>
          <button onClick={onClose} style={{ background: 'linear-gradient(135deg, #ff69b4, #ff1493)', border: 'none', color: '#fff', padding: '10px 32px', borderRadius: 24, fontSize: '0.9rem', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 14px rgba(255,20,147,0.45)' }}>
            View Profile →
          </button>
        </Link>
      </div>
      <style>{`@keyframes storyBarFill { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
};

// ─── Stories Row ──────────────────────────────────────────────────────────────
const StoriesRow = ({ profiles, onStoryClick }) => {
  const withStories = profiles.filter(p => getActiveStories(p.stories).length > 0);
  if (!withStories.length) return null;
  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '12px 16px 14px', scrollbarWidth: 'none', msOverflowStyle: 'none', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      {withStories.map(p => (
        <div key={p.id} onClick={() => onStoryClick(p)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '3px solid #ff1493', boxShadow: '0 0 0 2px rgba(255,105,180,0.45)', boxSizing: 'border-box' }}>
            <Image src={p.profilePic || '/default-avatar.svg'} alt={p.name || ''} width={64} height={64} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
          </div>
          <div style={{ background: 'linear-gradient(135deg, #ff69b4, #ff1493)', color: '#fff', fontSize: '0.55rem', fontWeight: 700, padding: '1px 7px', borderRadius: 8, letterSpacing: '0.5px', boxShadow: '0 1px 4px rgba(255,20,147,0.5)' }}>STORY</div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', maxWidth: 64, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name?.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Subscribe Modal ──────────────────────────────────────────────────────────
const SubscribeModal = ({ profile, onClose, onPay, user }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const plans = [
    { label: '3 Days',  amount: 499,  duration: 3  },
    { label: '7 Days',  amount: 999,  duration: 7  },
    { label: '15 Days', amount: 1999, duration: 15 },
    { label: '30 Days', amount: 4999, duration: 30 },
  ];
  const handlePhone = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('0')) val = '254' + val.slice(1);
    else if (!val.startsWith('254') && val.length === 9) val = '254' + val;
    setPhone(val);
    setPhoneErr(/^254[71]\d{8}$/.test(val) ? '' : 'Enter a valid Kenyan number');
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#1a0010', borderRadius: '24px 24px 0 0', padding: '28px 24px 40px', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 50, margin: '0 auto 24px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', border: '2px solid #ff69b4' }}>
            <Image src={profile.profilePic || '/default-avatar.svg'} alt={profile.name || ''} width={52} height={52} style={{ objectFit: 'cover' }} unoptimized />
          </div>
          <div>
            <h3 style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Subscribe to {profile.name}</h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', margin: 0 }}>Unlock all exclusive content</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {plans.map(p => (
            <div key={p.label} onClick={() => setSelectedPlan(p)} style={{ padding: '14px 10px', borderRadius: 14, textAlign: 'center', cursor: 'pointer', border: `2px solid ${selectedPlan?.label === p.label ? '#ff1493' : 'rgba(255,255,255,0.1)'}`, background: selectedPlan?.label === p.label ? 'rgba(255,20,147,0.15)' : 'rgba(255,255,255,0.04)', transition: 'all 0.2s' }}>
              <div style={{ color: '#ff69b4', fontWeight: 800, fontSize: '0.85rem' }}>{p.label}</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginTop: 4 }}>KSh {p.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <input type="tel" placeholder="07xxxxxxxx" value={phone} onChange={handlePhone} style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
        {phoneErr && <p style={{ color: '#ff6b6b', fontSize: '0.78rem', margin: '0 0 12px' }}>{phoneErr}</p>}
        <button
          disabled={!selectedPlan || !!phoneErr || !phone}
          onClick={() => onPay(profile, selectedPlan, phone)}
          style={{ width: '100%', padding: '15px', border: 'none', borderRadius: 14, background: (!selectedPlan || phoneErr || !phone) ? 'rgba(255,255,255,0.1)' : 'linear-gradient(115deg, #ff69b4, #ff1493)', color: (!selectedPlan || phoneErr || !phone) ? 'rgba(255,255,255,0.3)' : '#fff', fontSize: '1rem', fontWeight: 800, cursor: (!selectedPlan || phoneErr || !phone) ? 'not-allowed' : 'pointer' }}>
          Pay with M-Pesa
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [user, setUser] = useState(null);
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [subscribeTarget, setSubscribeTarget] = useState(null);
  const [storyProfile, setStoryProfile] = useState(null);
  const [loginModal, setLoginModal] = useState({ show: false, message: '' });
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // ── Auth ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        const raw = localStorage.getItem('loggedInUser');
        setUser(raw ? JSON.parse(raw) : { uid: currentUser.uid });
      } else {
        setUser(null);
      }
    });
    return unsub;
  }, []);

  // ── Profiles (live) ──
  useEffect(() => {
    const q = query(collection(db, 'profiles'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.active !== false && p.hidden !== true && p.profilePic);
      data = data.map(p => ({ ...p, stories: getActiveStories(p.stories) }));
      setProfiles(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Subscriptions ──
  useEffect(() => {
    if (!user?.uid || !profiles.length) return;
    profiles.forEach(async (p) => {
      try {
        const snap = await getDoc(doc(db, 'subscriptions', `${user.uid}_${p.id}`));
        if (snap.exists() && snap.data()?.expiresAt?.toDate() > new Date()) {
          setSubscriptions(prev => ({ ...prev, [p.id]: true }));
        }
      } catch {}
    });
  }, [user, profiles]);

  // ── Build feed items ──
  // Captions are stored on the profile doc under postCaptions[urlKey]
  // Likes are stored on the profile doc under postLikes[urlKey] (array of uids)
  useEffect(() => {
    if (!profiles.length) return;
    const items = [];
    profiles.forEach(profile => {
      (profile.normalPics || []).forEach(url => {
        const k = urlToKey(url);
        items.push({
          profile,
          url,
          isExclusive: false,
          caption: profile.postCaptions?.[k] || '',
        });
      });
      (profile.exclusivePics || []).forEach((url, i, arr) => {
        const k = urlToKey(url);
        items.push({
          profile,
          url,
          isExclusive: true,
          exclusiveTotal: arr.length,
          caption: profile.postCaptions?.[k] || '',
        });
      });
    });

    // Interleave so one creator doesn't dominate
    const byProfile = {};
    items.forEach(item => {
      if (!byProfile[item.profile.id]) byProfile[item.profile.id] = [];
      byProfile[item.profile.id].push(item);
    });
    const pids = Object.keys(byProfile);
    const maxLen = Math.max(...pids.map(p => byProfile[p].length), 0);
    const interleaved = [];
    for (let i = 0; i < maxLen; i++) {
      pids.forEach(pid => { if (byProfile[pid][i]) interleaved.push(byProfile[pid][i]); });
    }
    setFeedItems(interleaved);
  }, [profiles]);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dx > 80 && dy < 50) router.push('/');
  }, [router]);

  const handleProfileClick = (id) => router.push(`/view-profile/${id}`);

  const handleMessage = async (profileId) => {
    if (!user) { setLoginModal({ show: true, message: 'Please login to send messages' }); return; }
    try { const chatId = await createOrGetChat(user.uid || user.id, profileId); router.push(`/inbox/${chatId}`); }
    catch { alert('Could not open chat. Try again.'); }
  };

  const handleSubscribe = (profile) => {
    if (!user) { setLoginModal({ show: true, message: 'Please login to subscribe' }); return; }
    setSubscribeTarget(profile);
  };

  const handlePay = async (profile, plan, phone) => {
    try {
      const res = await fetch('/api/mpesa-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid || user.id, creatorId: profile.id, amount: plan.amount, durationDays: plan.duration, phoneNumber: phone }),
      });
      const data = await res.json();
      if (data.success) {
        alert('STK push sent! Check your phone.');
        setSubscribeTarget(null);
        setSubscriptions(prev => ({ ...prev, [profile.id]: true }));
      } else { alert(data.message || 'Payment failed'); }
    } catch { alert('Payment error'); }
  };

  const handleOwnProfile = () => { if (user) router.push(`/view-profile/${user.uid}`); else router.push('/'); };
  const handleRequireLogin = (message) => setLoginModal({ show: true, message });

  const handleGoogleLogin = async () => {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const { auth: fa } = await import('../lib/firebase');
    const result = await signInWithPopup(fa, new GoogleAuthProvider());
    const raw = localStorage.getItem('loggedInUser');
    setUser(raw ? JSON.parse(raw) : { uid: result.user.uid });
  };

  const handleEmailLogin = async (email, password) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { auth: fa } = await import('../lib/firebase');
    await signInWithEmailAndPassword(fa, email, password);
  };

  return (
    <>
      <Head>
        <title>Feed · Meet Connect</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes heartBurst {
            0%   { transform: scale(0);   opacity: 1; }
            50%  { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(1);   opacity: 0; }
          }
        `}</style>
      </Head>

      <div className={styles.mainWrapper} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        {/* Top Nav */}
        <div style={{ position: 'sticky', top: 0, zIndex: 200, background: 'linear-gradient(180deg, #0d000a 80%, transparent)', padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 22 }}>←</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💕</span>
            <span style={{ fontFamily: "'Playfair Display', serif", color: '#fff', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Meet Connect</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button onClick={() => router.push('/inbox')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 22 }}>✉</button>
            <button onClick={handleOwnProfile} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 22 }}>👤</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 16px 4px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {['Feed', 'Discover'].map((tab, i) => (
            <button key={tab} onClick={() => i === 1 && router.push('/')}
              style={{ flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer', color: i === 0 ? '#ff69b4' : 'rgba(255,255,255,0.35)', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '0.9rem', borderBottom: i === 0 ? '2px solid #ff69b4' : '2px solid transparent', transition: 'all 0.2s' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Stories */}
        <StoriesRow profiles={profiles} onStoryClick={p => setStoryProfile(p)} />

        {/* Feed */}
        <div className={styles.feedContainer}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ maxWidth: 480, margin: '0 auto 20px', borderRadius: 20, overflow: 'hidden', background: '#1a0010' }}>
                <div style={{ height: 56, background: 'rgba(255,255,255,0.04)' }} />
                <div style={{ aspectRatio: '1/1', background: 'rgba(255,255,255,0.03)' }} />
                <div style={{ height: 60, background: 'rgba(255,255,255,0.04)' }} />
              </div>
            ))
          ) : feedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>📷</div>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem' }}>No posts yet</p>
              <p style={{ fontSize: '0.85rem', marginTop: 8 }}>Be the first to post!</p>
            </div>
          ) : (
            feedItems.map((item, i) => (
              <div key={`${item.profile.id}-${item.url}-${i}`} className={styles.cardWrapper}>
                <FeedCard
                  profile={item.profile}
                  mediaUrl={item.url}
                  isExclusive={item.isExclusive}
                  isSubscribed={!!subscriptions[item.profile.id]}
                  user={user}
                  caption={item.caption}
                  onProfileClick={handleProfileClick}
                  onMessage={handleMessage}
                  onSubscribe={handleSubscribe}
                  onRequireLogin={handleRequireLogin}
                />
              </div>
            ))
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(13,0,10,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-around', padding: '10px 0 20px' }}>
          {[
            { icon: '🏠', label: 'Home',    path: '/' },
            { icon: '📸', label: 'Feed',    path: '/feed', active: true },
            { icon: '💌', label: 'Inbox',   path: '/inbox' },
            { icon: '👤', label: 'Profile', onClick: handleOwnProfile },
          ].map(item => (
            <button key={item.label} onClick={item.onClick || (() => router.push(item.path))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: item.active ? '#ff69b4' : 'rgba(255,255,255,0.35)', transition: 'color 0.2s' }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {subscribeTarget && <SubscribeModal profile={subscribeTarget} onClose={() => setSubscribeTarget(null)} onPay={handlePay} user={user} />}
      {storyProfile && <StoryViewer profile={storyProfile} onClose={() => setStoryProfile(null)} />}
      {loginModal.show && (
        <LoginModal
          message={loginModal.message}
          onClose={() => setLoginModal({ show: false, message: '' })}
          onGoogleLogin={handleGoogleLogin}
          onEmailLogin={handleEmailLogin}
        />
      )}
    </>
  );
}
