import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import * as locations from '../data/locations';
import styles from '../styles/ProfileSetup.module.css';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, query, where, getDocs, arrayUnion, updateDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import StkPushForm from '../components/StkPushForm';

const ACTIVATION_FEE = 300;

// Same key function used in feed.js — must match exactly
const urlToKey = (url) => String(url).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 400);

export default function ProfileSetup() {
  const router = useRouter();
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    phone: '',
    gender: 'Female',
    sexualOrientation: 'Straight',
    age: '18',
    nationality: '',
    county: '',
    ward: '',
    area: '',
    nearby: [],
    bio: '',
    profilePic: '',
    normalPics: [],
    exclusivePics: [],
    verified: false,
    createdAt: null,
    hidden: true,
    activationPaid: false,
    regularLifetime: false,
  });
  const [selectedWard, setSelectedWard] = useState('');
  const [membership, setMembership] = useState('Regular');
  const [fundingBalance, setFundingBalance] = useState(0);
  const [earningsBalance, setEarningsBalance] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [verificationRequested, setVerificationRequested] = useState(false);
  // Activation modal
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationLocked, setActivationLocked] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [checkoutRequestID, setCheckoutRequestID] = useState(null);
  const pollingInterval = useRef(null);
  // Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receipt, setReceipt] = useState(null);
  // Deactivation modal
  const [showDeactivationModal, setShowDeactivationModal] = useState(false);
  // Membership modals & payment
  const [showModal, setShowModal] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet');
  const [upgradeLocked, setUpgradeLocked] = useState(false);
  // Upgrade price preview (credit calculation)
  const [upgradePreview, setUpgradePreview] = useState(null); // { effectivePrice, credit, remainingDays, fullPrice, willExtend }
  const [previewLoading, setPreviewLoading] = useState(false);
  // Add funds / withdraw
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [addFundLocked, setAddFundLocked] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  // Transactions
  const [showEarningsHistory, setShowEarningsHistory] = useState(false);
  const [transactions, setTransactions] = useState([]);
  // My Subscriptions (as subscriber)
  const [showMySubscriptions, setShowMySubscriptions] = useState(false);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  // Create post states
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [postFiles, setPostFiles] = useState([]);
  const [postPreviews, setPostPreviews] = useState([]);
  const [postCaption, setPostCaption] = useState('');
  const [postIsExclusive, setPostIsExclusive] = useState(false);
  const [postUploading, setPostUploading] = useState(false);
  const [showInappropriateBanner, setShowInappropriateBanner] = useState(false);
  // Gallery & viewer
  const [showPostsModal, setShowPostsModal] = useState(false);
  const [showExclusiveModal, setShowExclusiveModal] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const touchStartX = useRef(0);
  const [mpesaPhone, setMpesaPhone] = useState('');
  // Profile pic
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState('');
  const steps = ['Profile', 'Location', 'Bio', 'Media', 'Membership & Wallets'];
  const [activeStep, setActiveStep] = useState(0);
  const fileInputRef = useRef(null);
  const profilePicInputRef = useRef(null);
  // Menu and deactivate
  const [showMenu, setShowMenu] = useState(false);
  const [deactivateReasons, setDeactivateReasons] = useState([]);
  const [otherReason, setOtherReason] = useState('');
  const reasons = ['Not interested anymore', 'Too expensive', 'Found alternative', 'Privacy concerns', 'Technical issues', 'Other'];
  // Guards for snapshot writes
  const didBackfillCreatedAt = useRef(false);
  const didHandleExpiry = useRef(false);
  // Receipts history
  const [showReceiptsHistory, setShowReceiptsHistory] = useState(false);
  const [receipts, setReceipts] = useState([]);

  // ─── Plans (shared with API) ──────────────────────────────────────────────
  const plans = useMemo(() => ({
    Prime: { '7 Days': 300, '15 Days': 600, '30 Days': 1000 },
    VIP:   { '7 Days': 600, '15 Days': 1200, '30 Days': 2000 },
    VVIP:  { '7 Days': 900, '15 Days': 1500, '30 Days': 3000 },
  }), []);

  // ─── Load profile & subscriptions ────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('loggedInUser');
    if (!raw) { router.push('/'); return; }
    const user = JSON.parse(raw);
    setLoggedInUser(user);
    const profileRef = doc(db, 'profiles', user.id);
    const unsub = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const loadedPhone = (data.phone || '').replace(/[^\d]/g, '');
        if (!data.createdAt && !didBackfillCreatedAt.current) {
          didBackfillCreatedAt.current = true;
          setDoc(profileRef, { createdAt: serverTimestamp() }, { merge: true }).catch(console.error);
        }
        let effectiveMembership = data.membership || 'Regular';
        if (data.membershipExpiresAt && data.membershipExpiresAt.seconds) {
          const expiresAt = new Date(data.membershipExpiresAt.seconds * 1000);
          if (expiresAt < new Date() && !didHandleExpiry.current) {
            didHandleExpiry.current = true;
            effectiveMembership = 'Regular';
            setDoc(profileRef, { membership: 'Regular', membershipExpiresAt: null, hidden: data.activationPaid ? false : true }, { merge: true }).catch(() => {});
          }
        }
        setFormData((prev) => ({
          ...prev, ...data,
          username: user.username,
          phone: loadedPhone,
          bio: data.bio || '',
          nearby: data.nearby || [],
          normalPics: data.normalPics || [],
          exclusivePics: data.exclusivePics || [],
          age: data.age || prev.age,
          verified: data.verified || false,
          hidden: data.hidden ?? true,
          activationPaid: data.activationPaid ?? false,
          regularLifetime: data.regularLifetime ?? false,
        }));
        setSelectedWard(data.ward || '');
        setFundingBalance(data.fundingBalance || 0);
        setEarningsBalance(data.earningsBalance || 0);
        setMembership(effectiveMembership);
        setMpesaPhone(loadedPhone);
        setVerificationRequested(!!data.verificationRequested);
      } else {
        setFormData((prev) => ({ ...prev, username: user.username }));
        setFundingBalance(0); setEarningsBalance(0); setMembership('Regular');
      }
      setLoading(false);
    }, (err) => {
      console.error('profile snapshot error', err);
      setError('Failed to load profile. Please refresh.');
      setLoading(false);
    });

    (async function fetchTxs() {
      try {
        const q = query(collection(db, 'subscriptions'), where('creatorId', '==', user.id));
        const snapshot = await getDocs(q);
        const txs = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data();
          let userName = 'Unknown';
          try { const s = await getDoc(doc(db, 'profiles', data.userId)); userName = s.exists() ? s.data().name || 'Unknown' : 'Unknown'; } catch {}
          return { id: d.id, userName, amount: data.amount, duration: data.durationDays || data.duration, date: data.updatedAt ? data.updatedAt.toDate().toLocaleString() : '', expiresAt: data.expiresAt ? data.expiresAt.toDate().toLocaleString() : '' };
        }));
        setTransactions(txs.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (e) { console.error('Failed to fetch transactions', e); }
    })();

    (async function fetchMySubs() {
      try {
        const q = query(collection(db, 'subscriptions'), where('userId', '==', user.id));
        const snapshot = await getDocs(q);
        const subs = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data();
          let creatorName = 'Unknown', creatorPic = '';
          try { const s = await getDoc(doc(db, 'profiles', data.creatorId)); if (s.exists()) { creatorName = s.data().name || 'Unknown'; creatorPic = s.data().profilePic || ''; } } catch {}
          const expiresAtDate = data.expiresAt ? data.expiresAt.toDate() : null;
          return { id: d.id, creatorId: data.creatorId, creatorName, creatorPic, amount: data.amount, duration: data.durationDays || data.duration, date: data.updatedAt ? data.updatedAt.toDate().toLocaleString() : '', expiresAt: expiresAtDate ? expiresAtDate.toLocaleString() : '', isActive: expiresAtDate && expiresAtDate > new Date() };
        }));
        setMySubscriptions(subs.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (e) { console.error('Failed to fetch my subscriptions', e); }
    })();

    (async function fetchReceipts() {
      try {
        const q = query(collection(db, 'receipts'), where('userId', '==', user.id));
        const snapshot = await getDocs(q);
        const recs = snapshot.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().createdAt ? d.data().createdAt.toDate().toLocaleString() : '' }));
        setReceipts(recs.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (e) { console.error('Failed to fetch receipts', e); }
    })();

    return () => {
      unsub();
      postPreviews.forEach((u) => URL.revokeObjectURL(u));
      if (profilePicPreview) URL.revokeObjectURL(profilePicPreview);
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ─── Receipt helper ───────────────────────────────────────────────────────
  const showPaymentReceipt = (receiptData) => {
    setReceipt(receiptData);
    setShowReceiptModal(true);
    if (loggedInUser) {
      setDoc(doc(collection(db, 'receipts'), `rec_${Date.now()}`), {
        userId: loggedInUser.id, username: loggedInUser.username,
        ...receiptData, createdAt: serverTimestamp(),
      }).catch(console.error);
    }
  };

  // ─── Polling for activation payment ──────────────────────────────────────
  useEffect(() => {
    if (paymentStatus === 'initiated' && checkoutRequestID) {
      pollingInterval.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/checkStk?requestId=${checkoutRequestID}`);
          const data = await res.json();
          if (data.ResultCode === '0') {
            setPaymentStatus('idle');
            clearInterval(pollingInterval.current);
            setShowActivationModal(false);
            showPaymentReceipt({
              type: 'activation',
              title: 'Profile Activated Successfully! 🎉',
              membership: 'Prime',
              duration: 'Lifetime Visibility + 7 Days Prime Bonus',
              amount: ACTIVATION_FEE,
              date: new Date().toLocaleString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
              reference: `ACT-${shortenUserId(loggedInUser?.id || '').toUpperCase()}`,
              phone: mpesaPhone || formData.phone,
              paymentMethod: 'M-Pesa',
              status: 'Payment Successful',
              message: 'Your profile is now LIVE and visible to all gentlemen across Kenya! ✨ Enjoy your 7 days Prime bonus and start connecting today.',
            });
            // Auto redirect to homepage after receipt
            setTimeout(() => router.push('/'), 2800);
          } else if (data.ResultCode !== '4999') {
            setPaymentStatus('failed');
            clearInterval(pollingInterval.current);
            setActivationLocked(false);
          }
        } catch (err) {
          console.error('Polling error', err);
          setPaymentStatus('failed');
          clearInterval(pollingInterval.current);
          setActivationLocked(false);
        }
      }, 10000);
      return () => clearInterval(pollingInterval.current);
    }
  }, [paymentStatus, checkoutRequestID, mpesaPhone, formData.phone, router]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatPhoneForMpesa = (phone) => {
    if (!phone) throw new Error('Phone number is required');
    let f = phone.replace(/[^\d]/g, '');
    if (f.startsWith('0')) f = '254' + f.slice(1);
    else if (f.length === 9 && f.startsWith('7')) f = '254' + f;
    if (f.length !== 12 || !f.startsWith('2547')) throw new Error('Invalid M-Pesa phone number. Use 07XXXXXXXX format.');
    return f;
  };
  const shortenUserId = (id) => id ? id.slice(-10) : '';
  const isVideo = (urlOrFile) => {
    if (!urlOrFile) return false;
    if (typeof urlOrFile === 'object' && urlOrFile.type) return urlOrFile.type.startsWith('video/');
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(urlOrFile));
  };
  const getThumbnail = (url) => {
    if (!url) return '';
    try {
      if (/\bcloudinary\.com\b/i.test(url) && /\/video\/upload\//i.test(url)) {
        return url.replace('/video/upload/', '/image/upload/c_thumb,w_200,h_200,g_center/').replace(/\.(mp4|webm|ogg)(\?.*)?$/i, '.jpg');
      }
    } catch {}
    return url;
  };

  // Get Firebase ID token for authenticated API calls
  const getIdToken = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    return currentUser.getIdToken();
  };

  // ─── Form handlers ────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'nearby') {
      setFormData((prev) => {
        const current = prev.nearby || [];
        if (checked) {
          if (current.includes(value)) return prev;
          if (current.length >= 4) { setError('You can select up to 4 nearby locations only.'); return prev; }
          return { ...prev, nearby: [...current, value] };
        } else { return { ...prev, nearby: current.filter((v) => v !== value) }; }
      });
      return;
    }
    if (name === 'bio') { setFormData((prev) => ({ ...prev, [name]: value })); return; }
    let v = value;
    if (name === 'phone') {
      v = value.replace(/[^\d]/g, '');
      setMpesaPhone(v);
      try { formatPhoneForMpesa(v); setError(''); } catch (err) { if (v.length > 0) setError(err.message); }
    }
    if (name === 'county') { setFormData((prev) => ({ ...prev, county: v, ward: '', area: '', nearby: [] })); setSelectedWard(''); return; }
    setFormData((prev) => ({ ...prev, [name]: v }));
  };
  const handleWardChange = (e) => { const ward = e.target.value; setSelectedWard(ward); setFormData((prev) => ({ ...prev, ward, area: '', nearby: [] })); };
  const handleAreaChange = (e) => setFormData((prev) => ({ ...prev, area: e.target.value }));
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (profilePicPreview) URL.revokeObjectURL(profilePicPreview);
    setProfilePicFile(file);
    setProfilePicPreview(URL.createObjectURL(file));
  };

  // ─── Post file selection ──────────────────────────────────────────────────
  const handlePostFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const allowed = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const oversize = allowed.find((f) => f.size > 50 * 1024 * 1024);
    if (oversize) { setError('One of the files exceeds 50MB limit.'); return; }
    if (postFiles.length + allowed.length > 10) { setError('Maximum 10 files per post.'); return; }
    setPostFiles((prev) => [...prev, ...allowed]);
    setPostPreviews((prev) => [...prev, ...allowed.map((f) => URL.createObjectURL(f))]);
    setError('');
  };
  const handleRemovePostPreview = (index) => {
    setPostPreviews((prev) => { const url = prev[index]; if (url) URL.revokeObjectURL(url); return prev.filter((_, i) => i !== index); });
    setPostFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Create post — NOW SAVES CAPTIONS ────────────────────────────────────
  const handleCreatePost = async () => {
    if (!loggedInUser || postFiles.length === 0) return;
    setPostUploading(true);
    setError('');
    setShowInappropriateBanner(false);
    try {
      const uploadedUrls = [];
      for (let i = 0; i < postFiles.length; i++) {
        const file = postFiles[i];
        const fd = new FormData();
        fd.append('media', file);
        fd.append('userId', loggedInUser.id);
        fd.append('isExclusive', postIsExclusive ? 'true' : 'false');
        fd.append('caption', postCaption || '');
        const res = await fetch('/api/uploadPost', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) {
          if (data?.error === 'Inappropriate content detected') { setShowInappropriateBanner(true); } else { throw new Error(data.error || 'Upload failed'); }
          return;
        }
        uploadedUrls.push(data.url);
      }

      const fieldToUpdate = postIsExclusive ? 'exclusivePics' : 'normalPics';
      const profileRef = doc(db, 'profiles', loggedInUser.id);

      // Build caption updates: postCaptions.{urlKey} = caption
      // Only save if caption is non-empty
      const captionUpdates = {};
      if (postCaption.trim()) {
        uploadedUrls.forEach(url => {
          captionUpdates[`postCaptions.${urlToKey(url)}`] = postCaption.trim();
        });
      }

      await updateDoc(profileRef, {
        [fieldToUpdate]: arrayUnion(...uploadedUrls),
        ...captionUpdates,
      });

      setFormData((prev) => ({
        ...prev,
        [fieldToUpdate]: [...(prev[fieldToUpdate] || []), ...uploadedUrls],
      }));

      postPreviews.forEach((u) => URL.revokeObjectURL(u));
      setPostPreviews([]); setPostFiles([]); setPostCaption(''); setPostIsExclusive(false); setShowCreatePostModal(false);
      alert('Post created successfully!');
    } catch (err) {
      console.error('Create post failed', err);
      setError(`Failed to create post: ${err.message || err}`);
    } finally {
      setPostUploading(false);
    }
  };

  // ─── Remove media ─────────────────────────────────────────────────────────
  const handleRemoveNormalPic = async (index) => {
    const newList = (formData.normalPics || []).filter((_, i) => i !== index);
    setFormData((p) => ({ ...p, normalPics: newList }));
    await setDoc(doc(db, 'profiles', loggedInUser.id), { normalPics: newList }, { merge: true });
  };
  const handleRemoveExclusivePic = async (index) => {
    const newList = (formData.exclusivePics || []).filter((_, i) => i !== index);
    setFormData((p) => ({ ...p, exclusivePics: newList }));
    await setDoc(doc(db, 'profiles', loggedInUser.id), { exclusivePics: newList }, { merge: true });
  };

  // ─── Media viewer ─────────────────────────────────────────────────────────
  const handleMediaClick = (gallery, index) => {
    if (!Array.isArray(gallery) || gallery.length === 0) return;
    setSelectedGallery(gallery); setSelectedIndex(index || 0); setShowMediaViewer(true);
  };
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX.current - touchEndX > 50) setSelectedIndex((prev) => (prev < selectedGallery.length - 1 ? prev + 1 : 0));
    else if (touchEndX - touchStartX.current > 50) setSelectedIndex((prev) => (prev > 0 ? prev - 1 : selectedGallery.length - 1));
  };

  // ─── Validation ───────────────────────────────────────────────────────────
  const getStepErrors = (step) => {
    const errors = [];
    switch (step) {
      case 0:
        if (!formData.name) errors.push('Name');
        if (!formData.phone) errors.push('Phone');
        if (!formData.age) errors.push('Age');
        if (!profilePicFile && !formData.profilePic) errors.push('Profile Picture');
        if (isNaN(parseInt(formData.age, 10)) || parseInt(formData.age, 10) < 18) errors.push('You must be 18 or older.');
        try { formatPhoneForMpesa(formData.phone); } catch { errors.push('Invalid phone format'); }
        return errors;
      case 1:
        if (!formData.county) errors.push('County');
        if (!formData.ward) errors.push('City/Town');
        if (!formData.area) errors.push('Area');
        if ((formData.nearby || []).length > 4) errors.push('Up to 4 nearby locations only.');
        return errors;
      case 2:
        if (formData.bio.trim().split(/\s+/).length > 100) errors.push('Bio must be 100 words or less.');
        return errors;
      default: return [];
    }
  };
  const isStepValid = (step) => getStepErrors(step).length === 0;
  const findInvalidStep = () => { for (let i = 0; i < 3; i++) { if (!isStepValid(i)) return i; } return -1; };
  const handleNextStep = () => {
    const errors = getStepErrors(activeStep);
    if (errors.length === 0) { setError(''); setActiveStep((s) => Math.min(s + 1, steps.length - 1)); }
    else setError(`Please fix: ${errors.join(', ')}`);
  };
  const handlePrevStep = () => setActiveStep((s) => Math.max(s - 1, 0));

  // ─── Save profile ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true); setError('');
    const invalidStep = findInvalidStep();
    if (invalidStep !== -1) {
      setActiveStep(invalidStep);
      setError(`Please fix in ${steps[invalidStep]}: ${getStepErrors(invalidStep).join(', ')}`);
      setSaveLoading(false); return;
    }
    let profilePicUrl = formData.profilePic;
    if (profilePicFile) {
      try {
        const fd = new FormData(); fd.append('image', profilePicFile);
        const res = await fetch('/api/uploadProfilePic', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) { setError(data.error || 'Failed to upload image.'); setSaveLoading(false); return; }
        profilePicUrl = data.url;
      } catch (err) { console.error('profile pic upload error', err); setError('Failed to process image.'); setSaveLoading(false); return; }
    }
    try {
      await setDoc(doc(db, 'profiles', loggedInUser.id), {
        name: formData.name, phone: formData.phone, gender: formData.gender,
        sexualOrientation: formData.sexualOrientation, age: formData.age,
        nationality: formData.nationality, county: formData.county,
        ward: formData.ward, area: formData.area, nearby: formData.nearby,
        bio: formData.bio, profilePic: profilePicUrl,
        normalPics: formData.normalPics, exclusivePics: formData.exclusivePics,
        hidden: formData.activationPaid ? false : true,
      }, { merge: true });
      localStorage.setItem('profileSaved', 'true');
      if (!formData.activationPaid) { setShowActivationModal(true); }
      else { alert('Successful! Your profile is now live!'); router.push('/'); }
    } catch (err) { console.error('save profile failed', err); setError('Failed to save.'); }
    finally { setSaveLoading(false); }
  };

  // ─── Membership upgrade — FIXED with auth token + credit preview ──────────
  const handleUpgrade = (level) => {
    setSelectedLevel(level);
    setSelectedDuration('');
    setUpgradePreview(null);
    setShowModal(true);
  };

  const handleDurationSelect = async (d) => {
    setSelectedDuration(d);
    setUpgradePreview(null);
    setPreviewLoading(true);
    setShowModal(false);

    // Fetch credit preview from API
    try {
      const token = await getIdToken();
      const res = await fetch('/api/calculateUpgradePrice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ level: selectedLevel, duration: d }),
      });
      if (res.ok) {
        const preview = await res.json();
        setUpgradePreview(preview);
        // Auto-select payment method based on effective price
        setSelectedPaymentMethod(fundingBalance >= preview.effectivePrice ? 'wallet' : 'mpesa');
      } else {
        // Fallback to full price if preview API fails
        setSelectedPaymentMethod(fundingBalance >= plans[selectedLevel][d] ? 'wallet' : 'mpesa');
      }
    } catch {
      setSelectedPaymentMethod(fundingBalance >= plans[selectedLevel][d] ? 'wallet' : 'mpesa');
    } finally {
      setPreviewLoading(false);
    }

    setShowPaymentChoice(true);
  };

  const handlePaymentMethodChange = (m) => setSelectedPaymentMethod(m);

  // ─── Wallet upgrade — FIXED with auth token + isMpesa: false ─────────────
  const handleConfirmWalletUpgrade = async () => {
    setUpgradeLocked(true);
    const effectivePrice = upgradePreview?.effectivePrice ?? plans[selectedLevel][selectedDuration];
    const fullPrice = upgradePreview?.fullPrice ?? effectivePrice;
    const credit = upgradePreview?.credit ?? 0;

    const confirmMsg = credit > 0
      ? `Upgrade to ${selectedLevel} for ${selectedDuration}.\nFull price: KSh ${fullPrice}\nCredit for remaining days: KSh ${credit}\nYou pay: KSh ${effectivePrice}\n\nProceed?`
      : upgradePreview?.willExtend
      ? `Extend ${selectedLevel} by ${selectedDuration}. You pay: KSh ${effectivePrice}\n\nProceed?`
      : `Upgrade to ${selectedLevel} for ${selectedDuration}. You pay: KSh ${effectivePrice}\n\nProceed?`;

    if (!confirm(confirmMsg)) { setUpgradeLocked(false); return; }

    try {
      const token = await getIdToken();
      const res = await fetch('/api/upgradeMembership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,   // ← FIXED: auth token
        },
        body: JSON.stringify({
          level: selectedLevel,
          duration: selectedDuration,
          isMpesa: false,                        // ← wallet payment
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upgrade failed');

      showPaymentReceipt({
        type: 'upgrade', title: 'Membership Upgrade Receipt',
        membership: selectedLevel, duration: selectedDuration,
        amount: data.effectivePrice ?? effectivePrice,
        date: new Date().toLocaleString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        reference: `UPG-${shortenUserId(loggedInUser.id)}-${selectedLevel.slice(0, 3).toUpperCase()}`,
        phone: 'Funding Wallet', paymentMethod: 'Wallet', status: 'Payment Successful',
        message: data.willExtend
          ? `Your ${selectedLevel} membership has been extended by ${selectedDuration}.`
          : data.activatedNow
          ? `Congratulations! You are now a ${selectedLevel} member and your profile is now live!`
          : `Congratulations! You are now a ${selectedLevel} member for ${selectedDuration}.`,
      });
    } catch (err) {
      alert(err.message);
      setUpgradeLocked(false);
    } finally {
      setShowPaymentChoice(false);
      setSelectedDuration('');
      setUpgradePreview(null);
    }
  };

  // ─── Other handlers (unchanged) ───────────────────────────────────────────
  const handleRequestVerification = async () => {
    if (verificationRequested || formData.verified) { alert('Verification already requested or verified.'); return; }
    try {
      await setDoc(doc(db, 'profiles', loggedInUser.id), { verificationRequested: true }, { merge: true });
      setVerificationRequested(true);
      alert('Request sent. Admin will review.');
    } catch { setError('Failed to request verification.'); }
  };
  const handleAddFund = () => setShowAddFundModal(true);
  const handleWithdraw = async () => {
    try {
      if (!formData.phone) throw new Error('Add phone first.');
      const amount = parseInt(withdrawAmount, 10);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount.');
      const formattedPhone = formatPhoneForMpesa(formData.phone);
      if (!confirm(`Withdraw KSh ${amount} to ${formattedPhone}?`)) return;
      setWithdrawLoading(true);
      const res = await fetch('/api/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, phoneNumber: formattedPhone }) });
      const data = await res.json();
      if (data.success) { alert('Withdrawal initiated!'); setShowWithdrawModal(false); setWithdrawAmount(''); }
      else alert('Failed: ' + (data.message || 'Error'));
    } catch (err) { alert(err.message || 'Failed. Try again.'); }
    finally { setWithdrawLoading(false); }
  };
  const handleViewCreatorProfile = (creatorId) => router.push(`/profiles/${creatorId}`);
  const handleLogout = async () => { localStorage.removeItem('loggedInUser'); setLoggedInUser(null); await signOut(auth); router.push('/'); };
  const handleReasonChange = (e, reason) => { const checked = e.target.checked; setDeactivateReasons((prev) => (checked ? [...prev, reason] : prev.filter((r) => r !== reason))); };
  const handleDeactivateAccount = async () => {
    if (deactivateReasons.length === 0) { alert('Please select at least one reason.'); return; }
    if (!confirm('Deactivating your account will make your profile invisible. Reactivation will require the activation fee again.')) return;
    try {
      await updateDoc(doc(db, 'profiles', loggedInUser.id), { hidden: true, activationPaid: false, membership: 'Regular', membershipExpiresAt: null });
      handleLogout();
    } catch (err) { console.error('Deactivate account failed', err); alert('Failed to deactivate. Please try again.'); }
  };
  const handleActivate = () => { if (!formData.activationPaid) { setShowActivationModal(true); setPaymentStatus('idle'); setActivationLocked(false); } };
  const handlePaymentInitiated = (requestId) => { setCheckoutRequestID(requestId); setPaymentStatus('initiated'); setActivationLocked(true); };
  const handlePaymentFailure = () => { setPaymentStatus('failed'); setActivationLocked(false); };

  // ─── Derived values ───────────────────────────────────────────────────────
  const countyList = useMemo(() => Object.keys(locations).sort(), []);
  const wards = useMemo(() => (formData.county && locations[formData.county] ? Object.keys(locations[formData.county]) : []), [formData.county]);
  const areas = useMemo(() => (selectedWard && locations[formData.county] ? locations[formData.county][selectedWard] : []), [formData.county, selectedWard]);
  const inputStyle = { backgroundColor: '#ffffff', color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' };

  if (loading) return <div className={styles.container}>Loading...</div>;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`${styles.container} ${styles.premiumTheme}`} style={{ backgroundColor: '#FFC0CB' }}>
      <Head>
        <title>Meet Connect Ladies - Profile Setup</title>
        <meta name="description" content="Set up your profile" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className={`${styles.header} ${styles.premiumHeader}`}>
        <button onClick={() => router.push('/')} className={styles.modalBack}>←</button>
        <div className={styles.logoContainer}>
          <h1 onClick={() => router.push('/')} className={styles.title}>Meet Connect</h1>
        </div>
        <div className={styles.authButtons}>
          <button onClick={handleLogout} className={`${styles.button} ${styles.logout}`}>Logout</button>
          <button onClick={() => setShowMenu(!showMenu)} className={styles.menuButton}>⋯</button>
          {showMenu && (
            <div className={styles.dropdown}>
              <ul>
                <li onClick={() => { setShowMenu(false); formData.activationPaid ? setShowDeactivationModal(true) : setShowActivationModal(true); }}>
                  {formData.activationPaid ? 'Deactivate Account' : 'Activate Account'}
                </li>
              </ul>
            </div>
          )}
        </div>
      </header>

      <main className={`${styles.main} ${styles.premiumMain}`}>
        <div className={styles.profileSetupContainer}>

          {/* Sidebar */}
          <aside className={`${styles.membershipSection} ${styles.premiumSidebar}`}>
            <button onClick={() => router.push(`/view-profile/${loggedInUser?.id}`)} className={styles.upgradeButton}
              style={{ marginBottom: '20px', background: 'linear-gradient(135deg, #ff69b4, #ff1493)', color: 'white', fontWeight: 'bold' }}>
              👤 My Profile
            </button>
            <h2 className={styles.sectionTitle}>My Membership</h2>
            <p className={styles.tip}>Upgrade boosts visibility</p>
            <p>Current: {membership}{!formData.activationPaid && ' (Hidden until activation)'}</p>
            <p>Regular: Free</p>
            <button onClick={() => handleUpgrade('Prime')} className={styles.upgradeButton}>Upgrade to Prime</button>
            <button onClick={() => handleUpgrade('VIP')} className={styles.upgradeButton}>Upgrade to VIP</button>
            <button onClick={() => handleUpgrade('VVIP')} className={styles.upgradeButton}>Upgrade to VVIP</button>
          </aside>

          {/* Main form */}
          <div className={`${styles.profileFormContainer} ${styles.premiumForm}`}>
            <h1 className={styles.setupTitle}>My Profile Setup</h1>
            <p className={styles.tip}>Complete one step at a time. We&apos;ll guide you!</p>

            <div className={styles.stepper}>
              {steps.map((s, idx) => (
                <button key={s} onClick={() => { if (idx < activeStep || isStepValid(activeStep - 1)) setActiveStep(idx); }}
                  className={idx === activeStep ? styles.activeStep : idx < activeStep ? styles.completedStep : ''}>
                  {s}
                </button>
              ))}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} className={styles.profileForm}>
              {/* Step 0: Basics */}
              {activeStep === 0 && (
                <div className={styles.stepContent}>
                  <h2>Basics</h2>
                  <label className={styles.label}>
                    Profile Picture (Required)
                    <button type="button" onClick={() => profilePicInputRef.current.click()} className={styles.button}>Upload Profile Picture</button>
                    <input type="file" accept="image/*" onChange={handleImageUpload} ref={profilePicInputRef} style={{ display: 'none' }} />
                    {(profilePicPreview || formData.profilePic) && (
                      <Image src={profilePicPreview || formData.profilePic} alt="Profile preview" width={150} height={150} className={styles.profilePic} />
                    )}
                  </label>
                  <label className={styles.label}>Name<input type="text" name="name" value={formData.name} onChange={handleChange} className={styles.input} required style={inputStyle} /></label>
                  <label className={styles.label}>Phone (e.g., 0712345678)<input type="text" name="phone" value={formData.phone} onChange={handleChange} className={styles.input} required style={inputStyle} /></label>
                  <label className={styles.label}>Gender
                    <select name="gender" value={formData.gender} onChange={handleChange} className={styles.select} style={inputStyle}>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </label>
                  <label className={styles.label}>Sexual Orientation
                    <select name="sexualOrientation" value={formData.sexualOrientation} onChange={handleChange} className={styles.select} style={inputStyle}>
                      <option value="Straight">Straight</option>
                      <option value="Gay">Gay</option>
                      <option value="Bisexual">Bisexual</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className={styles.label}>Age (18+)<input type="number" name="age" min="18" max="90" value={formData.age} onChange={handleChange} className={styles.input} required style={inputStyle} /></label>
                  <label className={styles.label}>Nationality<input type="text" name="nationality" value={formData.nationality} onChange={handleChange} className={styles.input} style={inputStyle} /></label>
                </div>
              )}

              {/* Step 1: Location */}
              {activeStep === 1 && (
                <div className={styles.stepContent}>
                  <h2>Location</h2>
                  <label className={styles.label}>County
                    <select name="county" value={formData.county} onChange={handleChange} className={styles.select} style={inputStyle}>
                      <option value="">Select County</option>
                      {countyList.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className={styles.label}>City/Town
                    <select name="ward" value={selectedWard} onChange={handleWardChange} className={styles.select} disabled={!formData.county} style={inputStyle}>
                      <option value="">Select City/Town</option>
                      {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </label>
                  <label className={styles.label}>Area
                    <select name="area" value={formData.area} onChange={handleAreaChange} className={styles.select} disabled={!selectedWard} style={inputStyle}>
                      <option value="">Select Area</option>
                      {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </label>
                  {formData.area && (
                    <label className={styles.label}>Nearby Places (up to 4)
                      <div className={styles.checkboxGroup}>
                        {areas.map((place) => (
                          <div key={place}>
                            <input type="checkbox" value={place} checked={(formData.nearby || []).includes(place)} onChange={handleChange} name="nearby" />
                            <span>{place}</span>
                          </div>
                        ))}
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* Step 2: Bio */}
              {activeStep === 2 && (
                <div className={styles.stepContent}>
                  <h2>Bio</h2>
                  <label className={styles.label}>
                    Write a short bio about yourself (optional, max 100 words)
                    <textarea name="bio" value={formData.bio} onChange={handleChange} rows={6} className={styles.input} style={inputStyle} />
                  </label>
                  <div>{formData.bio.trim().split(/\s+/).length} / 100 words</div>
                </div>
              )}

              {/* Step 3: Media */}
              {activeStep === 3 && (
                <div className={styles.stepContent}>
                  <h2>Media</h2>
                  <button type="button" onClick={() => setShowCreatePostModal(true)} className={styles.createPostButton}>+ Create Post</button>
                  <div className={styles.viewButtonsContainer}>
                    <button type="button" onClick={() => setShowPostsModal(true)} className={styles.viewPostsButton}>View Posts</button>
                    <button type="button" onClick={() => setShowExclusiveModal(true)} className={styles.viewExclusiveButton}>View Exclusive</button>
                  </div>
                  <p className={styles.tip}>Tip: Public posts visible to all; exclusive for subscribers. Avoid inappropriate content in public.</p>
                </div>
              )}

              {/* Step 4: Membership & Wallets */}
              {activeStep === 4 && (
                <div className={styles.stepContent}>
                  <h2>Membership & Wallets</h2>
                  <p>Manage your membership and wallets here. Upgrades boost visibility!</p>
                  <div className={`${styles.walletSection} ${styles.fundingWallet}`}>
                    <div className={styles.walletStripe} />
                    <p className={styles.walletLabel}>Funding Wallet (Non-Withdrawable)</p>
                    <p className={styles.walletBalance}>KSh {fundingBalance}</p>
                    <button onClick={handleAddFund} className={styles.addFundButton}>Add Fund</button>
                  </div>
                  <div className={`${styles.walletSection} ${styles.earningsWallet}`}>
                    <div className={styles.walletStripe} />
                    <p className={styles.walletLabel}>Earnings Wallet</p>
                    <p className={styles.walletBalance}>KSh {earningsBalance}</p>
                    <button onClick={() => setShowWithdrawModal(true)} className={styles.withdrawButton} disabled={earningsBalance <= 0}>Withdraw</button>
                    <button onClick={() => setShowEarningsHistory(true)} className={styles.historyButton}>View Purchases</button>
                  </div>
                  <button onClick={() => setShowReceiptsHistory(true)} className={styles.historyButton}>View Receipts</button>
                  <button type="button" onClick={handleRequestVerification} className={styles.button} disabled={verificationRequested || formData.verified}>
                    {formData.verified ? 'Verified' : verificationRequested ? 'Pending' : 'Request Verification'}
                  </button>
                </div>
              )}

              <div className={styles.stepButtons}>
                {activeStep > 0 && formData.activationPaid && (
                  <button type="button" onClick={handlePrevStep} className={styles.button}>Previous</button>
                )}
                {activeStep < steps.length - 1 && (
                  <button type="button" onClick={handleNextStep} className={styles.button}>Next</button>
                )}
                <button type="submit" className={styles.button} disabled={saveLoading}>
                  {saveLoading ? 'Saving...' : 'Save Profile'}
                </button>
                {!formData.activationPaid && (
                  <button type="button" onClick={handleActivate} className={styles.button}>Activate</button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ── Media Viewer ── */}
        {showMediaViewer && (
          <div className={styles.mediaViewerOverlay}>
            <div className={styles.viewerContainer} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              <button className={styles.viewerClose} onClick={() => setShowMediaViewer(false)}>×</button>
              <button className={styles.viewerLeft} onClick={() => setSelectedIndex(prev => prev > 0 ? prev - 1 : selectedGallery.length - 1)}>‹</button>
              <button className={styles.viewerRight} onClick={() => setSelectedIndex(prev => prev < selectedGallery.length - 1 ? prev + 1 : 0)}>›</button>
              <div className={styles.viewerContent}>
                {isVideo(selectedGallery[selectedIndex]) ? (
                  <video src={selectedGallery[selectedIndex]} controls autoPlay playsInline className={styles.viewerMedia} />
                ) : (
                  <div className={styles.imageWrapper}>
                    <Image src={selectedGallery[selectedIndex]} alt="Full view" fill sizes="95vw" style={{ objectFit: 'contain' }} priority />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CLEAN ACTIVATION MODAL ── */}
        {showActivationModal && (
          <div className={styles.modal}>
            <div className={styles.modalContent} style={{ maxWidth: '460px' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ fontSize: '52px', lineHeight: 1 }}>🎉</div>
                <h3 style={{ color: '#ff1493', margin: '12px 0 6px', fontSize: '1.65rem' }}>
                  Activate Your Profile!
                </h3>
                <p style={{ fontSize: '1.25rem', fontWeight: '700', color: '#333' }}>
                  KSh 300 <span style={{ fontSize: '1rem', fontWeight: '400' }}>one-time only</span>
                </p>
              </div>

              {/* Benefits */}
              <div style={{
                background: '#ffffff',
                padding: '20px',
                borderRadius: '16px',
                marginBottom: '24px',
                boxShadow: '0 4px 15px rgba(255, 20, 147, 0.08)'
              }}>
                <p style={{ margin: '0 0 14px', fontWeight: '600', color: '#222' }}>This will instantly:</p>
                <ul style={{ paddingLeft: '22px', margin: 0, lineHeight: '1.65' }}>
                  <li>✅ Make your profile visible to <strong>ALL gentlemen</strong> in Kenya</li>
                  <li>✅ Give you <strong>lifetime visibility</strong> (no monthly fees)</li>
                  <li>✅ Unlock <strong>7 Days Prime membership </strong></li>
                  <li>✅ Let you start receiving messages & calls today</li>
                </ul>
              </div>

              {/* Payment */}
              {paymentStatus === 'initiated' ? (
                <p style={{ textAlign: 'center', color: '#ff1493', fontWeight: 'bold', padding: '20px 0' }}>
                  ⏳ Waiting for M-Pesa confirmation...<br />
                  <small>Check your phone now</small>
                </p>
              ) : (
                <StkPushForm
                  initialPhone={mpesaPhone}
                  initialAmount={ACTIVATION_FEE}
                  readOnlyAmount={true}
                  apiEndpoint="/api/stkpush"
                  onInitiated={handlePaymentInitiated}
                  onFailure={handlePaymentFailure}
                  additionalBody={{
                    userId: loggedInUser.id,
                    type: 'activation',
                    accountReference: `act_${loggedInUser.id.slice(0, 8)}`,
                    transactionDesc: 'Profile Activation + 7 Days Prime Welcome'
                  }}
                />
              )}

              {paymentStatus === 'failed' && (
                <p style={{ color: 'red', textAlign: 'center', margin: '12px 0' }}>
                  Payment failed. Please try again.
                </p>
              )}

              {/* Subtle higher plan upsell */}
              <div style={{ marginTop: '32px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <p style={{ fontSize: '0.92rem', color: '#555', marginBottom: '12px' }}>
                  Want faster earnings & more visibility?
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={() => { setShowActivationModal(false); setPaymentStatus('idle'); handleUpgrade('Prime'); }}
                    className={styles.upgradeButton}
                    disabled={activationLocked || paymentStatus === 'initiated'}
                    style={{ fontSize: '0.92rem', padding: '10px 18px' }}
                  >
                    Activate with Prime
                  </button>
                  <button
                    onClick={() => { setShowActivationModal(false); setPaymentStatus('idle'); handleUpgrade('VIP'); }}
                    className={styles.upgradeButton}
                    disabled={activationLocked || paymentStatus === 'initiated'}
                    style={{ fontSize: '0.92rem', padding: '10px 18px' }}
                  >
                    Activate with VIP
                  </button>
                  <button
                    onClick={() => { setShowActivationModal(false); setPaymentStatus('idle'); handleUpgrade('VVIP'); }}
                    className={styles.upgradeButton}
                    disabled={activationLocked || paymentStatus === 'initiated'}
                    style={{ fontSize: '0.92rem', padding: '10px 18px' }}
                  >
                    Activate with VVIP
                  </button>
                </div>
              </div>

              {/* Later */}
              <button
                onClick={() => setShowActivationModal(false)}
                className={styles.closeButton}
                disabled={activationLocked || paymentStatus === 'initiated'}
                style={{ marginTop: '20px' }}
              >
                Maybe later (profile stays hidden)
              </button>
            </div>
          </div>
        )}

        {/* ── Membership Duration Modal ── */}
        {showModal && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>Upgrade to {selectedLevel}</h3>
              <div className={styles.durationOptions}>
                {Object.keys(plans[selectedLevel] || {}).map((d) => (
                  <button key={d} onClick={() => handleDurationSelect(d)} className={selectedDuration === d ? styles.selectedDuration : ''}>
                    {d} — KSh {plans[selectedLevel][d]}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowModal(false)} className={styles.closeButton}>Close</button>
            </div>
          </div>
        )}

        {/* ── Payment Choice Modal ── */}
        {showPaymentChoice && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>Payment for {selectedLevel} — {selectedDuration}</h3>

              {/* ── Credit / price preview ── */}
              {previewLoading ? (
                <p style={{ color: '#888', fontSize: '0.9rem' }}>Calculating price...</p>
              ) : upgradePreview ? (
                <div style={{ background: '#fff8f0', border: '1px solid #ffcc88', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: '0.9rem' }}>
                  {upgradePreview.willExtend ? (
                    <p style={{ margin: 0, color: '#555' }}>
                      ✅ You already have <strong>{upgradePreview.remainingDays} days</strong> of {upgradePreview.currentTier} remaining — this will <strong>extend</strong> your membership.
                    </p>
                  ) : upgradePreview.credit > 0 ? (
                    <>
                      <p style={{ margin: '0 0 4px' }}>Full price: <strong>KSh {upgradePreview.fullPrice}</strong></p>
                      <p style={{ margin: '0 0 4px', color: '#27ae60' }}>Credit ({upgradePreview.remainingDays} days {upgradePreview.currentTier}): <strong>− KSh {upgradePreview.credit}</strong></p>
                      <p style={{ margin: 0, fontWeight: 700, color: '#e74c3c', fontSize: '1rem' }}>You pay: KSh {upgradePreview.effectivePrice}</p>
                    </>
                  ) : (
                    <p style={{ margin: 0 }}>You pay: <strong>KSh {upgradePreview.effectivePrice}</strong></p>
                  )}
                </div>
              ) : (
                <p>Total: KSh {plans[selectedLevel]?.[selectedDuration]}</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" name="paymentMethod" value="wallet" checked={selectedPaymentMethod === 'wallet'} onChange={() => handlePaymentMethodChange('wallet')} />
                  Wallet (KSh {fundingBalance})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" name="paymentMethod" value="mpesa" checked={selectedPaymentMethod === 'mpesa'} onChange={() => handlePaymentMethodChange('mpesa')} />
                  M-Pesa
                </label>
              </div>

              {selectedPaymentMethod === 'mpesa' && (
                <StkPushForm
                  initialPhone={mpesaPhone}
                  initialAmount={upgradePreview?.effectivePrice ?? plans[selectedLevel]?.[selectedDuration]}
                  readOnlyAmount={true}
                  apiEndpoint="/api/stkpush"
                  onInitiated={() => setUpgradeLocked(true)}
                  onFailure={() => setUpgradeLocked(false)}
                  onSuccess={() => {
                    const price = upgradePreview?.effectivePrice ?? plans[selectedLevel][selectedDuration];
                    showPaymentReceipt({
                      type: 'upgrade', title: 'Membership Upgrade Receipt',
                      membership: selectedLevel, duration: selectedDuration, amount: price,
                      date: new Date().toLocaleString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                      reference: `UPG-${shortenUserId(loggedInUser.id)}-${selectedLevel.slice(0, 3).toUpperCase()}`,
                      phone: mpesaPhone, paymentMethod: 'M-Pesa', status: 'Payment Successful',
                      message: `Congratulations! You are now a ${selectedLevel} member for ${selectedDuration}.`,
                    });
                    setShowPaymentChoice(false);
                  }}
                  additionalBody={{ userId: loggedInUser.id, type: 'upgrade', level: selectedLevel, duration: selectedDuration, isMpesa: true, accountReference: `upg_${shortenUserId(loggedInUser.id)}_${selectedLevel.slice(0, 3)}`, transactionDesc: `Upgrade to ${selectedLevel} for ${selectedDuration}` }}
                />
              )}

              {selectedPaymentMethod === 'wallet' && (
                <button onClick={handleConfirmWalletUpgrade} className={styles.upgradeButton} disabled={upgradeLocked}>
                  {upgradeLocked ? 'Processing...' : 'Confirm'}
                </button>
              )}
              <button onClick={() => { setShowPaymentChoice(false); setUpgradePreview(null); }} className={styles.closeButton} disabled={upgradeLocked}>Close</button>
            </div>
          </div>
        )}

        {/* ── Add Funds Modal ── */}
        {showAddFundModal && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>Add Funds</h3>
              <p>Phone: {formData.phone}</p>
              <StkPushForm
                initialPhone={mpesaPhone}
                apiEndpoint="/api/stkpush"
                onInitiated={() => setAddFundLocked(true)}
                onFailure={() => setAddFundLocked(false)}
                additionalBody={{ userId: loggedInUser.id, type: 'addfund', accountReference: `wal_${shortenUserId(loggedInUser.id)}`, transactionDesc: 'Add funds' }}
              />
              <button onClick={() => setShowAddFundModal(false)} className={styles.closeButton} disabled={addFundLocked}>Close</button>
            </div>
          </div>
        )}

        {/* ── Withdraw Modal ── */}
        {showWithdrawModal && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>Withdraw</h3>
              <p>Available: KSh {earningsBalance}</p>
              <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} min="1" max={earningsBalance} className={styles.input} style={inputStyle} />
              <button onClick={handleWithdraw} className={styles.withdrawButton} disabled={withdrawLoading}>{withdrawLoading ? 'Processing...' : 'Withdraw'}</button>
              <button onClick={() => setShowWithdrawModal(false)} className={styles.closeButton} disabled={withdrawLoading}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Earnings History Modal ── */}
        {showEarningsHistory && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>Purchase History</h3>
              {transactions.length === 0 ? <p>No subscriptions.</p> : (
                <table className={styles.historyTable}>
                  <thead><tr><th>User</th><th>Amount</th><th>Duration</th><th>Date</th><th>Expires</th></tr></thead>
                  <tbody>{transactions.map((tx) => (<tr key={tx.id}><td>{tx.userName}</td><td>{tx.amount}</td><td>{tx.duration}</td><td>{tx.date}</td><td>{tx.expiresAt}</td></tr>))}</tbody>
                </table>
              )}
              <button onClick={() => setShowMySubscriptions(true)} className={styles.historyButton}>My Exclusive Subscriptions</button>
              <button onClick={() => setShowEarningsHistory(false)} className={styles.closeButton}>Close</button>
            </div>
          </div>
        )}

        {/* ── My Subscriptions Modal ── */}
        {showMySubscriptions && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>My Exclusive Subscriptions</h3>
              {mySubscriptions.length === 0 ? <p>No active subscriptions.</p> : (
                <div className={styles.subscriptionList}>
                  {mySubscriptions.map((sub) => (
                    <div key={sub.id} className={styles.subscriptionItem} onClick={() => handleViewCreatorProfile(sub.creatorId)}>
                      {sub.creatorPic ? (<Image src={sub.creatorPic} alt={sub.creatorName} width={50} height={50} className={styles.subProfilePic} />) : (<div className={styles.subPlaceholderPic}>No Pic</div>)}
                      <div className={styles.subDetails}>
                        <h4>{sub.creatorName}</h4>
                        <p>Amount: KSh {sub.amount}</p>
                        <p>Duration: {sub.duration} days</p>
                        <p>Subscribed on: {sub.date}</p>
                        <p>Expires: {sub.expiresAt}</p>
                        <p>Status: {sub.isActive ? 'Active' : 'Expired'}</p>
                      </div>
                      <button className={styles.viewButton}>View Profile & Exclusive Content</button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setShowMySubscriptions(false)} className={styles.closeButton}>Close</button>
            </div>
          </div>
        )}

        {/* ── Receipts History Modal ── */}
        {showReceiptsHistory && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>Receipt History</h3>
              {receipts.length === 0 ? <p>No receipts.</p> : (
                <table className={styles.historyTable}>
                  <thead><tr><th>Type</th><th>Membership</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>{receipts.map((rec) => (<tr key={rec.id}><td>{rec.type}</td><td>{rec.membership || 'N/A'}</td><td>KSh {rec.amount}</td><td>{rec.date}</td><td>{rec.status}</td></tr>))}</tbody>
                </table>
              )}
              <button onClick={() => setShowReceiptsHistory(false)} className={styles.closeButton}>Close</button>
            </div>
          </div>
        )}

        {/* ── Deactivation Modal ── */}
        {showDeactivationModal && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>Deactivate Account?</h3>
              <p>Please select the reason(s) for deactivating. Your profile will become invisible and reactivation will require the activation fee.</p>
              <div className={styles.checkboxGroup}>
                {reasons.map((reason) => (
                  <div key={reason}>
                    <input type="checkbox" id={reason} checked={deactivateReasons.includes(reason)} onChange={(e) => handleReasonChange(e, reason)} />
                    <label htmlFor={reason}>{reason}</label>
                    {reason === 'Other' && deactivateReasons.includes('Other') && (
                      <textarea value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Please specify" className={styles.input} style={inputStyle} />
                    )}
                  </div>
                ))}
              </div>
              <button onClick={handleDeactivateAccount} className={styles.button}>Confirm Deactivation</button>
              <button onClick={() => setShowDeactivationModal(false)} className={styles.closeButton}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Create Post Modal ── */}
        {showCreatePostModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreatePostModal(false)}>
            <div className={styles.createPostModal} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowCreatePostModal(false)} className={styles.modalBack}>←</button>
              <h2>Create Post</h2>
              <p className={styles.tip}>Add photos/videos. Exclusive for subscribers only.</p>
              <button onClick={() => fileInputRef.current.click()} className={styles.button}>Select Photos/Videos</button>
              <input type="file" accept="image/*,video/*" multiple onChange={handlePostFileSelect} ref={fileInputRef} style={{ display: 'none' }} />
              <div className={styles.postPreviewGrid}>
                {postPreviews.length === 0 && <p>No files selected</p>}
                {postPreviews.map((preview, i) => (
                  <div key={i} className={styles.postPreviewItem}>
                    {postFiles[i] && isVideo(postFiles[i]) ? (
                      <video src={preview} className={styles.postPreviewImg} controls muted />
                    ) : (
                      <Image src={preview} alt={`preview-${i}`} width={100} height={100} className={styles.postPreviewImg} />
                    )}
                    <button onClick={() => handleRemovePostPreview(i)} className={styles.removePreview}>×</button>
                  </div>
                ))}
              </div>
              <textarea
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value.slice(0, 500))}
                placeholder="Caption (optional)..."
                rows={4}
                style={inputStyle}
              />
              <div>{postCaption.length}/500</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input type="checkbox" checked={postIsExclusive} onChange={(e) => setPostIsExclusive(e.target.checked)} />
                Exclusive (subscribers only)
              </label>
              <div style={{ marginTop: 12 }}>
                <button onClick={handleCreatePost} disabled={postFiles.length === 0 || postUploading} className={styles.button}>
                  {postUploading ? 'Posting...' : 'Post'}
                </button>
                <button onClick={() => { postPreviews.forEach((u) => URL.revokeObjectURL(u)); setPostPreviews([]); setPostFiles([]); setPostCaption(''); setShowCreatePostModal(false); }} className={styles.closeButton}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Posts Gallery Modal ── */}
        {showPostsModal && (
          <div className={styles.modalOverlay} onClick={() => setShowPostsModal(false)}>
            <div className={styles.galleryModal} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowPostsModal(false)} className={styles.modalBack}>←</button>
              <h2>Posts</h2>
              <div className={styles.gallery}>
                {(formData.normalPics || []).map((url, index) => (
                  <div key={index} className={styles.galleryItem} onClick={() => handleMediaClick(formData.normalPics, index)}>
                    <Image src={getThumbnail(url)} alt="" fill sizes="140px" style={{ objectFit: 'cover' }} loading="lazy" />
                    {isVideo(url) && <div className={styles.playIcon} />}
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveNormalPic(index); }} className={styles.removeButton}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Exclusive Gallery Modal ── */}
        {showExclusiveModal && (
          <div className={styles.modalOverlay} onClick={() => setShowExclusiveModal(false)}>
            <div className={styles.galleryModal} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowExclusiveModal(false)} className={styles.modalBack}>←</button>
              <h2>Exclusive Content</h2>
              <div className={styles.gallery}>
                {(formData.exclusivePics || []).map((url, index) => (
                  <div key={index} className={styles.galleryItem} onClick={() => handleMediaClick(formData.exclusivePics, index)}>
                    <Image src={getThumbnail(url)} alt="" fill sizes="140px" style={{ objectFit: 'cover' }} loading="lazy" />
                    {isVideo(url) && <div className={styles.playIcon} />}
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveExclusivePic(index); }} className={styles.removeButton}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Inappropriate Content Banner ── */}
        {showInappropriateBanner && (
          <div className={styles.inappropriateBanner}>
            <p>Inappropriate content detected. Use exclusive or change image.</p>
            <button onClick={() => setShowInappropriateBanner(false)}>Dismiss</button>
          </div>
        )}

        {/* ── Receipt Modal ── */}
        {showReceiptModal && receipt && (
          <div className={styles.modal}>
            <div className={styles.receiptModalContent}>
              <div className={styles.receiptHeader}>
                <h2>✅ Payment Receipt</h2>
                <p className={styles.receiptCompany}>Meet Connect</p>
                <p className={styles.receiptTagline}>Official Transaction Receipt</p>
              </div>
              <div className={styles.receiptBody}>
                <div className={styles.receiptRow}><span>Transaction ID</span><span className={styles.mono}>{receipt.reference}</span></div>
                <div className={styles.receiptRow}><span>Date & Time</span><span>{receipt.date}</span></div>
                <div className={styles.receiptRow}><span>Payment Method</span><span>{receipt.paymentMethod}</span></div>
                <div className={styles.receiptRow}><span>Phone / Wallet</span><span>{receipt.phone}</span></div>
                <div className={styles.receiptDivider} />
                <div className={styles.receiptItem}>
                  <div>
                    <strong>{receipt.title}</strong><br />
                    <span className={styles.membershipInfo}>{receipt.membership} • {receipt.duration}</span>
                  </div>
                  <div className={styles.amount}>KSh {receipt.amount.toLocaleString()}</div>
                </div>
                <div className={styles.receiptTotal}>
                  <span>Total Paid</span>
                  <span className={styles.totalAmount}>KSh {receipt.amount.toLocaleString()}</span>
                </div>
              </div>
              <p className={styles.receiptMessage}>{receipt.message}</p>
              <div className={styles.receiptFooter}>
                <p>Thank you for choosing <strong>Meet Connect</strong></p>
                <p className={styles.small}>This is a computer-generated receipt. No signature required.</p>
              </div>
              <div className={styles.receiptActions}>
                <button onClick={() => { setShowReceiptModal(false); router.push('/'); }} className={styles.button}>
                  Continue to Homepage
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}