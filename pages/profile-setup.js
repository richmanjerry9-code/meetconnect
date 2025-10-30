// pages/profile-setup.js

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import * as locations from '../data/locations';
import styles from '../styles/ProfileSetup.module.css';
import { db, storage } from '../lib/firebase';
import { doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import toast, { Toaster } from 'react-hot-toast';

const servicesList = [
  '🍽️ Dinner Date',
  '💬 Just Vibes',
  '❤️ Relationship',
  '🌆 Night Out',
  '👥 Friendship',
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
    services: [], // ensure array so .includes won't crash
    otherServices: '',
    profilePic: '',
  });
  const [selectedWard, setSelectedWard] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [membership, setMembership] = useState('Regular');
  const [walletBalance, setWalletBalance] = useState(0);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  // New states for Add Fund modal
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [addFundAmount, setAddFundAmount] = useState('');
  // New states for Upgrade Payment Choice
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet'); // 'wallet' or 'mpesa'
  // New states for M-Pesa upgrade waiting
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [checkoutRequestID, setCheckoutRequestID] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState(''); // For M-Pesa prompt phone
  // New state for notifications
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!user) {
      router.push('/');
      return;
    }
    setLoggedInUser(user);
    const fetchProfile = async () => {
      try {
        const profileDoc = await getDoc(doc(db, 'profiles', user.id));
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          setFormData((prev) => ({
            ...prev,
            ...data,
            username: user.username,
            services: data.services || [],
            nearby: data.nearby || [],
            age: data.age || prev.age,
          }));
          setSelectedWard(data.ward || '');
          setWalletBalance(data.walletBalance || 0);
          setMembership(data.membership || 'Regular');
          setMpesaPhone(data.phone || ''); // Default M-Pesa phone to profile phone
        } else {
          setFormData((prev) => ({ ...prev, username: user.username }));
          setWalletBalance(0);
          setMembership('Regular');
        }
      } catch (err) {
        console.error('Fetch profile error:', err);
      }
    };
    fetchProfile();

    // Fetch user notifications on load
    if (!loggedInUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', loggedInUser.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const newNotifs = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        newNotifs.push({ id: docSnap.id, ...data });

        // 🚨 Instantly alert user on new rejection
        if (data.type === 'image_rejection' && !data.read) {
          toast.error(data.message, { icon: '🚫' });

          // Mark notification as read so alert doesn’t repeat
          setDoc(docSnap.ref, { read: true }, { merge: true });
        }
      });

      // Store only unread notifications for UI display
      setNotifications(newNotifs.filter((n) => !n.read));
    });

    return () => unsub();
  }, [router, loggedInUser]);

  // Helper function to format phone for M-Pesa (254xxxxxxxxx)
  const formatPhoneForMpesa = (phone) => {
    if (!phone) return '';
    let formatted = phone.replace(/[\s+]/g, ''); // Remove spaces and +
    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.slice(1);
    } else if (formatted.startsWith('254') || formatted.startsWith('7') || formatted.startsWith('1')) {
      // Already good or needs prefix
      if (formatted.length === 9 && (formatted.startsWith('7') || formatted.startsWith('1'))) {
        formatted = '254' + formatted;
      }
    }
    // Validate length
    if (formatted.length !== 12 || !formatted.match(/^254[0-9]\d{8}$/)) {
      throw new Error('Invalid phone number. Use format like 254 followed by 9 digits.');
    }
    return formatted;
  };

  // Helper to shorten userId to last 10 chars for ref
  const shortenUserId = (userId) => userId ? userId.slice(-10) : '';

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      // handle nearby with max 4, services with normal toggle
      if (name === 'nearby') {
        setFormData((prev) => {
          const current = prev.nearby || [];
          if (checked) {
            if (current.includes(value)) return prev;
            if (current.length >= 4) {
              setError('You can select up to 4 nearby locations only.');
              // don't add more than 4
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
        // generic checkbox groups like services
        setFormData((prev) => ({
          ...prev,
          [name]: checked
            ? [...(prev[name] || []), value]
            : (prev[name] || []).filter((v) => v !== value),
        }));
      }
    } else {
      // normal input/select change
      setFormData((prev) => ({ ...prev, [name]: value }));
      // clear error on user interaction
      if (error) setError('');
    }
  };

  const handleCountyChange = (e) => {
    const county = e.target.value;
    setFormData((prev) => ({ ...prev, county, ward: '', area: '', nearby: [] }));
    setSelectedWard('');
    setSearchQuery('');
    setFilteredOptions([]);
    if (error) setError('');
  };

  const handleWardChange = (e) => {
    const ward = e.target.value;
    setSelectedWard(ward);
    setFormData((prev) => ({ ...prev, ward, area: '', nearby: [] }));
    setSearchQuery('');
    setFilteredOptions([]);
    if (error) setError('');
  };

  const handleAreaChange = (e) => {
    setFormData((prev) => ({ ...prev, area: e.target.value }));
    if (error) setError('');
  };

  const handleSearchChange = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    if (!query) {
      setFilteredOptions([]);
      return;
    }

    const allOptions = [
      ...Object.keys(locations),
      ...Object.values(locations).flatMap((county) => Object.keys(county)),
      ...Object.values(locations).flatMap((county) => Object.values(county).flat()),
    ].filter((item, index, self) => self.indexOf(item) === index);

    const filtered = allOptions
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 5);
    setFilteredOptions(filtered);
  };

  const handleSelectOption = (option) => {
    // Check if it's a county
    if (Object.keys(locations).includes(option)) {
      setFormData((prev) => ({ ...prev, county: option, ward: '', area: '', nearby: [] }));
      setSelectedWard('');
    } else {
      // Check if it's a ward
      let foundCounty = null;
      let isWard = false;
      for (const [county, wardsObj] of Object.entries(locations)) {
        if (Object.keys(wardsObj).includes(option)) {
          foundCounty = county;
          isWard = true;
          break;
        }
      }
      if (isWard) {
        setFormData((prev) => ({ ...prev, county: foundCounty, ward: option, area: '', nearby: [] }));
        setSelectedWard(option);
      } else {
        // Assume it's an area
        let foundCounty = null;
        let foundWard = null;
        for (const [county, wardsObj] of Object.entries(locations)) {
          for (const [ward, areas] of Object.entries(wardsObj)) {
            if (areas.includes(option)) {
              foundCounty = county;
              foundWard = ward;
              break;
            }
          }
          if (foundWard) break;
        }
        if (foundWard) {
          setFormData((prev) => ({ ...prev, county: foundCounty, ward: foundWard, area: option, nearby: [] }));
          setSelectedWard(foundWard);
        }
      }
    }
    setSearchQuery('');
    setFilteredOptions([]);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Age validation: allow typing but block below 18
    const numericAge = parseInt(formData.age, 10);
    if (isNaN(numericAge) || numericAge < 18) {
      setError('You must be 18 or older to register.');
      return;
    }

    // Require at least 1 selected service
    if (!formData.services || formData.services.length < 1) {
      setError('Please select at least 1 service.');
      return;
    }

    // Require profile picture
    if (!formData.profilePic) {
      setError('Please upload a profile picture.');
      return;
    }

    // Limit nearby places to a maximum of 4
    if (formData.nearby && formData.nearby.length > 4) {
      setError('You can select up to 4 nearby locations only.');
      return;
    }

    if (!formData.name || !formData.phone || !formData.age || !formData.area || !formData.ward || !formData.county) {
      setError('Please fill all required fields, including location');
      return;
    }
    setError('');
    try {
      const fullData = { ...loggedInUser, ...formData, walletBalance };
      await setDoc(doc(db, 'profiles', loggedInUser.id), fullData, { merge: true });
      localStorage.setItem('profileSaved', 'true');
      alert('Profile updated successfully');
      router.push('/');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
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

  const handleDurationSelect = (duration) => {
    setSelectedDuration(duration);
  };

  const handleProceedToPayment = () => {
    if (!selectedDuration) {
      alert('Please select a duration.');
      return;
    }
    const plans = {
      Prime: { '3 Days': 100, '7 Days': 250, '15 Days': 400, '30 Days': 1000 },
      VIP: { '3 Days': 200, '7 Days': 500, '15 Days': 800, '30 Days': 2000 },
      VVIP: { '3 Days': 300, '7 Days': 700, '15 Days': 1200, '30 Days': 3000 },
    };
    const price = plans[selectedLevel][selectedDuration];
    if (walletBalance >= price) {
      setSelectedPaymentMethod('wallet');
      setShowPaymentChoice(true);
      setShowModal(false);
    } else {
      setSelectedPaymentMethod('mpesa');
      setShowPaymentChoice(true);
      setShowModal(false);
    }
  };

  const handlePaymentMethodChange = (method) => {
    setSelectedPaymentMethod(method);
  };

  const handleConfirmWalletUpgrade = async () => {
    const plans = {
      Prime: { '3 Days': 100, '7 Days': 250, '15 Days': 400, '30 Days': 1000 },
      VIP: { '3 Days': 200, '7 Days': 500, '15 Days': 800, '30 Days': 2000 },
      VVIP: { '3 Days': 300, '7 Days': 700, '15 Days': 1200, '30 Days': 3000 },
    };
    const price = plans[selectedLevel][selectedDuration];
    if (walletBalance < price) {
      alert('Insufficient balance');
      return;
    }
    if (confirm(`Upgrading to ${selectedLevel} for ${selectedDuration} at KSh ${price} using Wallet. Proceed?`)) {
      const newBalance = walletBalance - price;
      setWalletBalance(newBalance);
      await setDoc(doc(db, 'profiles', loggedInUser.id), { 
        membership: selectedLevel,
        walletBalance: newBalance 
      }, { merge: true });
      setMembership(selectedLevel);
      setShowPaymentChoice(false);
      setSelectedDuration('');
      alert('Upgrade successful!');
    }
  };

  const handleConfirmMpesaUpgrade = async () => {
    try {
      const formattedPhone = formatPhoneForMpesa(mpesaPhone || formData.phone); // Use mpesaPhone or profile phone
      const plans = {
        Prime: { '3 Days': 100, '7 Days': 250, '15 Days': 400, '30 Days': 1000 },
        VIP: { '3 Days': 200, '7 Days': 500, '15 Days': 800, '30 Days': 2000 },
        VVIP: { '3 Days': 300, '7 Days': 700, '15 Days': 1200, '30 Days': 3000 },
      };
      const price = plans[selectedLevel][selectedDuration];
      const shortUserId = shortenUserId(loggedInUser.id);
      const shortLevel = selectedLevel.slice(0, 3); // Pri, VIP, VVI
      const accountRef = `upg_${shortUserId}_${shortLevel}`; // e.g., upg_nxLdK1XA5_Pri (20 chars max)

      // Store pending transaction in Firestore
      const checkoutRequestID = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await addDoc(collection(db, 'pendingTransactions'), {
        userId: loggedInUser.id,
        amount: price,
        phone: formattedPhone,
        type: 'upgrade',
        level: selectedLevel,
        duration: selectedDuration,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      // Initiate STK Push
      const response = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: price,
          phone: formattedPhone,
          userId: loggedInUser.id,
          level: selectedLevel,
          duration: selectedDuration,
          accountReference: accountRef,
          transactionDesc: `Upgrade to ${selectedLevel} for ${selectedDuration}`,
          checkoutRequestID, // Pass to API for storage if needed
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setCheckoutRequestID(data.CheckoutRequestID);
        setShowProcessingModal(true);
        setShowPaymentChoice(false);
        setShowModal(false);
        setSelectedDuration('');

        // Poll for confirmation (auto-upgrade on success)
        const pollInterval = setInterval(async () => {
          const profileDoc = await getDoc(doc(db, 'profiles', loggedInUser.id));
          if (profileDoc.exists()) {
            const updatedData = profileDoc.data();
            if (updatedData.membership === selectedLevel) {
              setMembership(selectedLevel);
              setShowProcessingModal(false);
              clearInterval(pollInterval);
              alert('Upgrade confirmed and applied automatically!');
            }
          }
        }, 5000); // Poll every 5 seconds

        setTimeout(() => clearInterval(pollInterval), 60000); // Stop after 1 min
      } else {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error, null, 2) : errorData.error;
        alert(`Error: ${errorMsg}`);
        console.error('Full error data:', errorData);
      }
    } catch (error) {
      console.error('Upgrade M-Pesa error:', error);
      const errorMsg = typeof error === 'object' ? JSON.stringify(error, null, 2) : error.message || 'Failed to initiate payment. Please check your phone number.';
      alert(`Error: ${errorMsg}`);
      setError(errorMsg);
    }
  };

  const handleAddFund = () => {
    if (!formData.phone) {
      setError('Please add your phone number to your profile first.');
      return;
    }
    try {
      formatPhoneForMpesa(formData.phone); // Validate early
      setAddFundAmount('');
      setShowAddFundModal(true);
    } catch (error) {
      const errorMsg = typeof error === 'object' ? JSON.stringify(error, null, 2) : error.message;
      setError(errorMsg);
    }
  };

  const handleConfirmAddFund = async () => {
    if (!addFundAmount || parseInt(addFundAmount) < 10) {
      setError('Minimum amount is KSh 10.');
      return;
    }
    try {
      const formattedPhone = formatPhoneForMpesa(formData.phone);
      const shortUserId = shortenUserId(loggedInUser.id);
      const accountRef = `wal_${shortUserId}`; // e.g., wal_nxLdK1XA5 (15 chars)
      const response = await fetch('/api/addFunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseInt(addFundAmount),
          phone: formattedPhone,
          userId: loggedInUser.id,
          accountReference: accountRef,
          transactionDesc: 'Add funds to wallet'
        }),
      });
      if (response.ok) {
        const data = await response.json();
        alert(`STK Push initiated. CheckoutRequestID: ${data.CheckoutRequestID}. Please check your phone for M-Pesa prompt.`);
        setShowAddFundModal(false);
      } else {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error, null, 2) : errorData.error;
        alert(`Error: ${errorMsg}`);
        console.error('Full error data:', errorData);
      }
    } catch (error) {
      console.error('Add fund error:', error);
      const errorMsg = typeof error === 'object' ? JSON.stringify(error, null, 2) : error.message || 'Failed to initiate payment. Please check your phone number.';
      alert(`Error: ${errorMsg}`);
      setError(errorMsg);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setLoggedInUser(null);
    router.push('/');
  };

  const uploadToTempStorage = async (file) => {
    const storageRef = ref(storage, `temp/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url, storageRef };
  };

  const saveToUserProfile = (tempUrl) => {
    setFormData((prev) => ({ ...prev, profilePic: tempUrl }));
  };

  const handleImageUpload = async (file) => {
    try {
      // Step 1: Upload temporarily (Firebase Storage or cloud)
      const { url: tempUrl, storageRef: tempRef } = await uploadToTempStorage(file);

      // Step 2: Check image via API
      const res = await fetch('/api/upload-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: tempUrl })
      });

      if (!res.ok) {
        throw new Error(`API check failed with status: ${res.status}`);
      }

      const data = await res.json();

      if (!data.accepted) {
        await deleteObject(tempRef); // Delete rejected image

        // Save rejection notice in Firestore for user
        await addDoc(collection(db, 'notifications'), {
          userId: loggedInUser.id,
          type: 'image_rejection',
          message: `Your profile photo was rejected: ${data.message}`,
          timestamp: new Date().toISOString(),
          read: false,
        });

        setError(`❌ Image rejected: ${data.message}`);
        alert(`Image rejected: ${data.message}. Please upload a safe photo.`);
        return;
      }

      // ✅ Safe image, save permanently or update profile
      saveToUserProfile(tempUrl);
      alert(data.message);
    } catch (err) {
      console.error('Image upload error:', err);
      setError('Failed to upload image. Please try again or check console for details.');
      alert('Failed to upload image. Please try again.');
    }
  };

  const counties = Object.keys(locations);
  const wards = formData.county ? Object.keys(locations[formData.county]) : [];
  const areas = selectedWard && formData.county ? locations[formData.county][selectedWard] : [];

  const plans = {
    Prime: { '3 Days': 100, '7 Days': 250, '15 Days': 400, '30 Days': 1000 },
    VIP: { '3 Days': 200, '7 Days': 500, '15 Days': 800, '30 Days': 2000 },
    VVIP: { '3 Days': 300, '7 Days': 700, '15 Days': 1200, '30 Days': 3000 },
  };

  return (
    <div className={styles.container}>
      <Toaster />
      <Head>
        <title>Meet Connect Ladies - Profile Setup</title>
        <meta name="description" content="Set up your profile on Meet Connect Ladies for gentlemen." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <h1 onClick={() => router.push('/')} className={styles.title}>
            Meet Connect Ladies ❤️
          </h1>
        </div>
        <div className={styles.authButtons}>
          <button onClick={handleLogout} className={`${styles.button} ${styles.logout}`}>
            Logout
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.profileSetupContainer}>
          <aside className={styles.membershipSection}>
            <div className={styles.walletSection}>
              <div className={styles.walletStripe}></div>
              <p className={styles.walletLabel}>Available Wallet Balance</p>
              <p className={styles.walletBalance}>KSh{walletBalance}</p>
              <button onClick={handleAddFund} className={styles.addFundButton}>
                Add Fund
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
                        <span className={styles.durationText}>Wallet Balance (KSh {walletBalance})</span>
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
                    <label className={styles.label}>
                      M-Pesa Phone Number <small>(for prompt)</small>
                      <input
                        type="text"
                        value={mpesaPhone}
                        onChange={(e) => setMpesaPhone(e.target.value)}
                        placeholder="0712345678"
                        className={styles.input}
                      />
                    </label>
                  )}
                  <div className={styles.modalButtons}>
                    <button 
                      onClick={selectedPaymentMethod === 'wallet' ? handleConfirmWalletUpgrade : handleConfirmMpesaUpgrade} 
                      className={styles.upgradeButton}
                      disabled={selectedPaymentMethod === 'wallet' && walletBalance < plans[selectedLevel][selectedDuration]}
                    >
                      Confirm Payment
                    </button>
                    <button onClick={() => { setShowPaymentChoice(false); setShowModal(true); }} className={styles.closeButton}>
                      Back
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Processing Modal for M-Pesa Confirmation */}
            {showProcessingModal && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>Processing Upgrade</h3>
                  <p>Check your phone for M-Pesa prompt. CheckoutRequestID: {checkoutRequestID}</p>
                  <p>Upgrade will auto-apply after payment confirmation.</p>
                  <div className={styles.modalButtons}>
                    <button onClick={() => setShowProcessingModal(false)} className={styles.closeButton}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Add Fund Modal */}
            {showAddFundModal && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>Add Funds to Wallet</h3>
                  <p>Phone: {formData.phone} (will be formatted for M-Pesa)</p>
                  <label className={styles.label}>
                    Amount (KSh)
                    <input
                      type="number"
                      value={addFundAmount}
                      onChange={(e) => setAddFundAmount(e.target.value)}
                      min="10"
                      className={styles.input}
                      required
                    />
                  </label>
                  <div className={styles.modalButtons}>
                    <button 
                      onClick={handleConfirmAddFund} 
                      className={styles.upgradeButton}
                      disabled={!addFundAmount || parseInt(addFundAmount) < 10}
                    >
                      Pay with M-Pesa
                    </button>
                    <button onClick={() => setShowAddFundModal(false)} className={styles.closeButton}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>

          <div className={styles.profileFormContainer}>
            <h1 className={styles.setupTitle}>My Profile</h1>
            <div className={styles.profilePicSection}>
              <label htmlFor="profilePicUpload" className={styles.profilePicLabel}>
                {formData.profilePic ? (
                  <Image
                    src={formData.profilePic}
                    alt="Profile Picture"
                    width={150}
                    height={150}
                    className={styles.profilePic}
                  />
                ) : (
                  <div className={styles.profilePicPlaceholder}>📷</div>
                )}
              </label>
              <input
                id="profilePicUpload"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    handleImageUpload(file);
                  }
                }}
                className={styles.profilePicInput}
              />
            </div>

            {/* Notification Banner */}
            {notifications.length > 0 && (
              <div className={styles.notificationBanner}>
                {notifications.map((n) => (
                  <p key={n.id} className={styles.notificationMessage}>
                    {n.message}
                  </p>
                ))}
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} className={styles.profileForm}>
              <label className={styles.label}>
                Name
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={styles.input}
                  required
                />
              </label>

              <label className={styles.label}>
                Phone Number <small>(254 followed by 9 digits, e.g., 0712345678)</small>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={styles.input}
                  required
                  placeholder="0712345678"
                />
              </label>

              <label className={styles.label}>
                Gender
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </label>

              <label className={styles.label}>
                Sexual Orientation
                <select
                  name="sexualOrientation"
                  value={formData.sexualOrientation}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="Straight">Straight</option>
                  <option value="Gay">Gay</option>
                  <option value="Bisexual">Bisexual</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className={styles.label}>
                Age
                {/* allow typing; block below 18 on submit */}
                <input
                  type="number"
                  name="age"
                  min="18"
                  max="100"
                  value={formData.age}
                  onChange={handleChange}
                  className={styles.input}
                  required
                />
              </label>

              <label className={styles.label}>
                Nationality
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>

              <label className={styles.label}>
                County
                <select
                  name="county"
                  value={formData.county}
                  onChange={handleCountyChange}
                  className={styles.select}
                >
                  <option value="">Select County</option>
                  {counties.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.label}>
                Location Search
                <div className={styles.locationInput}>
                  <input
                    type="text"
                    placeholder="Search County, City/Town or Area..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className={styles.input}
                  />
                </div>
                {filteredOptions.length > 0 && (
                  <div className={styles.dropdown}>
                    {filteredOptions.map((option, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectOption(option)}
                        className={styles.dropdownItem}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </label>

              <label className={styles.label}>
                City/Town
                <select
                  name="ward"
                  value={selectedWard}
                  onChange={handleWardChange}
                  className={styles.select}
                  disabled={!formData.county}
                >
                  <option value="">Select City/Town</option>
                  {wards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.label}>
                Area
                <select
                  name="area"
                  value={formData.area}
                  onChange={handleAreaChange}
                  className={styles.select}
                  disabled={!selectedWard}
                >
                  <option value="">Select Area</option>
                  {areas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.label}>
                Nearby Places
                <div className={styles.checkboxGroup}>
                  {areas.map((place) => (
                    <div key={place}>
                      <input
                        type="checkbox"
                        value={place}
                        checked={(formData.nearby || []).includes(place)}
                        onChange={handleChange}
                        name="nearby"
                      />
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
                      <input
                        type="checkbox"
                        value={service}
                        checked={(formData.services || []).includes(service)}
                        onChange={handleChange}
                        name="services"
                      />
                      <span>{service}</span>
                    </div>
                  ))}
                </div>
              </label>

              {formData.services?.includes('Other Services') && (
                <label className={styles.label}>
                  Add other services
                  <input
                    type="text"
                    name="otherServices"
                    value={formData.otherServices}
                    onChange={handleChange}
                    className={styles.input}
                  />
                </label>
              )}

              <button type="submit" className={styles.button}>
                Save Profile
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}