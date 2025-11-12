import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import * as locations from '../data/locations';
import styles from '../styles/ProfileSetup.module.css';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
    services: [], // ensure array so .includes won't crash
    otherServices: '',
    profilePic: '',
  });
  const [selectedWard, setSelectedWard] = useState('');
  const [membership, setMembership] = useState('Regular');
  const [walletBalance, setWalletBalance] = useState(0);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  // New states for Add Fund modal
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  // New states for Upgrade Payment Choice
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet'); // 'wallet' or 'mpesa'
  const [mpesaPhone, setMpesaPhone] = useState(''); // For M-Pesa prompt phone
  const [loading, setLoading] = useState(true); // ✅ New loading state for profile fetch
  const [saveLoading, setSaveLoading] = useState(false); // ✅ New for submit

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
          let loadedPhone = data.phone || '';
          // Clean phone to digits only on load
          loadedPhone = loadedPhone.replace(/[^\d]/g, '');
          setFormData((prev) => ({
            ...prev,
            ...data,
            username: user.username,
            phone: loadedPhone,
            services: data.services || [],
            nearby: data.nearby || [],
            age: data.age || prev.age,
          }));
          setSelectedWard(data.ward || '');
          setWalletBalance(data.walletBalance || 0);
          setMembership(data.membership || 'Regular');
          setMpesaPhone(loadedPhone); // Raw cleaned phone for M-Pesa
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
  }, [router]);

  // ✅ Helper to format phone for M-Pesa (2547XXXXXXXX) - validates strictly
  const formatPhoneForMpesa = (phone) => {
    if (!phone) throw new Error('Phone number is required');
    let formatted = phone.replace(/[^\d]/g, ''); // Clean to digits only
    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.slice(1);
    } else if (formatted.startsWith('254')) {
      // Already good
    } else if (formatted.length === 9 && formatted.startsWith('7')) {
      formatted = '254' + formatted;
    } else {
      throw new Error('Invalid phone number format. Use 07XXXXXXXX');
    }
    // Strict validation for Kenyan mobile (Safaricom M-Pesa)
    if (formatted.length !== 12 || !formatted.startsWith('2547')) {
      throw new Error('Invalid M-Pesa phone number. Must be a valid Kenyan mobile number starting with 07.');
    }
    return formatted;
  };

  // ✅ Helper to shorten userId to last 10 chars for ref
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
      let inputValue = value;
      if (name === 'phone') {
        // Clean phone input to digits only
        inputValue = value.replace(/[^\d]/g, '');
        // Update mpesaPhone if it's the phone field
        setMpesaPhone(inputValue);
        // Clear error if typing a valid partial number
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
      // clear error on user interaction
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);

    // Age validation: allow typing but block below 18
    const numericAge = parseInt(formData.age, 10);
    if (isNaN(numericAge) || numericAge < 18) {
      setError('You must be 18 or older to register.');
      setSaveLoading(false);
      return;
    }

    // Require at least 1 selected service (changed from 4 since new list is shorter)
    if (!formData.services || formData.services.length < 1) {
      setError('Please select at least 1 service.');
      setSaveLoading(false);
      return;
    }

    // Limit nearby places to a maximum of 4
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

    // ✅ Validate phone format before saving
    try {
      formatPhoneForMpesa(formData.phone);
    } catch (err) {
      setError(err.message);
      setSaveLoading(false);
      return;
    }

    setError('');

    let profilePicUrl = formData.profilePic;

    if (profilePicUrl && profilePicUrl.startsWith('data:image')) {
      try {
        // Upload to Cloudinary
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

        // Moderate the image
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
      } catch (uploadError) {
        setError('Failed to process image. Please try again.');
        setSaveLoading(false);
        return;
      }
    }

    try {
      const fullData = { 
        ...loggedInUser, 
        ...formData, 
        profilePic: profilePicUrl, 
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

    // ✅ Validate phone before proceeding to payment
    if (!formData.phone) {
      alert('Please add your phone number to your profile first.');
      return;
    }
    try {
      const formatted = formatPhoneForMpesa(formData.phone);
      setMpesaPhone(formatted);
    } catch (error) {
      alert(error.message);
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

  const handleAddFund = () => {
    if (!formData.phone) {
      setError('Please add your phone number to your profile first.');
      return;
    }
    try {
      const formatted = formatPhoneForMpesa(formData.phone);
      setMpesaPhone(formatted);
      setShowAddFundModal(true);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('loggedInUser');
    setLoggedInUser(null);
    await signOut(auth);
    router.push('/');
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

  const countyList = useMemo(() => Object.keys(locations).sort(), []);
  const wards = useMemo(() => formData.county && locations[formData.county] ? Object.keys(locations[formData.county]) : [], [formData.county]);
  const areas = useMemo(() => selectedWard && locations[formData.county] ? locations[formData.county][selectedWard] : [], [formData.county, selectedWard]);

  const plans = useMemo(() => ({
    Prime: { '3 Days': 100, '7 Days': 250, '15 Days': 400, '30 Days': 1000 },
    VIP: { '3 Days': 200, '7 Days': 500, '15 Days': 800, '30 Days': 2000 },
    VVIP: { '3 Days': 300, '7 Days': 700, '15 Days': 1200, '30 Days': 3000 },
  }), []);

  if (loading) {
    return <div className={styles.container}>Loading profile...</div>;
  }

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
                    <StkPushForm
                      initialPhone={mpesaPhone}
                      initialAmount={plans[selectedLevel][selectedDuration]}
                      readOnlyAmount={true}
                      apiEndpoint="/api/upgrade"
                      additionalBody={{
                        userId: loggedInUser.id,
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
                        disabled={walletBalance < plans[selectedLevel][selectedDuration]}
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
                  <h3>Add Funds to Wallet</h3>
                  <p>Phone: {formData.phone} (will be formatted for M-Pesa)</p>
                  <StkPushForm
                    initialPhone={mpesaPhone}
                    apiEndpoint="/api/addFunds"
                    additionalBody={{
                      userId: loggedInUser.id,
                      accountReference: `wal_${shortenUserId(loggedInUser.id)}`,
                      transactionDesc: 'Add funds to wallet'
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
                Phone Number <small>(e.g., 0712345678)</small>
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
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="">Select County</option>
                  {countyList.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
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