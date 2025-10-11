import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Nairobi } from '../data/locations';
import { db } from '../firebase'; // Import Firebase database
import {
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  getDocs,
  doc,
  query,
  where,
} from 'firebase/firestore'; // Import Firestore functions

const ADMIN_PASSWORD = '447962Pa$$word';

const parseCSV = (text) => {
  const lines = text.split('\n').filter(Boolean);
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i] || (h === 'membership' ? 'Regular' : '')));
    if (!obj.membership) obj.membership = 'Regular';
    return obj;
  });
};

export default function AdminPanel() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [users, setUsers] = useState([]);
  const [refresh, setRefresh] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [currentViewers, setCurrentViewers] = useState(0);
  const [allVisits, setAllVisits] = useState([]);

  const [form, setForm] = useState({
    username: '',
    email: '',
    phone: '',
    role: 'User',
    membership: 'Regular',
    name: '',
    gender: '',
    age: '',
    nationality: '',
    county: '',
    ward: '',
    area: '',
    nearby: [],
    services: [],
    otherServices: '',
    incallRate: '',
    outcallRate: '',
    profilePic: null,
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
    // Fetch profiles from Firestore
    const fetchUsers = async () => {
      const q = query(collection(db, 'profiles'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    };
    fetchUsers();

    // Keep visits and viewers logic (still using localStorage for now)
    const storedVisits = JSON.parse(localStorage.getItem('visits') || '[]');
    const newVisit = { timestamp: new Date().toISOString() };
    const updatedVisits = [...storedVisits, newVisit];
    localStorage.setItem('visits', JSON.stringify(updatedVisits));
    setAllVisits(updatedVisits);
    setCurrentViewers((prev) => prev + 1);
    const handleUnload = () => setCurrentViewers((prev) => Math.max(prev - 1, 0));
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [refresh]);

  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setLoggedIn(true);
      setPasswordInput('');
    } else {
      alert('Wrong password!');
    }
  };

  const handleLogout = () => setLoggedIn(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'services') {
      const updated = checked
        ? [...form.services, value]
        : form.services.filter((s) => s !== value);
      setForm({ ...form, services: updated });
    } else if (type === 'checkbox' && name === 'nearby') {
      const updated = checked
        ? [...form.nearby, value]
        : form.nearby.filter((n) => n !== value);
      setForm({ ...form, nearby: updated.slice(0, 4) });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleProfilePic = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, profilePic: reader.result });
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.username) {
      alert('Username is required!');
      return;
    }
    // Check for duplicate username in Firestore
    const q = query(collection(db, 'profiles'), where('username', '==', form.username));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      alert('Username already exists!');
      return;
    }
    const profileData = { ...form };
    if (profileData.profilePic && typeof profilePic !== 'string') {
      profileData.profilePic = profileData.profilePic.toString(); // Ensure it's a string for Firestore
    }
    try {
      await addDoc(collection(db, 'profiles'), profileData);
      alert('✅ Profile saved successfully!');
      setUsers((prev) => [...prev, profileData]);
      setForm({
        username: '',
        email: '',
        phone: '',
        role: 'User',
        membership: 'Regular',
        name: '',
        gender: '',
        age: '',
        nationality: '',
        county: '',
        ward: '',
        area: '',
        nearby: [],
        services: [],
        otherServices: '',
        incallRate: '',
        outcallRate: '',
        profilePic: null,
      });
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile.');
    }
  };

  const handleDelete = async (username) => {
    const q = query(collection(db, 'profiles'), where('username', '==', username));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (docSnap) => {
      const user = docSnap.data();
      if (user.role === 'Admin') {
        alert('Cannot delete admin!');
        return;
      }
      if (!confirm('Delete this profile?')) return;
      try {
        await deleteDoc(doc(db, 'profiles', docSnap.id));
        setUsers((prev) => prev.filter((u) => u.username !== username));
        setRefresh(!refresh);
      } catch (error) {
        console.error('Error deleting profile:', error);
        alert('Failed to delete profile.');
      }
    });
  };

  const handleUpload = async () => {
    if (!uploadFile) return alert('No file selected!');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = parseCSV(e.target.result);
      const existingQ = query(collection(db, 'profiles'));
      const existingSnapshot = await getDocs(existingQ);
      const existingUsernames = new Set(existingSnapshot.docs.map((doc) => doc.data().username));
      const newProfiles = data.filter((profile) => !existingUsernames.has(profile.username));
      const savePromises = newProfiles.map((profile) =>
        addDoc(collection(db, 'profiles'), profile)
      );
      try {
        await Promise.all(savePromises);
        const updatedUsers = [...users, ...newProfiles];
        setUsers(updatedUsers);
        setUploadFile(null);
        setRefresh(!refresh);
        alert('✅ Profiles uploaded successfully!');
      } catch (error) {
        console.error('Error uploading profiles:', error);
        alert('Failed to upload profiles.');
      }
    };
    reader.readAsText(uploadFile);
  };

  const wards = Nairobi ? Object.keys(Nairobi) : [];
  const areasForWard = form.ward && Nairobi ? Nairobi[form.ward] : [];

  if (!loggedIn) {
    return (
      <div style={{ padding: '10px', fontFamily: 'Arial', background: '#f0f0f0', textAlign: 'center' }}>
        <Head>
          <title>Admin Login</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <h1 style={{ marginTop: '0', color: '#e91e63', fontSize: '1.2rem' }}>Admin Login</h1>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          style={{ padding: '8px', margin: '5px 0', width: '100px', fontSize: '0.9rem' }}
        />
        <button
          onClick={handleLogin}
          style={{ padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', fontSize: '0.9rem' }}
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px', fontFamily: 'Arial', background: '#f0f0f0' }}>
      <Head>
        <title>Admin Panel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <h1 style={{ textAlign: 'center', marginBottom: '10px', color: '#e91e63', fontSize: '1.2rem' }}>Admin Panel</h1>
      <button
        onClick={handleLogout}
        style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', fontSize: '0.9rem', marginBottom: '10px' }}
      >
        Logout
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px', marginBottom: '10px' }}>
        <div style={{ background: '#fff', padding: '8px', fontSize: '0.9rem' }}>Total Profiles: {users.length}</div>
        <div style={{ background: '#fff', padding: '8px', fontSize: '0.9rem' }}>Users: {users.filter((u) => u.role === 'User').length}</div>
        <div style={{ background: '#fff', padding: '8px', fontSize: '0.9rem' }}>Admins: {users.filter((u) => u.role === 'Admin').length}</div>
        <div style={{ background: '#fff', padding: '8px', fontSize: '0.9rem' }}>Current Viewers: {currentViewers}</div>
        <div style={{ background: '#fff', padding: '8px', fontSize: '0.9rem' }}>All-Time Visits: {allVisits.length}</div>
      </div>
      <div style={{ background: '#fff', padding: '8px', marginBottom: '10px' }}>
        <h2 style={{ marginTop: '0', color: '#e91e63', fontSize: '1.2rem' }}>Create Profile</h2>
        <input
          name="username"
          placeholder="Username"
          value={form.username}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <input
          name="phone"
          placeholder="Phone"
          value={form.phone}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        >
          <option>User</option>
          <option>Admin</option>
        </select>
        <select
          name="membership"
          value={form.membership}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        >
          <option>Regular</option>
          <option>VIP</option>
          <option>VVIP</option>
        </select>
        <input
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        >
          <option value="">Select Gender</option>
          <option>Male</option>
          <option>Female</option>
        </select>
        <input
          name="age"
          type="number"
          placeholder="Age"
          value={form.age}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <input
          name="nationality"
          placeholder="Nationality"
          value={form.nationality}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <input
          name="county"
          placeholder="County"
          value={form.county}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <select
          name="ward"
          value={form.ward}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        >
          <option value="">Select Ward</option>
          {wards.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        {form.ward && (
          <select
            name="area"
            value={form.area}
            onChange={handleChange}
            style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
          >
            <option value="">Select Area</option>
            {areasForWard.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        )}
        {form.ward &&
          areasForWard.map((place) => (
            <div key={place} style={{ margin: '5px 0' }}>
              <input
                type="checkbox"
                name="nearby"
                value={place}
                checked={form.nearby.includes(place)}
                onChange={handleChange}
                style={{ marginRight: '5px' }}
              />
              <span style={{ fontSize: '0.9rem' }}>{place}</span>
            </div>
          ))}
        {servicesList.map((service) => (
          <div key={service} style={{ margin: '5px 0' }}>
            <input
              type="checkbox"
              name="services"
              value={service}
              checked={form.services.includes(service)}
              onChange={handleChange}
              style={{ marginRight: '5px' }}
            />
            <span style={{ fontSize: '0.9rem' }}>{service}</span>
          </div>
        ))}
        {form.services.includes('Other Services') && (
          <input
            name="otherServices"
            placeholder="Other Services"
            value={form.otherServices}
            onChange={handleChange}
            style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
          />
        )}
        <input
          name="incallRate"
          type="number"
          placeholder="Incall Rate"
          value={form.incallRate}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <input
          name="outcallRate"
          type="number"
          placeholder="Outcall Rate"
          value={form.outcallRate}
          onChange={handleChange}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <label style={{ display: 'block', margin: '5px 0' }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleProfilePic}
            style={{ display: 'none' }}
          />
          <div
            style={{
              width: '100px',
              height: '100px',
              border: '2px dashed #000',
              textAlign: 'center',
              lineHeight: '100px',
              fontSize: '0.9rem',
            }}
          >
            {form.profilePic ? (
              <Image src={form.profilePic} alt="Profile" width={100} height={100} />
            ) : (
              'Upload Pic'
            )}
          </div>
        </label>
        <button
          onClick={handleSave}
          style={{
            padding: '8px 16px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            fontSize: '0.9rem',
            marginTop: '5px',
          }}
        >
          Save
        </button>
      </div>
      <div style={{ background: '#fff', padding: '8px', marginBottom: '10px' }}>
        <h2 style={{ marginTop: '0', color: '#e91e63', fontSize: '1.2rem' }}>Bulk Upload</h2>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setUploadFile(e.target.files[0])}
          style={{ padding: '8px', margin: '5px 0', width: '100%', fontSize: '0.9rem' }}
        />
        <button
          onClick={handleUpload}
          style={{
            padding: '8px 16px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            fontSize: '0.9rem',
            marginTop: '5px',
          }}
        >
          Upload
        </button>
      </div>
      <div style={{ background: '#fff', padding: '8px' }}>
        <h2 style={{ marginTop: '0', color: '#e91e63', fontSize: '1.2rem' }}>All Users</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#ddd' }}>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>Username</th>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>Email</th>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>Phone</th>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>Role</th>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>Membership</th>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>Name</th>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>County</th>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>Ward</th>
                <th style={{ padding: '5px', border: '1px solid #ccc' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username || u.id}> {/* Use id if username is missing */}
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>{u.username}</td>
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>{u.email || 'N/A'}</td>
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>{u.phone}</td>
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>{u.role}</td>
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>{u.membership || 'Regular'}</td>
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>{u.name}</td>
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>{u.county}</td>
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>{u.ward}</td>
                  <td style={{ padding: '5px', border: '1px solid #ccc' }}>
                    <button
                      onClick={() => setForm(u)}
                      style={{
                        padding: '5px 10px',
                        background: '#2196F3',
                        color: 'white',
                        border: 'none',
                        fontSize: '0.9rem',
                        marginRight: '5px',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u.username || u.id)} // Use id as fallback
                      style={{
                        padding: '5px 10px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        fontSize: '0.9rem',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}