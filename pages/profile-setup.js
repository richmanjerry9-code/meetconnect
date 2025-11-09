import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Image from 'next/image';
import * as locations from '../data/locations';
import styles from '../styles/ProfileSetup.module.css';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, getDoc, addDoc, collection, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

const servicesList = [
  'Dinner Date',
  'Just Vibes',
  'Relationship',
  'Night Out',
  'Friendship',
  'Companionship / Meetup'
];

// Lazy-load modals to reduce initial bundle size
const UpgradeModal = dynamic(() => import('../components/UpgradeModal'), { ssr: false });
const PaymentChoiceModal = dynamic(() => import('../components/PaymentChoiceModal'), { ssr: false });
const ProcessingModal = dynamic(() => import('../components/ProcessingModal'), { ssr: false });
const AddFundModal = dynamic(() => import('../components/AddFundModal'), { ssr: false });

// Note: You'll need to create these separate components based on the inline modal JSX.
// For now, assuming they exist; extract the modal divs into these components with props.

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
    profilePic: '', // Now stores URL only, not base64
  });
  const [selectedWard, setSelectedWard] = useState('');
  const [membership, setMembership] = useState('Regular');
  const [walletBalance, setWalletBalance] = useState(0);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [addFundAmount, setAddFundAmount] = useState('');
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet');
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [checkoutRequestID, setCheckoutRequestID] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [unsubscribeProfile, setUnsubscribeProfile] = useState(null); // For real-time listener

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
          const updatedFormData = {
            ...formData,
            ...data,
            username: user.username,
            services: data.services || [],
            nearby: data.nearby || [],
            age: data.age || formData.age,
            profilePic: data.profilePic || '', // URL only
          };
          setFormData(updatedFormData);
          setSelectedWard(data.ward || '');
          setWalletBalance(data.walletBalance || 0);
          setMembership(data.membership || 'Regular');
          setMpesaPhone(data.phone || '');
        } else {
          setFormData((prev) => ({ ...prev, username: user.username }));
          setWalletBalance(0);
          setMembership('Regular');
        }
      } catch (err) {
        setError('Failed to load profile. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Set up real-time listener for profile changes (e.g., membership updates)
    const profileRef = doc(db, 'profiles', user.id);
    const unsub = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMembership(data.membership || 'Regular');
        setWalletBalance(data.walletBalance || 0);
        // Update other relevant fields if needed
      }
    });
    setUnsubscribeProfile(() => unsub);

    return () => unsub();
  }, [router]);

  useEffect(() => {
    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [unsubscribeProfile]);

  // Helper functions (unchanged)
  const formatPhoneForMpesa = useCallback((phone) => {
    if (!phone) return '';
    let formatted = phone.replace(/[\s+]/g, '');
    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.slice(1);
    } else if (formatted.startsWith('254') || formatted.startsWith('7') || formatted.startsWith('1')) {
      if (formatted.length === 9 && (formatted.startsWith('7') || formatted.startsWith('1'))) {
        formatted = '254' + formatted;
      }
    }
    if (formatted.length !== 12 || !formatted.match(/^254[0-9]\d{8}$/)) {
      throw new Error('Invalid phone number. Use format like 254 followed by 9 digits.');
    }
    return formatted;
  }, []);

  const shortenUserId = useCallback((userId) => userId ? userId.slice(-10) : '', []);

  const handleChange = useCallback((e) => {
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
      if (name === 'county') {
        setFormData((prev) => ({
          ...prev,
          county: value,
          ward: '',
          area: '',
          nearby: [],
        }));
        setSelectedWard('');
      } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
      if (error) setError('');
    }
  }, [error]);

  const handleWardChange = useCallback((e) => {
    const ward = e.target.value;
    setSelectedWard(ward);
    setFormData((prev) => ({ ...prev, ward, area: '', nearby: [] }));
    if (error) setError('');
  }, [error]);

  const handleAreaChange = useCallback((e) => {
    setFormData((prev) => ({ ...prev, area: e.target.value }));
    if (error) setError('');
  }, [error]);

  // Optimized image upload: Resize, compress, upload immediately on select, store URL
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Resize and compress image using canvas
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      img.onload = async () => {
        // Resize to max 500x500, maintain aspect ratio
        const maxSize = 500;
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG at 80% quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Upload to Cloudinary as FormData (more efficient than base64 JSON)
        const formDataUpload = new FormData();
        formDataUpload.append('file', dataURLtoBlob(compressedDataUrl), file.name);
        formDataUpload.append('upload_preset', 'your_preset'); // Add your Cloudinary preset if needed

        const res = await fetch('/api/uploadProfilePic', {
          method: 'POST',
          body: formDataUpload,
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setError(data.error || 'Failed to upload image to Cloudinary');
          return;
        }

        const profilePicUrl = data.url;

        // Moderate the image
        const modRes = await fetch('/api/moderateImage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: profilePicUrl }),
        });
        const modData = await modRes.json();
        if (!modRes.ok || !modData.isSafe) {
          setError(modData.error || 'Image contains inappropriate content. Please upload a different photo.');
          return;
        }

        // Store URL in state
        setFormData((prev) => ({ ...prev, profilePic: profilePicUrl }));
      };
      img.src = URL.createObjectURL(file);
    } catch (err) {
      setError('Failed to process image. Please try again.');
    }
  };

  // Helper to convert dataURL to Blob
  const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Submit handler (simplified, no base64 handling)
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
    setError('');

    try {
      const fullData = { 
        ...loggedInUser, 
        ...formData, 
        walletBalance 
      };
      await setDoc(doc(db, 'profiles', loggedInUser.id), fullData, { merge: true });
      localStorage.setItem('profileSaved', 'true');
      alert('Profile updated successfully');
      router.push('/');
    } catch (saveError) {
      setError('Failed to save profile');
    } finally {
      setSaveLoading(false);
    }
  };

  // Upgrade handlers (unchanged, but plans memoized)
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

  const plans = useMemo(() => ({
    Prime: { '3 Days': 100, '7 Days': 250, '15 Days': 400, '30 Days': 1000 },
    VIP: { '3 Days': 200, '7 Days': 500, '15 Days': 800, '30 Days': 2000 },
    VVIP: { '3 Days': 300, '7 Days': 700, '15 Days': 1200, '30 Days': 3000 },
  }), []);

  const handleProceedToPayment = () => {
    if (!selectedDuration) {
      alert('Please select a duration.');
      return;
    }
    const price = plans[selectedLevel][selectedDuration];
    if (walletBalance >= price) {
      setSelectedPaymentMethod('wallet');
    } else {
      setSelectedPaymentMethod('mpesa');
    }
    setShowPaymentChoice(true);
    setShowModal(false);
  };

  const handlePaymentMethodChange = (method) => {
    setSelectedPaymentMethod(method);
  };

  const handleConfirmWalletUpgrade = async () => {
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
      setMembership(selectedLevel); // Real-time will update too
      setShowPaymentChoice(false);
      setSelectedDuration('');
      alert('Upgrade successful!');
    }
  };

  const handleConfirmMpesaUpgrade = async () => {
    try {
      const formattedPhone = formatPhoneForMpesa(mpesaPhone || formData.phone);
      const price = plans[selectedLevel][selectedDuration];
      const shortUserId = shortenUserId(loggedInUser.id);
      const shortLevel = selectedLevel.slice(0, 3);
      const accountRef = `upg_${shortUserId}_${shortLevel}`;

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
          checkoutRequestID,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setCheckoutRequestID(data.CheckoutRequestID);
        setShowProcessingModal(true);
        setShowPaymentChoice(false);
        setShowModal(false);
        setSelectedDuration('');
        // No polling needed; real-time listener will detect membership change
      } else {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error, null, 2) : errorData.error;
        alert(`Error: ${errorMsg}`);
      }
    } catch (error) {
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
      formatPhoneForMpesa(formData.phone);
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
      const accountRef = `wal_${shortUserId}`;
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
        // Real-time will update wallet balance
      } else {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error, null, 2) : errorData.error;
        alert(`Error: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = typeof error === 'object' ? JSON.stringify(error, null, 2) : error.message || 'Failed to initiate payment. Please check your phone number.';
      alert(`Error: ${errorMsg}`);
      setError(errorMsg);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('loggedInUser');
    setLoggedInUser(null);
    await signOut(auth);
    router.push('/');
  };

  if (loading) {
    return <div className={styles.container}>Loading profile...</div>;
  }

  const countyList = useMemo(() => Object.keys(locations).sort(), []);
  const wards = useMemo(() => formData.county && locations[formData.county] ? Object.keys(locations[formData.county]) : [], [formData.county]);
  const areas = useMemo(() => selectedWard && locations[formData.county] ? locations[formData.county][selectedWard] : [], [formData.county, selectedWard]);

  // Filtered areas for nearby: Add search state for filtering (to avoid rendering 100s of checkboxes)
  const [areaSearch, setAreaSearch] = useState('');
  const filteredAreas = useMemo(() => 
    areas.filter(place => place.toLowerCase().includes(areaSearch.toLowerCase())), 
    [areas, areaSearch]
  );

  return (
    <div className={styles.container}>
      <Head>
        <title>Meet Connect Ladies - Profile Setup</title>
        <meta name="description" content="Set up your profile on Meet Connect Ladies for gentlemen." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <h1 onClick={() => router.push('/')} className={styles.title}>
            Meet Connect Ladies 
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
              <p className={styles.walletBalance}>KSh {walletBalance}</p>
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

            {/* Lazy-loaded modals */}
            {showModal && (
              <UpgradeModal
                level={selectedLevel}
                plans={plans}
                selectedDuration={selectedDuration}
                onDurationSelect={handleDurationSelect}
                onProceed={handleProceedToPayment}
                onClose={() => setShowModal(false)}
              />
            )}
            {showPaymentChoice && (
              <PaymentChoiceModal
                level={selectedLevel}
                duration={selectedDuration}
                plans={plans}
                walletBalance={walletBalance}
                selectedMethod={selectedPaymentMethod}
                mpesaPhone={mpesaPhone}
                onMethodChange={handlePaymentMethodChange}
                onMpesaChange={(e) => setMpesaPhone(e.target.value)}
                onConfirm={selectedPaymentMethod === 'wallet' ? handleConfirmWalletUpgrade : handleConfirmMpesaUpgrade}
                onBack={() => {
                  setShowPaymentChoice(false);
                  setShowModal(true);
                }}
              />
            )}
            {showProcessingModal && (
              <ProcessingModal
                checkoutRequestID={checkoutRequestID}
                onClose={() => setShowProcessingModal(false)}
              />
            )}
            {showAddFundModal && (
              <AddFundModal
                phone={formData.phone}
                amount={addFundAmount}
                onAmountChange={(e) => setAddFundAmount(e.target.value)}
                onConfirm={handleConfirmAddFund}
                onClose={() => setShowAddFundModal(false)}
              />
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
                    priority={false} // Not priority to avoid blocking
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

            {error && <p className={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} className={styles.profileForm}>
              {/* Basic Info Section */}
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

              {/* Location Section */}
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
                  {areas.slice(0, 50).map((area) => ( // Limit to 50 to prevent huge dropdown
                    <option key={area} value={area}>{area}</option>
                  ))}
                  {areas.length > 50 && <option disabled>More areas available - contact support</option>}
                </select>
              </label>

              {/* Nearby Places: Filtered search to avoid DOM bloat */}
              <label className={styles.label}>
                Nearby Places (max 4)
                <input
                  type="text"
                  placeholder="Search areas..."
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  className={styles.input}
                />
                <div className={styles.checkboxGroup} style={{ maxHeight: '200px', overflowY: 'auto' }}> {/* Scrollable */}
                  {filteredAreas.slice(0, 20).map((place) => ( // Limit to 20 visible
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
                  {filteredAreas.length > 20 && <p>Showing top 20 matches. Refine search.</p>}
                </div>
              </label>

              {/* Services Section */}
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

              <button type="submit" className={styles.button} disabled={saveLoading}>
                {saveLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}


