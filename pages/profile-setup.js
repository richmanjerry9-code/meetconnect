// pages/profile-setup.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { Nairobi } from '../data/locations';
import styles from '../styles/ProfileSetup.module.css';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const servicesList = [
  'Dinner Date',
  'Travel Companion',
  'Lesbian Show',
  'Rimming',
  'Raw BJ',
  'BJ',
  'GFE',
  'COB – Cum On Body',
  'CIM – Cum In Mouth',
  '3 Some',
  'Anal',
  'Massage',
  'Other Services',
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
    county: 'Nairobi',
    ward: '',
    area: '',
    nearby: [],
    services: [], // ensure array so .includes won't crash
    otherServices: '',
    incallsRate: '',
    outcallsRate: '',
    profilePic: '',
  });
  const [selectedWard, setSelectedWard] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [membership, setMembership] = useState('Regular');
  const [error, setError] = useState('');

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
          setFormData({
            ...formData,
            ...data,
            username: user.username,
            services: data.services || [],
            nearby: data.nearby || [],
            age: data.age || formData.age,
          });
          setSelectedWard(data.ward || '');
        } else {
          setFormData((prev) => ({ ...prev, username: user.username }));
        }
      } catch (err) {
        console.error('Fetch profile error:', err);
      }
    };
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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
      ...Object.keys(Nairobi),
      ...Object.values(Nairobi).flat(),
    ].filter((item, index, self) => self.indexOf(item) === index);

    const filtered = allOptions
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 5);
    setFilteredOptions(filtered);
  };

  const handleSelectOption = (option) => {
    const isWard = Object.keys(Nairobi).includes(option);
    if (isWard) {
      setSelectedWard(option);
      setFormData((prev) => ({ ...prev, ward: option, area: '', nearby: [] }));
    } else {
      const wardKey = Object.keys(Nairobi).find((w) => Nairobi[w].includes(option));
      if (wardKey) {
        setSelectedWard(wardKey);
        setFormData((prev) => ({ ...prev, ward: wardKey, area: option }));
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

    // Require at least 4 selected services
    if (!formData.services || formData.services.length < 4) {
      setError('Please select at least 4 services.');
      return;
    }

    // Limit nearby places to a maximum of 4
    if (formData.nearby && formData.nearby.length > 4) {
      setError('You can select up to 4 nearby locations only.');
      return;
    }

    if (!formData.name || !formData.phone || !formData.age || !formData.area || !formData.ward) {
      setError('Please fill all required fields, including location');
      return;
    }
    setError('');
    try {
      const fullData = { ...loggedInUser, ...formData };
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
    const plans = {
      Prime: { '1 Month': 1000, '3 Days': 100 },
      VIP: { '1 Month': 2000, '3 Days': 200 },
      VVIP: { '1 Month': 3000, '3 Days': 300 },
    };
    const selectedPlan = prompt(
      `Select payment plan for ${level}:\n${Object.entries(plans[level])
        .map(([duration, price]) => `${duration}: KSh ${price}`)
        .join('\n')}\nEnter duration (e.g., '1 Month' or '3 Days')`
    );
    if (selectedPlan && plans[level][selectedPlan]) {
      const price = plans[level][selectedPlan];
      if (confirm(`Upgrading to ${level} for ${selectedPlan} at KSh ${price}. Proceed?`)) {
        alert('Payment simulation - implement real payment here');
        setDoc(doc(db, 'profiles', loggedInUser.id), { membership: level }, { merge: true });
        setMembership(level);
      }
    } else {
      alert('Invalid selection or canceled');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setLoggedInUser(null);
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

  const wards = Nairobi ? Object.keys(Nairobi) : [];
  const areas = selectedWard && Nairobi ? Nairobi[selectedWard] : [];

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
                Phone Number
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={styles.input}
                  required
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
                  min="0"
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
                <input
                  type="text"
                  name="county"
                  value={formData.county}
                  onChange={handleChange}
                  className={styles.input}
                  disabled
                />
              </label>

              <label className={styles.label}>
                Location Search
                <div className={styles.locationInput}>
                  <input
                    type="text"
                    placeholder="Search City/Town or Area..."
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
                >
                  <option value="">Select City/Town</option>
                  {Object.keys(Nairobi).map((ward) => (
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
                  {selectedWard &&
                    Nairobi[selectedWard].map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                </select>
              </label>

              <label className={styles.label}>
                Nearby Places
                <div className={styles.checkboxGroup}>
                  {selectedWard &&
                    Nairobi[selectedWard].map((place) => (
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

              <label className={styles.label}>
                Incalls Rate From (KSh/hr)
                <input
                  type="number"
                  name="incallsRate"
                  value={formData.incallsRate}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>

              <label className={styles.label}>
                Outcalls Rate From (KSh/hr)
                <input
                  type="number"
                  name="outcallsRate"
                  value={formData.outcallsRate}
                  onChange={handleChange}
                  className={styles.input}
                />
              </label>

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

