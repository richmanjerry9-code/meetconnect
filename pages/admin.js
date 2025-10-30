// admin.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import * as locations from '../data/locations';
import { db } from '../lib/firebase.js';
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
  '🍽️ Dinner Date',
  '💬 Just Vibes',
  '❤️ Relationship',
  '🌆 Night Out',
  '👥 Friendship',
];

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

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
    profilePic: null,
  });
  const [selectedWard, setSelectedWard] = useState('');
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({}); // For table password toggles
  const [deletedUsers, setDeletedUsers] = useState([]); // Track deleted users
  const [lastEdit, setLastEdit] = useState(null); // Track last edited profile
  const [globalMenuOpen, setGlobalMenuOpen] = useState(false); // For global 3-dot menu
  const [currentViewers, setCurrentViewers] = useState(0);
  const [allVisits, setAllVisits] = useState([]);
  // New states for activity viewer
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityFilter, setActivityFilter] = useState('all'); // Filter by action type: all, create, update, delete, etc.
  const [activitySearch, setActivitySearch] = useState(''); // Search term

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

    // New: Fetch activity logs
    const fetchActivityLogs = async () => {
      const q = query(collection(db, 'activityLogs'), where('timestamp', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))); // Last 30 days
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Desc order
      setActivityLogs(data);
    };
    fetchActivityLogs();

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

  // New: Function to log activity (call this in existing functions for enhancement)
  const logActivity = async (action, details = {}) => {
    try {
      await addDoc(collection(db, 'activityLogs'), {
        action,
        details: { ...details, admin: true }, // Mark as admin action
        timestamp: new Date(),
        siteId: 'main-site', // Assume single site; extend for multi
      });
      // Optimistically update UI
      setActivityLogs(prev => [{
        id: Date.now().toString(),
        action,
        details: { ...details, admin: true },
        timestamp: new Date(),
      }, ...prev]);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  const handleLogin = () => {
    if (!ADMIN_PASSWORD) {
      alert('Admin password not configured! Check environment variables.');
      return;
    }
    if (passwordInput === ADMIN_PASSWORD) {
      setLoggedIn(true);
      setPasswordInput('');
      logActivity('admin_login', { timestamp: new Date().toISOString() });
    } else {
      alert('Wrong password!');
    }
  };

  const handleLogout = () => {
    logActivity('admin_logout', { timestamp: new Date().toISOString() });
    setLoggedIn(false);
  };

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

  const handleCountyChange = (e) => {
    const county = e.target.value;
    setForm((prev) => ({ ...prev, county, ward: '', area: '', nearby: [] }));
    setSelectedWard('');
  };

  const handleWardChange = (e) => {
    const ward = e.target.value;
    setSelectedWard(ward);
    setForm((prev) => ({ ...prev, ward, area: '', nearby: [] }));
  };

  const handleAreaChange = (e) => {
    setForm((prev) => ({ ...prev, area: e.target.value }));
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
        setUsers((prev) => prev.map((u) => (u.id === editId ? { ...form, id: editId } : u)));
        logActivity('profile_update', { userId: editId, username: form.username });
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
          county: form.county || '',
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
        logActivity('profile_create', { userId: docRef.id, username: form.username });
      }

      setForm({
        username: '',
        email: '',
        phone: '',
        role: 'User',
        membership: 'Regular',
        name: '',
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
    if (!confirm('Delete this profile??')) return;

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
      logActivity('profile_delete', { userId, username: userToDelete.username });
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
      alert(
        `Membership updated to ${newMembership} for user ${users.find((u) => u.id === userId)?.username}!`
      );
      logActivity('membership_update', { userId, newMembership });
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error updating membership:', error);
      alert('Failed to update membership.');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all accounts? This cannot be undone directly.'))
      return;
    try {
      const promises = users.map((u) => deleteDoc(doc(db, 'profiles', u.id)));
      await Promise.all(promises);
      setDeletedUsers((prev) => [...prev, ...users]); // Store all deleted users
      setUsers([]);
      alert('✅ All accounts deleted!');
      logActivity('bulk_delete_all', { count: users.length });
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
      logActivity('bulk_restore_all', { count: deletedUsers.length });
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
        logActivity('revert_edit', { userId });
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
      nearby: user.nearby || [],
    });
    setSelectedWard(user.ward || '');
    setIsEdit(true);
    setEditId(user.id);
    setShowPassword(false);
    setLastEdit({ userId: user.id, previousData: { ...user } }); // Store original data
    logActivity('start_edit', { userId: user.id });
  };

  // New: Filtered logs for display
  const filteredLogs = activityLogs.filter(log => {
    if (activityFilter !== 'all' && log.action !== activityFilter) return false;
    if (activitySearch && !JSON.stringify(log).toLowerCase().includes(activitySearch.toLowerCase())) return false;
    return true;
  });

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

  const counties = Object.keys(locations);
  const wards = form.county ? Object.keys(locations[form.county]) : [];
  const areas = selectedWard && form.county ? locations[form.county][selectedWard] : [];

  return (
    <div
      style={{ padding: '10px', fontFamily: 'Arial', background: '#f0f0f0', position: 'relative' }}
    >
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

      {/* New: Current Viewers Display */}
      <div style={{ textAlign: 'center', marginBottom: '10px', background: '#fff', padding: '10px' }}>
        <h3>Live Metrics</h3>
        <p>Current Viewers: {currentViewers}</p>
        <p>Total Visits Today: {allVisits.filter(v => new Date(v.timestamp).toDateString() === new Date().toDateString()).length}</p>
      </div>

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
          <div
            style={{
              padding: '8px',
              background: 'lightgray',
              marginBottom: '5px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ marginRight: '10px' }}>Password: </span>
            <span style={{ flex: 1 }}>{showPassword ? form.password || 'N/A' : '********'}</span>
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
          <option>Prime</option>
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
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
        <select
          name="sexualOrientation"
          value={form.sexualOrientation}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        >
          <option value="Straight">Straight</option>
          <option value="Gay">Gay</option>
          <option value="Bisexual">Bisexual</option>
          <option value="Other">Other</option>
        </select>
        <input
          type="number"
          name="age"
          min="18"
          max="100"
          placeholder="Age"
          value={form.age}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <input
          name="nationality"
          placeholder="Nationality (optional)"
          value={form.nationality}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        <select
          name="county"
          value={form.county}
          onChange={handleCountyChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        >
          <option value="">Select County</option>
          {counties.map((county) => (
            <option key={county} value={county}>
              {county}
            </option>
          ))}
        </select>
        <select
          name="ward"
          value={form.ward}
          onChange={handleWardChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
          disabled={!form.county}
        >
          <option value="">Select City/Town</option>
          {wards.map((ward) => (
            <option key={ward} value={ward}>
              {ward}
            </option>
          ))}
        </select>
        <select
          name="area"
          value={form.area}
          onChange={handleAreaChange}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
          disabled={!selectedWard}
        >
          <option value="">Select Area</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
        <div>
          <label>Nearby Places:</label>
          {areas.map((place) => (
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
          type="file"
          accept="image/*"
          onChange={handleProfilePic}
          style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
        />
        {form.profilePic && (
          <Image
            src={form.profilePic}
            alt="Current Profile Picture"
            width={150}
            height={150}
            style={{
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
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
                <td style={{ display: 'flex', alignItems: 'center' }}>
                  {showPasswords[u.id] ? u.password || 'N/A' : '********'}
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      marginLeft: '10px',
                    }}
                  >
                    {showPasswords[u.id] ? '🙈' : '👁️'}
                  </button>
                </td>
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
                    <option>Prime</option>
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

      {/* New: Activity Dashboard Section */}
      <div style={{ background: '#fff', padding: '10px', marginTop: '10px' }}>
        <h2 style={{ color: '#e91e63' }}>Site Activity Dashboard</h2>
        <div style={{ marginBottom: '10px' }}>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            style={{ padding: '5px', marginRight: '10px' }}
          >
            <option value="all">All Actions</option>
            <option value="profile_create">Profile Created</option>
            <option value="profile_update">Profile Updated</option>
            <option value="profile_delete">Profile Deleted</option>
            <option value="membership_update">Membership Updated</option>
            <option value="admin_login">Admin Login</option>
            <option value="admin_logout">Admin Logout</option>
          </select>
          <input
            type="text"
            placeholder="Search logs..."
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            style={{ padding: '5px', width: '200px' }}
          />
          <button
            onClick={() => setRefresh(!refresh)} // Refresh logs
            style={{ padding: '5px 10px', background: '#2196F3', color: 'white', border: 'none', marginLeft: '10px' }}
          >
            Refresh
          </button>
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#ddd' }}>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Details</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, 50).map((log) => ( // Limit to last 50 for perf
                <tr key={log.id}>
                  <td>{new Date(log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleString()}</td>
                  <td style={{ color: log.admin ? '#e91e63' : '#333' }}>{log.action}</td>
                  <td>{JSON.stringify(log.details).slice(1, -1).replace(/"/g, '') || 'N/A'}</td>
                  <td>{log.siteId || 'Main'}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No activity logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
          Showing last 50 logs. Total: {activityLogs.length}
        </p>
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
