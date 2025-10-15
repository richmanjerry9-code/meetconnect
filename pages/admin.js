// admin.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Nairobi } from '../data/locations';
import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';

// Add servicesList definition
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

const ADMIN_PASSWORD = '447962Pa$$word';

export default function AdminPanel() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [users, setUsers] = useState([]);
  const [refresh, setRefresh] = useState(false);
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
    incallsRate: '',
    outcallsRate: '',
    profilePic: null,
  });
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deletedUsers, setDeletedUsers] = useState([]); // Track deleted users
  const [lastEdit, setLastEdit] = useState(null); // Track last edited profile
  const [globalMenuOpen, setGlobalMenuOpen] = useState(false); // For global 3-dot menu
  const [currentViewers, setCurrentViewers] = useState(0);
  const [allVisits, setAllVisits] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const q = query(collection(db, 'profiles'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setUsers(data);
    };
    fetchUsers();

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
        ? [...(form.services || []), value]
        : (form.services || []).filter((s) => s !== value);
      setForm({ ...form, services: updated });
    } else if (type === 'checkbox' && name === 'nearby') {
      const updated = checked
        ? [...(form.nearby || []), value]
        : (form.nearby || []).filter((n) => n !== value);
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

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'profiles', editId), form);
        alert('✅ Profile updated!');
        setUsers((prev) =>
          prev.map((u) => (u.id === editId ? { ...form, id: editId } : u))
        );
      } else {
        const q = query(collection(db, 'profiles'), where('username', '==', form.username));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          alert('Username already exists!');
          return;
        }

        const fakeEmail = form.email || `${form.username.toLowerCase()}@meetconnect.fake`;
        const fakePassword = Math.random().toString(36).slice(-8);

        const profileData = {
          ...form,
          email: fakeEmail,
          password: fakePassword,
          createdAt: Date.now(),
          sexualOrientation: '', // Added from profileSetup
          incallsRate: form.incallsRate, // Renamed to match profileSetup
          outcallsRate: form.outcallsRate, // Renamed to match profileSetup
          county: form.county || 'Nairobi', // Default to Nairobi if empty
          ward: form.ward || '',
          area: form.area || '',
          nearby: form.nearby || [],
          services: form.services || [],
          otherServices: form.otherServices || '',
          profilePic: form.profilePic || '',
        };

        const docRef = await addDoc(collection(db, 'profiles'), profileData);
        alert(`✅ Profile saved!\nFake Email: ${fakeEmail}\nPassword: ${fakePassword}`);
        setUsers((prev) => [...prev, { id: docRef.id, ...profileData }]);
      }

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
        incallsRate: '',
        outcallsRate: '',
        profilePic: null,
      });
      setIsEdit(false);
      setEditId(null);
      setShowPassword(false);
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile.');
    }
  };

  const handleDelete = async (userId) => {
    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) return alert('User not found.');
    if (userToDelete.role === 'Admin') return alert('Cannot delete admin account!');
    if (!confirm('Delete this profile?')) return;

    try {
      await deleteDoc(doc(db, 'profiles', userId));
      setDeletedUsers((prev) => [...prev, userToDelete]); // Store deleted user
      const q = query(collection(db, 'profiles'));
      const querySnapshot = await getDocs(q);
      const updatedUsers = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setUsers(updatedUsers);
      alert('✅ Profile deleted successfully!');
    } catch (error) {
      console.error('Error deleting profile:', error);
      alert('Failed to delete profile.');
    }
  };

  const handleUpdateMembership = async (userId, newMembership) => {
    try {
      await updateDoc(doc(db, 'profiles', userId), { membership: newMembership });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, membership: newMembership } : u))
      );
      alert(`Membership updated to ${newMembership} for user ${users.find((u) => u.id === userId)?.username}!`);
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error updating membership:', error);
      alert('Failed to update membership.');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all accounts? This cannot be undone directly.')) return;
    try {
      const promises = users.map((u) => deleteDoc(doc(db, 'profiles', u.id)));
      await Promise.all(promises);
      setDeletedUsers((prev) => [...prev, ...users]); // Store all deleted users
      setUsers([]);
      alert('✅ All accounts deleted!');
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error deleting all accounts:', error);
      alert('Failed to delete all accounts.');
    }
  };

  const handleRestoreAll = async () => {
    if (deletedUsers.length === 0) return alert('No deleted accounts to restore!');
    try {
      const promises = deletedUsers.map((user) =>
        addDoc(collection(db, 'profiles'), { ...user, id: undefined })
      );
      await Promise.all(promises);
      setDeletedUsers([]); // Clear deleted users after restoration
      setRefresh(!refresh);
      alert('✅ All deleted accounts restored!');
    } catch (error) {
      console.error('Error restoring accounts:', error);
      alert('Failed to restore accounts.');
    }
  };

  const handleRevertLastEdit = () => {
    if (!lastEdit) return alert('No previous edit to revert!');
    const { userId, previousData } = lastEdit;
    updateDoc(doc(db, 'profiles', userId), previousData)
      .then(() => {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...previousData, id: userId } : u))
        );
        setLastEdit(null); // Clear last edit after revert
        alert('✅ Last edit reverted successfully!');
        setRefresh(!refresh);
      })
      .catch((error) => {
        console.error('Error reverting edit:', error);
        alert('Failed to revert edit.');
      });
  };

  const handleEdit = (user) => {
    setForm({ 
      ...user, 
      services: user.services || [], 
      nearby: user.nearby || [] 
    });
    setIsEdit(true);
    setEditId(user.id);
    setShowPassword(false);
    setLastEdit({ userId: user.id, previousData: { ...user } }); // Store original data
  };

  if (!loggedIn) {
    return (
      <div
        style={{
          padding: '10px',
          fontFamily: 'Arial',
          background: '#f0f0f0',
          textAlign: 'center',
        }}
      >
        <Head>
          <title>Admin Login</title>
        </Head>
        <h1 style={{ color: '#e91e63' }}>Admin Login</h1>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          style={{
            padding: '8px',
            margin: '5px 0',
            width: '200px',
            fontSize: '0.9rem',
          }}
        />
        <br />
        <button
          onClick={handleLogin}
          style={{
            padding: '8px 16px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            fontSize: '0.9rem',
          }}
        >
          Login
        </button>
      </div>
    );
  }

  const wards = Nairobi ? Object.keys(Nairobi) : [];
  const areasForWard = form.ward && Nairobi ? Nairobi[form.ward] : [];

  return (
    <div style={{ padding: '10px', fontFamily: 'Arial', background: '#f0f0f0', position: 'relative' }}>
      <Head>
        <title>Admin Panel</title>
      </Head>

      <h1 style={{ textAlign: 'center', color: '#e91e63' }}>Admin Panel</h1>

      <button
        onClick={handleLogout}
        style={{
          padding: '8px 16px',
          background: '#f44336',
          color: 'white',
          border: 'none',
          fontSize: '0.9rem',
          marginBottom: '10px',
        }}
      >
        Logout
      </button>

      {/* Global 3-dot menu at top right */}
      <button
        onClick={() => setGlobalMenuOpen(!globalMenuOpen)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: '#666',
          color: 'white',
          border: 'none',
          padding: '8px',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '18px',
          zIndex: 100,
        }}
      >
        ⋮
      </button>
      {globalMenuOpen && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '20px',
            background: '#fff',
            border: '1px solid #ccc',
            padding: '10px',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 100,
          }}
        >
          <button
            onClick={handleDeleteAll}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              marginBottom: '5px',
              cursor: 'pointer',
            }}
          >
            Delete All Accounts
          </button>
          <button
            onClick={handleRestoreAll}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Restore All Deleted Accounts
          </button>
        </div>
      )}

      <div style={{ background: '#fff', padding: '10px', marginBottom: '10px' }}>
        <h2 style={{ color: '#e91e63' }}>Create Profile</h2>
        <input
          name="username"
          placeholder="Username"
          value={form.username}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <input
          name="email"
          placeholder="Email (optional)"
          value={form.email}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        {isEdit && (
          <div style={{ padding: '8px', background: 'lightgray', marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '10px' }}>Password: </span>
            <span style={{ flex: 1 }}>{showPassword ? (form.password || 'N/A') : '********'}</span>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                marginLeft: '10px',
              }}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        )}
        <input
          name="phone"
          placeholder="Phone"
          value={form.phone}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        >
          <option>User</option>
          <option>Admin</option>
        </select>
        <select
          name="membership"
          value={form.membership}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        >
          <option>Regular</option>
          <option>VIP</option>
          <option>VVIP</option>
        </select>
        <input
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        >
          <option value="">Select Gender</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
        <select
          name="age"
          value={form.age}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        >
          <option value="">Select Age</option>
          {Array.from({ length: 82 }, (_, i) => 18 + i).map((age) => (
            <option key={age} value={age}>
              {age}
            </option>
          ))}
        </select>
        <input
          name="nationality"
          placeholder="Nationality (optional)"
          value={form.nationality}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <input
          name="county"
          placeholder="County"
          value={form.county}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <select
          name="ward"
          value={form.ward}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        >
          <option value="">Select Ward</option>
          {wards.map((ward) => (
            <option key={ward} value={ward}>
              {ward}
            </option>
          ))}
        </select>
        <select
          name="area"
          value={form.area}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
          disabled={!form.ward}
        >
          <option value="">Select Area</option>
          {areasForWard.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
        <div>
          <label>Nearby Places:</label>
          {form.ward && Nairobi[form.ward].map((place) => (
            <div key={place}>
              <input
                type="checkbox"
                name="nearby"
                value={place}
                checked={(form.nearby || []).includes(place)}
                onChange={handleChange}
              />
              <span>{place}</span>
            </div>
          ))}
        </div>
        <div>
          <label>Services:</label>
          {servicesList.map((service) => (
            <div key={service}>
              <input
                type="checkbox"
                name="services"
                value={service}
                checked={(form.services || []).includes(service)}
                onChange={handleChange}
              />
              <span>{service}</span>
            </div>
          ))}
        </div>
        <input
          name="otherServices"
          placeholder="Other Services (optional)"
          value={form.otherServices}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <input
          name="incallsRate"
          placeholder="Incalls Rate (KSh/hr)"
          value={form.incallsRate}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <input
          name="outcallsRate"
          placeholder="Outcalls Rate (KSh/hr)"
          value={form.outcallsRate}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleProfilePic}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        {form.profilePic && (
          <img
            src={form.profilePic}
            alt="Current Profile Picture"
            style={{
              width: '150px',
              height: '150px',
              objectFit: 'cover',
              marginTop: '10px',
              borderRadius: '8px',
            }}
          />
        )}
        <button
          onClick={handleSave}
          style={{
            background: '#4CAF50',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            marginTop: '5px',
          }}
        >
          {isEdit ? 'Update' : 'Save'}
        </button>
      </div>

      <div style={{ background: '#fff', padding: '10px' }}>
        <h2 style={{ color: '#e91e63' }}>All Users</h2>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}
        >
          <thead>
            <tr style={{ background: '#ddd' }}>
              <th>Username</th>
              <th>Email</th>
              <th>Password</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Membership</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username || 'N/A'}</td>
                <td>{u.email || 'N/A'}</td>
                <td>********</td>
                <td>{u.phone || 'N/A'}</td>
                <td>{u.role || 'User'}</td>
                <td>
                  <select
                    value={u.membership || 'Regular'}
                    onChange={(e) => handleUpdateMembership(u.id, e.target.value)}
                    style={{
                      padding: '5px',
                      marginRight: '5px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option>Regular</option>
                    <option>VIP</option>
                    <option>VVIP</option>
                  </select>
                </td>
                <td style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent menu open
                      handleEdit(u);
                    }}
                    style={{
                      background: '#2196F3',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      marginRight: '5px',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(u.id);
                    }}
                    style={{
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
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

      <div style={{ marginTop: '10px' }}>
        <button
          onClick={handleRevertLastEdit}
          style={{
            padding: '8px 16px',
            background: '#ff9800',
            color: 'white',
            border: 'none',
            fontSize: '0.9rem',
          }}
        >
          Revert Previous Action
        </button>
      </div>
    </div>
  );
}

