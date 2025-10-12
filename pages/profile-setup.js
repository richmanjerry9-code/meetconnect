import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { Nairobi } from '../data/locations';
import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export default function ProfileSetup() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [searchLocation, setSearchLocation] = useState('');
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [form, setForm] = useState({
    username: '',
    name: '',
    phone: '',
    gender: '',
    orientation: '',
    age: '',
    nationality: '',
    county: 'Nairobi',
    town: 'Nairobi',
    ward: '',
    area: '',
    nearby: [],
    services: [],
    otherServices: '',
    incallRate: '',
    outcallRate: '',
    listOtherCities: false,
  });

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

  useEffect(() => {
    const logged = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    if (!logged) {
      router.push('/');
      return;
    }
    setUser(logged);
  }, [router]);

  useEffect(() => {
    if (!searchLocation || !Nairobi) return setFilteredLocations([]);
    const matches = [];
    Object.keys(Nairobi).forEach((ward) => {
      Nairobi[ward].forEach((area) => {
        if (
          area.toLowerCase().includes(searchLocation.toLowerCase()) ||
          ward.toLowerCase().includes(searchLocation.toLowerCase())
        ) {
          matches.push({ ward, area });
        }
      });
    });
    setFilteredLocations(matches.slice(0, 5));
  }, [searchLocation]);

  const handleLocationSelect = (ward, area) => {
    setForm({ ...form, ward, area });
    setSearchLocation(`${ward}, ${area}`);
    setFilteredLocations([]);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'services') {
      let updated = [...form.services];
      if (checked) updated.push(value);
      else updated = updated.filter((s) => s !== value);
      setForm({ ...form, services: updated });
    } else if (type === 'checkbox' && name === 'listOtherCities') {
      setForm({ ...form, listOtherCities: checked });
    } else if (name === 'age') {
      const ageValue = parseInt(value, 10);
      if (ageValue < 18) return; // block typing below 18
      setForm({ ...form, [name]: value });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleProfilePic = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setProfilePic(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleNearbyChange = (e) => {
    const value = e.target.value;
    const nearby = form.nearby.includes(value)
      ? form.nearby.filter((n) => n !== value)
      : [...form.nearby, value].slice(0, 4);
    setForm({ ...form, nearby });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.username || !form.name || !form.phone || !form.gender || !form.orientation || !form.age || !form.nationality || !form.ward || !form.area || !profilePic) {
      alert('Please fill in all fields and add a profile picture!');
      return;
    }

    if (parseInt(form.age) < 18) {
      alert('You must be 18 or older to register!');
      return;
    }

    try {
      const querySnapshot = await getDocs(collection(db, 'profiles'));
      const profiles = querySnapshot.docs.map((doc) => doc.data());
      const duplicate = profiles.find(
        (p) => p.username === form.username && p.email !== user.email
      );
      if (duplicate) {
        alert('Username already taken! Choose another.');
        return;
      }

      const newProfile = {
        ...form,
        profilePic,
        email: user.email,
        createdAt: Date.now(),
        membership: user.membership || 'Regular',
      };

      await addDoc(collection(db, 'profiles'), newProfile);
      alert('Profile saved!');
      router.push('/');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Try again.');
    }
  };

  const areasForWard = form.ward && Nairobi ? Nairobi[form.ward] || [] : [];

  return (
    <div style={{ minHeight: '100vh', padding: 20 }}>
      <h1 style={{ color: '#e91e63' }}>Profile Setup</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 500, margin: '20px auto', textAlign: 'center' }}>
        <label style={{ display: 'block', marginBottom: 15, cursor: 'pointer' }}>
          <div
            style={{
              width: 120,
              height: 120,
              margin: '0 auto',
              background: '#ffe6ee',
              border: '2px dashed #e91e63',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            {profilePic ? (
              <Image
                src={profilePic}
                alt='Profile'
                width={120}
                height={120}
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <span style={{ color: '#e91e63' }}>Click to add</span>
            )}
          </div>
          <input type='file' accept='image/*' onChange={handleProfilePic} style={{ display: 'none' }} />
        </label>

        <input name='username' placeholder='Username (unique)' value={form.username} onChange={handleChange} required style={inputStyle} />
        <input name='name' placeholder='Name' value={form.name} onChange={handleChange} required style={inputStyle} />
        <input name='phone' placeholder='Phone' value={form.phone} onChange={handleChange} required style={inputStyle} />

        <select name='gender' value={form.gender} onChange={handleChange} required style={inputStyle}>
          <option value=''>Select Gender</option>
          <option value='Male'>Male</option>
          <option value='Female'>Female</option>
        </select>

        <select name='orientation' value={form.orientation} onChange={handleChange} required style={inputStyle}>
          <option value=''>Sexual Orientation</option>
          <option value='Straight'>Straight</option>
          <option value='Lesbian'>Lesbian</option>
          <option value='Gay'>Gay</option>
          <option value='Bisexual'>Bisexual</option>
        </select>

        <input
          name='age'
          type='number'
          placeholder='Age (18+)'
          min='18'
          value={form.age}
          onChange={handleChange}
          required
          style={inputStyle}
        />

        <input name='nationality' placeholder='Nationality' value={form.nationality} onChange={handleChange} required style={inputStyle} />

        {/* Smart Search Location */}
        <input
          type='text'
          placeholder='Search Ward or Area (e.g., Westlands, Kilimani)'
          value={searchLocation}
          onChange={(e) => setSearchLocation(e.target.value)}
          style={inputStyle}
        />
        {filteredLocations.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e91e63', borderRadius: 10, marginTop: 5 }}>
            {filteredLocations.map((loc, idx) => (
              <div
                key={idx}
                onClick={() => handleLocationSelect(loc.ward, loc.area)}
                style={{
                  padding: 10,
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                {loc.ward}, {loc.area}
              </div>
            ))}
          </div>
        )}

        {form.ward && form.area && (
          <p style={{ color: '#e91e63' }}>
            Selected: {form.ward}, {form.area}
          </p>
        )}

        {form.area && (
          <div style={{ textAlign: 'left', margin: '10px 0' }}>
            <label>Nearby Places (max 4)</label>
            {areasForWard.map((place) => (
              <div key={place}>
                <input
                  type='checkbox'
                  value={place}
                  checked={form.nearby?.includes(place)}
                  onChange={handleNearbyChange}
                />
                <span style={{ marginLeft: 5 }}>{place}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'left', margin: '10px 0' }}>
          <label>Services Offered</label>
          {servicesList.map((s) => (
            <div key={s}>
              <input
                type='checkbox'
                name='services'
                value={s}
                checked={form.services?.includes(s)}
                onChange={handleChange}
              />
              <span style={{ marginLeft: 5 }}>{s}</span>
            </div>
          ))}
          {form.services?.includes('Other Services') && (
            <input
              name='otherServices'
              placeholder='Add other services'
              value={form.otherServices}
              onChange={handleChange}
              style={inputStyle}
            />
          )}
        </div>

        <input
          name='incallRate'
          type='number'
          placeholder='Incalls Rate (KSh/hr)'
          value={form.incallRate}
          onChange={handleChange}
          style={inputStyle}
        />

        <input
          name='outcallRate'
          type='number'
          placeholder='Outcalls Rate (KSh/hr)'
          value={form.outcallRate}
          onChange={handleChange}
          style={inputStyle}
        />

        <div style={{ margin: '10px 0', textAlign: 'left' }}>
          <input
            type='checkbox'
            name='listOtherCities'
            checked={form.listOtherCities}
            onChange={handleChange}
          />
          <span style={{ marginLeft: 5 }}>List me in other cities</span>
        </div>

        <button type='submit' style={btnSubmitStyle}>
          Save Profile
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: 10,
  margin: '10px 0',
  borderRadius: 10,
  border: '1px solid #e91e63',
};

const btnSubmitStyle = {
  backgroundColor: '#e91e63',
  color: 'white',
  padding: '10px 25px',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  width: '100%',
};
