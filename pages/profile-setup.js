import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import * as locations from '../data/locations';
import styles from '../styles/ProfileSetup.module.css';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import StkPushForm from '../components/StkPushForm';

const servicesList = [
  'Dinner Date',
  'Just Vibes',
  'Relationship',
  'Night Out',
  'Friendship',
  'Companionship / Meetup'
];

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
    services: [],
    otherServices: '',
    profilePic: '',
    normalPics: [],        // Public posts (images/videos)
    exclusivePics: [],     // Exclusive content (images/videos)
    verified: false,
  });
  const [selectedWard, setSelectedWard] = useState('');
  const [membership, setMembership] = useState('Regular');
  const [fundingBalance, setFundingBalance] = useState(0); // Renamed: Non-withdrawable funding wallet
  const [earningsBalance, setEarningsBalance] = useState(0); // New: Withdrawable earnings wallet
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [showInappropriateBanner, setShowInappropriateBanner] = useState(false);
  const [showEarningsHistory, setShowEarningsHistory] = useState(false); // New: Modal for purchase history
  const [transactions, setTransactions] = useState([]); // New: Subscription transactions

  // Create Post states
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [postFiles, setPostFiles] = useState([]); // Array of File objects
  const [postPreviews, setPostPreviews] = useState([]); // Array of preview URLs (object URLs)
  const [postCaption, setPostCaption] = useState('');
  const [postIsExclusive, setPostIsExclusive] = useState(false);
  const [postUploading, setPostUploading] = useState(false);

  // Gallery modals
  const [showPostsModal, setShowPostsModal] = useState(false);
  const [showExclusiveModal, setShowExclusiveModal] = useState(false);

  // Image/Video viewer states
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Ref for touch swipe
  const touchStartX = useRef(0);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!user) {
      router.push('/');
      return;
    }
    setLoggedInUser(user);

    const unsubscribe = onSnapshot(doc(db, 'profiles', user.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Snapshot triggered with data:', data);  // Debug log
        let loadedPhone = (data.phone || '').replace(/[^\d]/g, '');

        let effectiveMembership = data.membership || 'Regular';
        if (data.membershipExpiresAt) {
          const expiresAt = new Date(data.membershipExpiresAt.seconds * 1000);
          if (expiresAt < new Date()) {
            effectiveMembership = 'Regular';
            setDoc(doc(db, 'profiles', user.id), {
              membership: 'Regular',
              membershipExpiresAt: null
            }, { merge: true });
          }
        }

        setFormData((prev) => ({
          ...prev,
          ...data,
          username: user.username,
          phone: loadedPhone,
          services: data.services || [],
          nearby: data.nearby || [],
          normalPics: data.normalPics || [],
          exclusivePics: data.exclusivePics || [],
          age: data.age || prev.age,
          verified: data.verified || false,
        }));
        setSelectedWard(data.ward || '');
        setFundingBalance(data.fundingBalance || 0); // Updated
        setEarningsBalance(data.earningsBalance || 0); // New
        setMembership(effectiveMembership);
        setMpesaPhone(loadedPhone);
        setVerificationRequested(!!data.verificationRequested);
      } else {
        setFormData((prev) => ({ ...prev, username: user.username }));
        setFundingBalance(0);
        setEarningsBalance(0);
        setMembership('Regular');
      }
      setLoading(false);
    }, (err) => {
      setError('Failed to load profile. Please refresh.');
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Cleanup preview URLs on unmount
      postPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [router, postPreviews]);

  // New: Fetch subscription history for the model
  useEffect(() => {
    if (!loggedInUser) return;

    const fetchTransactions = async () => {
      try {
        const q = query(collection(db, 'subscriptions'), where('creatorId', '==', loggedInUser.id));
        const snapshot = await getDocs(q);
        const txs = await Promise.all(snapshot.docs.map(async (subDoc) => {
          const data = subDoc.data();
          const userRef = doc(db, 'profiles', data.userId);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : { name: 'Unknown User' };
          return {
            id: subDoc.id,
            userName: userData.name,
            amount: data.amount, // Assume added in backend
            duration: data.durationDays,
            date: data.updatedAt.toDate().toLocaleString(),
            expiresAt: data.expiresAt.toDate().toLocaleString(),
          };
        }));
        setTransactions(txs.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      }
    };

    fetchTransactions();
  }, [loggedInUser]);

  // Helper to format phone for M-Pesa
  const formatPhoneForMpesa = (phone) => {
    if (!phone) throw new Error('Phone number is required');
    let formatted = phone.replace(/[^\d]/g, '');
    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.slice(1);
    } else if (formatted.startsWith('254')) {
      // good
    } else if (formatted.length === 9 && formatted.startsWith('7')) {
      formatted = '254' + formatted;
    } else {
      throw new Error('Invalid phone number format. Use 07XXXXXXXX');
    }
    if (formatted.length !== 12 || !formatted.startsWith('2547')) {
      throw new Error('Invalid M-Pesa phone number. Must be a valid Kenyan mobile number starting with 07.');
    }
    return formatted;
  };

  const shortenUserId = (userId) => userId ? userId.slice(-10) : '';

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'nearby') {
        setFormData((prev) => {
          const current = prev.nearby || [];
          if (checked) {
            if (current.includes(value)) return prev;
            if (current.length >= 4) {
              setError('You can select up to 4 nearby locations only.');
              return prev;
            }
            setError('');
            return { ...prev, nearby: [...current, value] };
          } else {
            setError('');
            return { ...prev, nearby: current.filter((v) => v !== value) };
          }
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: checked
            ? [...(prev[name] || []), value]
            : (prev[name] || []).filter((v) => v !== value),
        }));
      }
    } else {
      let inputValue = value;
      if (name === 'phone') {
        inputValue = value.replace(/[^\d]/g, '');
        setMpesaPhone(inputValue);
        if (error && inputValue.length > 6) setError('');
      }
      if (name === 'county') {
        setFormData((prev) => ({
          ...prev,
          county: inputValue,
          ward: '',
          area: '',
          nearby: [],
        }));
        setSelectedWard('');
      } else {
        setFormData((prev) => ({ ...prev, [name]: inputValue }));
      }
      if (error) setError('');
    }
  };

  const handleWardChange = (e) => {
    const ward = e.target.value;
    setSelectedWard(ward);
    setFormData((prev) => ({ ...prev, ward, area: '', nearby: [] }));
    if (error) setError('');
  };

  const handleAreaChange = (e) => {
    setFormData((prev) => ({ ...prev, area: e.target.value }));
    if (error) setError('');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, profilePic: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // === CREATE POST HANDLERS ===
  const handlePostFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPostFiles(prev => [...prev, ...files]);
    setPostPreviews(prev => [...prev, ...newPreviews]);
  };

  const handleRemovePostPreview = (index) => {
    URL.revokeObjectURL(postPreviews[index]);
    setPostFiles(prev => prev.filter((_, i) => i !== index));
    setPostPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    if (postFiles.length === 0) return;
    setPostUploading(true);
    setError('');
    setShowInappropriateBanner(false);

    try {
      for (let i = 0; i < postFiles.length; i++) {
        const formDataUpload = new FormData();  // Renamed to avoid conflict
        formDataUpload.append('media', postFiles[i]);
        formDataUpload.append('userId', loggedInUser.id);
        formDataUpload.append('isExclusive', postIsExclusive ? 'true' : 'false');

        const res = await fetch('/api/uploadPost', {
          method: 'POST',
          body: formDataUpload,
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          if (data.error === 'Inappropriate content detected') {
            setShowInappropriateBanner(true);
          } else {
            throw new Error(data.error || 'Upload failed');
          }
          // Continue with next files or break based on needs; here, we stop on error
          return;
        }
      }

      // Manual refetch to ensure state updates immediately
      const profileDoc = await getDoc(doc(db, 'profiles', loggedInUser.id));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        console.log('Manual refetch data:', data);  // Debug log
        setFormData(prev => ({
          ...prev,
          normalPics: data.normalPics || [],
          exclusivePics: data.exclusivePics || [],
        }));
      }

      setShowCreatePostModal(false);
      setPostFiles([]);
      setPostPreviews([]);
      setPostCaption('');
      setPostIsExclusive(false);
      alert('Post created successfully!');
    } catch (err) {
      setError(`Failed to create post: ${err.message}`);
    } finally {
      setPostUploading(false);
    }
  };

  const handleRemoveNormalPic = async (index) => {
    const newNormalPics = formData.normalPics.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, normalPics: newNormalPics }));
    await setDoc(doc(db, 'profiles', loggedInUser.id), { normalPics: newNormalPics }, { merge: true });
  };

  const handleRemoveExclusivePic = async (index) => {
    const newExclusivePics = formData.exclusivePics.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, exclusivePics: newExclusivePics }));
    await setDoc(doc(db, 'profiles', loggedInUser.id), { exclusivePics: newExclusivePics }, { merge: true });
  };

  const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url); // Simple check; adjust if needed

  const getThumbnail = (url) => {
    if (!isVideo(url)) return url;
    let thumbnail = url.replace('/video/upload/', '/image/upload/c_thumb,w_200,h_200,g_center/');
    thumbnail = thumbnail.replace(/\.(mp4|webm|ogg)$/, '.jpg');
    return thumbnail;
  };

  const handleMediaClick = (gallery, index) => {
    setSelectedGallery(gallery);
    setSelectedIndex(index);
    setShowMediaViewer(true);
  };

  // Swipe handling for media viewer
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX.current - touchEndX > 50) {
      // swipe left, next
      setSelectedIndex((prev) => (prev < selectedGallery.length - 1 ? prev + 1 : 0));
    } else if (touchEndX - touchStartX.current > 50) {
      // swipe right, prev
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : selectedGallery.length - 1));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);

    const numericAge = parseInt(formData.age, 10);
    if (isNaN(numericAge) || numericAge < 18) {
      setError('You must be 18 or older to register.');
      setSaveLoading(false);
      return;
    }

    if (!formData.services || formData.services.length < 1) {
      setError('Please select at least 1 service.');
      setSaveLoading(false);
      return;
    }

    if (formData.nearby && formData.nearby.length > 4) {
      setError('You can select up to 4 nearby locations only.');
      setSaveLoading(false);
      return;
    }

    if (!formData.name || !formData.phone || !formData.age || !formData.area || !formData.ward || !formData.county) {
      setError('Please fill all required fields, including location');
      setSaveLoading(false);
      return;
    }

    try { formatPhoneForMpesa(formData.phone); }
    catch (err) { setError(err.message); setSaveLoading(false); return; }

    setError('');

    let profilePicUrl = formData.profilePic;
    if (profilePicUrl && profilePicUrl.startsWith('data:image')) {
      try {
        const res = await fetch('/api/uploadProfilePic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: profilePicUrl }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setError(data.error || 'Failed to upload image to Cloudinary');
          setSaveLoading(false);
          return;
        }
        profilePicUrl = data.url;

        const modRes = await fetch('/api/moderateImage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: profilePicUrl }),
        });
        const modData = await modRes.json();
        if (!modRes.ok || !modData.isSafe) {
          setError(modData.error || 'Image contains inappropriate content. Please upload a different photo.');
          setSaveLoading(false);
          return;
        }
      } catch {
        setError('Failed to process image. Please try again.');
        setSaveLoading(false);
        return;
      }
    }

    try {
      await setDoc(doc(db, 'profiles', loggedInUser.id), {
        ...formData,
        profilePic: profilePicUrl,
        fundingBalance, // Updated
        earningsBalance, // New
      }, { merge: true });
      localStorage.setItem('profileSaved', 'true');
      alert('Profile updated successfully');
      router.push('/');
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRequestVerification = async () => {
    if (verificationRequested || formData.verified) {
      alert('Verification request already sent or profile is verified.');
      return;
    }
    try {
      await setDoc(doc(db, 'profiles', loggedInUser.id), { verificationRequested: true }, { merge: true });
      setVerificationRequested(true);
      alert('Verification request sent. An admin will review your profile.');
    } catch {
      setError('Failed to request verification.');
    }
  };

  const handleUpgrade = (level) => {
    if (level === 'Regular') {
      alert('Regular membership is free! No upgrade needed.');
      return;
    }
    setSelectedLevel(level);
    setSelectedDuration('');
    setShowModal(true);
  };

  const handleDurationSelect = (duration) => setSelectedDuration(duration);

  const handleProceedToPayment = () => {
    if (!selectedDuration) {
      alert('Please select a duration.');
      return;
    }
    if (!formData.phone) {
      alert('Please add your phone number to your profile first.');
      return;
    }
    try {
      formatPhoneForMpesa(formData.phone);
    } catch (error) {
      alert(error.message);
      return;
    }

    const plans = {
      Prime: { '3 Days': 100, '7 Days': 300, '15 Days': 600, '30 Days': 1000 },
      VIP: { '3 Days': 300, '7 Days': 600, '15 Days': 1000, '30 Days': 2000 },
      VVIP: { '3 Days': 400, '7 Days': 900, '15 Days': 1500, '30 Days': 3000 },
    };
    const price = plans[selectedLevel][selectedDuration];
    setSelectedPaymentMethod(fundingBalance >= price ? 'wallet' : 'mpesa');
    setShowPaymentChoice(true);
    setShowModal(false);
  };

  const handlePaymentMethodChange = (method) => setSelectedPaymentMethod(method);

  const handleConfirmWalletUpgrade = async () => {
    const plans = {
      Prime: { '3 Days': 100, '7 Days': 300, '15 Days': 600, '30 Days': 1000 },
      VIP: { '3 Days': 300, '7 Days': 600, '15 Days': 1000, '30 Days': 2000 },
      VVIP: { '3 Days': 400, '7 Days': 900, '15 Days': 1500, '30 Days': 3000 },
    };
    const price = plans[selectedLevel][selectedDuration];
    if (fundingBalance < price) {
      alert('Insufficient balance');
      return;
    }
    const daysMap = { '3 Days': 3, '7 Days': 7, '15 Days': 15, '30 Days': 30 };
    const days = daysMap[selectedDuration];
    const clientExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    if (confirm(`Upgrading to ${selectedLevel} for ${selectedDuration} at KSh ${price} using Funding Wallet. Proceed?`)) {
      const newBalance = fundingBalance - price;
      setFundingBalance(newBalance);
      await setDoc(doc(db, 'profiles', loggedInUser.id), {
        membership: selectedLevel,
        membershipExpiresAt: clientExpiresAt,
        fundingBalance: newBalance
      }, { merge: true });
      setMembership(selectedLevel);
      setShowPaymentChoice(false);
      setSelectedDuration('');
      alert('Upgrade successful!');
    }
  };

  const handleAddFund = () => {
    if (!formData.phone) {
      setError('Please add your phone number to your profile first.');
      return;
    }
    try {
      formatPhoneForMpesa(formData.phone);
      setShowAddFundModal(true);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleWithdraw = async () => {
    if (!formData.phone) {
      alert('Please add your phone number to your profile first.');
      return;
    }
    const amount = parseInt(withdrawAmount, 10);
    if (isNaN(amount) || amount <= 0 || amount > earningsBalance) {
      alert('Invalid amount. Must be between 1 and your earnings balance.');
      return;
    }
    let formattedPhone;
    try {
      formattedPhone = formatPhoneForMpesa(formData.phone);
    } catch (error) {
      alert(error.message);
      return;
    }

    if (!confirm(`Withdraw KSh ${amount} from Earnings to ${formattedPhone}? This is non-refundable.`)) {
      return;
    }

    setWithdrawLoading(true);
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: loggedInUser.id,
          amount,
          phoneNumber: formattedPhone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const newBalance = earningsBalance - amount;
        setEarningsBalance(newBalance);
        await setDoc(doc(db, 'profiles', loggedInUser.id), { earningsBalance: newBalance }, { merge: true });
        alert('Withdrawal initiated! Funds will be sent via M-Pesa.');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
      } else {
        alert('Withdrawal failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Withdrawal error:', err);
      alert('Withdrawal failed. Try again.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('loggedInUser');
    setLoggedInUser(null);
    await signOut(auth);
    router.push('/');
  };

  const countyList = useMemo(() => Object.keys(locations).sort(), []);
  const wards = useMemo(() => formData.county && locations[formData.county] ? Object.keys(locations[formData.county]) : [], [formData.county]);
  const areas = useMemo(() => selectedWard && locations[formData.county] ? locations[formData.county][selectedWard] : [], [formData.county, selectedWard]);

  const plans = useMemo(() => ({
    Prime: { '3 Days': 100, '7 Days': 300, '15 Days': 600, '30 Days': 1000 },
    VIP: { '3 Days': 300, '7 Days': 600, '15 Days': 1200, '30 Days': 2000 },
    VVIP: { '3 Days': 400, '7 Days': 900, '15 Days': 1500, '30 Days': 3000 },
  }), []);

  if (loading) {
    return <div className={styles.container}>Loading profile...</div>;
  }

  return (
    <div className={`${styles.container} ${styles.premiumTheme}`}> {/* Added premium theme class for gradients/shadows */}
      <Head>
        <title>Meet Connect Ladies - Profile Setup</title>
        <meta name="description" content="Set up your profile on Meet Connect Ladies for gentlemen." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className={`${styles.header} ${styles.premiumHeader}`}>
        <div className={styles.logoContainer}>
          <h1 onClick={() => router.push('/')} className={styles.title}>
            Meet Connect
          </h1>
        </div>
        <div className={styles.authButtons}>
          <button onClick={handleLogout} className={`${styles.button} ${styles.logout}`}>
            Logout
          </button>
        </div>
      </header>

      <main className={`${styles.main} ${styles.premiumMain}`}>
        <div className={styles.profileSetupContainer}>
          <aside className={`${styles.membershipSection} ${styles.premiumSidebar}`}>
            {/* Funding Wallet Section */}
            <div className={`${styles.walletSection} ${styles.fundingWallet}`}>
              <div className={styles.walletStripe}></div>
              <p className={styles.walletLabel}>Funding Wallet (Non-Withdrawable)</p>
              <p className={styles.walletBalance}>KSh {fundingBalance}</p>
              <button onClick={handleAddFund} className={styles.addFundButton}>
                Add Fund
              </button>
            </div>

            {/* Earnings Wallet Section */}
            <div className={`${styles.walletSection} ${styles.earningsWallet}`}>
              <div className={styles.walletStripe}></div>
              <p className={styles.walletLabel}>Earnings Wallet</p>
              <p className={styles.walletBalance}>KSh {earningsBalance}</p>
              <button onClick={() => setShowWithdrawModal(true)} className={styles.withdrawButton} disabled={earningsBalance <= 0}>
                Withdraw
              </button>
              <button onClick={() => setShowEarningsHistory(true)} className={styles.historyButton}>
                View Purchases
              </button>
            </div>

            <h2 className={styles.sectionTitle}>My Membership</h2>
            <p>Current: {membership}</p>
            <p>Regular: Free</p>
            <button onClick={() => handleUpgrade('Prime')} className={styles.upgradeButton}>
              Upgrade to Prime
            </button>
            <button onClick={() => handleUpgrade('VIP')} className={styles.upgradeButton}>
              Upgrade to VIP
            </button>
            <button onClick={() => handleUpgrade('VVIP')} className={styles.upgradeButton}>
              Upgrade to VVIP
            </button>

            {/* Upgrade Duration Modal */}
            {showModal && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>Select Duration for {selectedLevel}</h3>
                  <div className={styles.durationList}>
                    {Object.entries(plans[selectedLevel]).map(([duration, price]) => (
                      <div key={duration} className={styles.durationItem}>
                        <label className={styles.durationLabel}>
                          <input
                            type="radio"
                            name="duration"
                            value={duration}
                            checked={selectedDuration === duration}
                            onChange={() => handleDurationSelect(duration)}
                          />
                          <span className={styles.durationText}>{duration} Listing = KSh {price}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className={styles.modalButtons}>
                    <button 
                      onClick={handleProceedToPayment} 
                      className={`${styles.upgradeButton} ${selectedDuration ? styles.active : styles.inactive}`}
                      disabled={!selectedDuration}
                    >
                      Proceed to Payment
                    </button>
                    <button onClick={() => setShowModal(false)} className={styles.closeButton}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Choice Modal */}
            {showPaymentChoice && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>Choose Payment Method for {selectedLevel} - {selectedDuration}</h3>
                  <p className={styles.durationText}>Total: KSh {plans[selectedLevel][selectedDuration]}</p>
                  <div className={styles.durationList}>
                    <div className={styles.durationItem}>
                      <label className={styles.durationLabel}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="wallet"
                          checked={selectedPaymentMethod === 'wallet'}
                          onChange={() => handlePaymentMethodChange('wallet')}
                        />
                        <span className={styles.durationText}>Funding Wallet (KSh {fundingBalance})</span>
                      </label>
                    </div>
                    <div className={styles.durationItem}>
                      <label className={styles.durationLabel}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="mpesa"
                          checked={selectedPaymentMethod === 'mpesa'}
                          onChange={() => handlePaymentMethodChange('mpesa')}
                        />
                        <span className={styles.durationText}>M-Pesa (STK Push)</span>
                      </label>
                    </div>
                  </div>
                  {selectedPaymentMethod === 'mpesa' && (
                    <StkPushForm
                      initialPhone={mpesaPhone}
                      initialAmount={plans[selectedLevel][selectedDuration]}
                      readOnlyAmount={true}
                      apiEndpoint="/api/stkpush"
                      additionalBody={{
                        userId: loggedInUser.id,
                        type: 'upgrade',
                        level: selectedLevel,
                        duration: selectedDuration,
                        accountReference: `upg_${shortenUserId(loggedInUser.id)}_${selectedLevel.slice(0, 3)}`,
                        transactionDesc: `Upgrade to ${selectedLevel} for ${selectedDuration}`,
                      }}
                    />
                  )}
                  <div className={styles.modalButtons}>
                    {selectedPaymentMethod === 'wallet' && (
                      <button 
                        onClick={handleConfirmWalletUpgrade} 
                        className={styles.upgradeButton}
                        disabled={fundingBalance < plans[selectedLevel][selectedDuration]}
                      >
                        Confirm Payment
                      </button>
                    )}
                    <button onClick={() => { setShowPaymentChoice(false); setShowModal(true); }} className={styles.closeButton}>
                      Back
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Fund Modal */}
            {showAddFundModal && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>Add Funds to Funding Wallet</h3>
                  <p>Phone: {formData.phone} (will be formatted for M-Pesa)</p>
                  <StkPushForm
                    initialPhone={mpesaPhone}
                    apiEndpoint="/api/stkpush"
                    additionalBody={{
                      userId: loggedInUser.id,
                      type: 'addfund',
                      accountReference: `wal_${shortenUserId(loggedInUser.id)}`,
                      transactionDesc: 'Add funds to funding wallet'
                    }}
                  />
                  <div className={styles.modalButtons}>
                    <button onClick={() => setShowAddFundModal(false)} className={styles.closeButton}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Withdraw Modal */}
            {showWithdrawModal && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>Withdraw from Earnings</h3>
                  <p>Available: KSh {earningsBalance}</p>
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className={styles.input}
                    min="1"
                    max={earningsBalance}
                  />
                  <button 
                    onClick={handleWithdraw} 
                    className={styles.withdrawButton}
                    disabled={withdrawLoading || !withdrawAmount}
                  >
                    {withdrawLoading ? 'Processing...' : 'Withdraw Now'}
                  </button>
                  <button onClick={() => setShowWithdrawModal(false)} className={styles.closeButton}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Earnings History Modal */}
            {showEarningsHistory && (
              <div className={styles.modal}>
                <div className={`${styles.modalContent} ${styles.historyModal}`}>
                  <h3>Purchase History</h3>
                  {transactions.length === 0 ? (
                    <p>No subscriptions yet.</p>
                  ) : (
                    <table className={styles.historyTable}>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Amount (KSh)</th>
                          <th>Duration (Days)</th>
                          <th>Purchase Date</th>
                          <th>Expires</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{tx.userName}</td>
                            <td>{tx.amount}</td>
                            <td>{tx.duration}</td>
                            <td>{tx.date}</td>
                            <td>{tx.expiresAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button onClick={() => setShowEarningsHistory(false)} className={styles.closeButton}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </aside>

          <div className={`${styles.profileFormContainer} ${styles.premiumForm}`}>
            <h1 className={styles.setupTitle}>My Profile</h1>

            {/* Profile Picture */}
            <div className={styles.profilePicSection}>
              <label htmlFor="profilePicUpload" className={styles.profilePicLabel}>
                {formData.profilePic ? (
                  <Image
                    src={formData.profilePic}
                    alt="Profile Picture"
                    width={0}
                    height={0}
                    sizes="100vw"
                    style={{ width: '100%', height: 'auto' }}
                    className={styles.profilePic}
                  />
                ) : (
                  <div className={styles.profilePicPlaceholder}></div>
                )}
              </label>
              <input
                id="profilePicUpload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className={styles.profilePicInput}
              />
            </div>

            {/* Create Post Button */}
            <button type="button" onClick={() => setShowCreatePostModal(true)} className={styles.createPostButton}>
              + Create Post
            </button>

            {/* View Buttons Container */}
            <div className={styles.viewButtonsContainer}>
              <button type="button" onClick={() => setShowPostsModal(true)} className={styles.viewPostsButton}>
                Posts
              </button>
              <button type="button" onClick={() => setShowExclusiveModal(true)} className={styles.viewExclusiveButton}>
                Exclusive Posts
              </button>
            </div>

            {/* Create Post Modal */}
            {showCreatePostModal && (
              <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowCreatePostModal(false)}>
                <div className={styles.createPostModal}>
                  <div className={styles.modalHeader}>
                    <button onClick={() => setShowCreatePostModal(false)} className={styles.modalBack}>←</button>
                    <h2>Create Post</h2>
                  </div>

                  <label className={styles.mediaUploadArea}>
                    {postPreviews.length > 0 ? (
                      <div className={styles.postPreviewGrid}>
                        {postPreviews.map((preview, i) => (
                          <div key={i} className={styles.postPreviewItem}>
                            {postFiles[i].type.startsWith('video/') ? (
                              <video 
                                src={preview} 
                                className={styles.postPreviewImg} 
                                style={{ width: '100%', height: 'auto' }} 
                                controls 
                                muted
                                preload="metadata"
                              />
                            ) : (
                              <Image 
                                src={preview} 
                                alt="" 
                                width={0} 
                                height={0} 
                                sizes="100vw" 
                                style={{ width: '100%', height: 'auto' }} 
                                className={styles.postPreviewImg} 
                              />
                            )}
                            <button onClick={() => handleRemovePostPreview(i)} className={styles.removePreview}>×</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <span className={styles.plusIcon}>+</span>
                        <p>Add Media</p>
                      </>
                    )}
                    <input type="file" accept="image/*,video/*" multiple onChange={handlePostFileSelect} className={styles.hiddenFileInput} />
                  </label>

                  <textarea
                    placeholder="Add a tease no one can resist..."
                    value={postCaption}
                    onChange={(e) => setPostCaption(e.target.value.slice(0, 500))}
                    className={styles.postCaption}
                    rows={4}
                  />
                  <div className={styles.captionCounter}>{postCaption.length}/500</div>

                  <div className={styles.postPrivacy}>
                    <span>Share with Subscribers only<br /><small>Only your Subscribers{'’'} will see this post</small></span>
                    <label className={styles.toggleSwitch}>
                      <input type="checkbox" checked={postIsExclusive} onChange={(e) => setPostIsExclusive(e.target.checked)} />
                      <span className={styles.slider}></span>
                    </label>
                  </div>

                  <button
                    onClick={handleCreatePost}
                    disabled={postFiles.length === 0 || postUploading}
                    className={styles.postSubmitButton}
                  >
                    {postUploading ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            )}

            {/* Posts Gallery Modal */}
            {showPostsModal && (
              <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowPostsModal(false)}>
                <div className={styles.galleryModal}>
                  <div className={styles.modalHeader}>
                    <button onClick={() => setShowPostsModal(false)} className={styles.modalBack}>←</button>
                    <h2>Posts</h2>
                  </div>
                  <div className={styles.gallery}>
                    {(formData.normalPics || []).map((url, index) => (
                      <div key={index} className={styles.galleryItem} onClick={() => handleMediaClick(formData.normalPics, index)}>
                        <Image 
                          src={getThumbnail(url)} 
                          alt="" 
                          width={0} 
                          height={0} 
                          sizes="100vw" 
                          style={{ width: '100%', height: 'auto' }} 
                          loading="lazy"
                          className={styles.galleryPic} 
                        />
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveNormalPic(index); }} className={styles.removeButton}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Exclusive Gallery Modal */}
            {showExclusiveModal && (
              <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowExclusiveModal(false)}>
                <div className={styles.galleryModal}>
                  <div className={styles.modalHeader}>
                    <button onClick={() => setShowExclusiveModal(false)} className={styles.modalBack}>←</button>
                    <h2>Exclusive Content</h2>
                  </div>
                  <div className={styles.gallery}>
                    {(formData.exclusivePics || []).map((url, index) => (
                      <div key={index} className={styles.galleryItem} onClick={() => handleMediaClick(formData.exclusivePics, index)}>
                        <Image 
                          src={getThumbnail(url)} 
                          alt="" 
                          width={0} 
                          height={0} 
                          sizes="100vw" 
                          style={{ width: '100%', height: 'auto' }} 
                          loading="lazy"
                          className={styles.galleryPic} 
                        />
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveExclusivePic(index); }} className={styles.removeButton}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Media Viewer Modal with Slider */}
            {showMediaViewer && (
              <div className={styles.modalOverlay} onClick={() => setShowMediaViewer(false)}>
                <div className={styles.imageViewer} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                  <button className={styles.viewerNav} onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : selectedGallery.length - 1))}></button>
                  {isVideo(selectedGallery[selectedIndex]) ? (
                    <video 
                      src={selectedGallery[selectedIndex]} 
                      poster={getThumbnail(selectedGallery[selectedIndex])}
                      className={styles.viewerImage} 
                      style={{ objectFit: 'contain' }} 
                      controls 
                      autoPlay 
                      loop
                      preload="metadata"
                    />
                  ) : (
                    <Image 
                      src={selectedGallery[selectedIndex]} 
                      alt="" 
                      fill 
                      className={styles.viewerImage} 
                      style={{ objectFit: 'contain' }} 
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAmf/aAAgBAwEBPwAbb//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAQUKX//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQMBAT8hAD//xAAUEQEAAAAAAAAAAAAAAAAAAAAg/9oACAEBAAY/ACM//9k="
                    />
                  )}
                  <button className={styles.viewerNav} onClick={() => setSelectedIndex((prev) => (prev < selectedGallery.length - 1 ? prev + 1 : 0))}></button>
                  <button className={styles.viewerClose} onClick={() => setShowMediaViewer(false)}>×</button>
                </div>
              </div>
            )}

            {showInappropriateBanner && (
              <div className={styles.inappropriateBanner}>
                <p>Inappropriate images aren{'’'}t allowed in the public gallery. Please upload suitable content or mark as exclusive.</p>
                <button onClick={() => setShowInappropriateBanner(false)}>Dismiss</button>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} className={styles.profileForm}>
              <label className={styles.label}>
                Name
                <input type="text" name="name" value={formData.name} onChange={handleChange} className={styles.input} required />
              </label>

              <label className={styles.label}>
                Phone Number <small>(e.g., 0712345678)</small>
                <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={styles.input} required placeholder="0712345678" />
              </label>

              <label className={styles.label}>
                Gender
                <select name="gender" value={formData.gender} onChange={handleChange} className={styles.select}>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </label>

              <label className={styles.label}>
                Sexual Orientation
                <select name="sexualOrientation" value={formData.sexualOrientation} onChange={handleChange} className={styles.select}>
                  <option value="Straight">Straight</option>
                  <option value="Gay">Gay</option>
                  <option value="Bisexual">Bisexual</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className={styles.label}>
                Age
                <input type="number" name="age" min="18" max="100" value={formData.age} onChange={handleChange} className={styles.input} required />
              </label>

              <label className={styles.label}>
                Nationality
                <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} className={styles.input} />
              </label>

              <label className={styles.label}>
                County
                <select name="county" value={formData.county} onChange={handleChange} className={styles.select}>
                  <option value="">Select County</option>
                  {countyList.map((county) => (
                    <option key={county} value={county}>{county}</option>
                  ))}
                </select>
              </label>

              <label className={styles.label}>
                City/Town
                <select name="ward" value={selectedWard} onChange={handleWardChange} className={styles.select} disabled={!formData.county}>
                  <option value="">Select City/Town</option>
                  {wards.map((ward) => (
                    <option key={ward} value={ward}>{ward}</option>
                  ))}
                </select>
              </label>

              <label className={styles.label}>
                Area
                <select name="area" value={formData.area} onChange={handleAreaChange} className={styles.select} disabled={!selectedWard}>
                  <option value="">Select Area</option>
                  {areas.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </label>

              <label className={styles.label}>
                Nearby Places
                <div className={styles.checkboxGroup}>
                  {areas.map((place) => (
                    <div key={place}>
                      <input type="checkbox" value={place} checked={(formData.nearby || []).includes(place)} onChange={handleChange} name="nearby" />
                      <span>{place}</span>
                    </div>
                  ))}
                </div>
              </label>

              <label className={styles.label}>
                Services
                <div className={styles.checkboxGroup}>
                  {servicesList.map((service) => (
                    <div key={service}>
                      <input type="checkbox" value={service} checked={(formData.services || []).includes(service)} onChange={handleChange} name="services" />
                      <span>{service}</span>
                    </div>
                  ))}
                </div>
              </label>

              <button type="submit" className={styles.button} disabled={saveLoading}>
                {saveLoading ? 'Saving...' : 'Save Profile'}
              </button>

              <button 
                type="button" 
                onClick={handleRequestVerification} 
                className={styles.button} 
                disabled={verificationRequested || formData.verified}
              >
                {formData.verified ? 'Verified' : verificationRequested ? 'Verification Pending' : 'Request Verification'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
