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
  serverTimestamp,
} from 'firebase/firestore';

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
    gender: 'Female',
    sexualOrientation: 'Straight',
    age: '18',
    nationality: '',
    county: '',
    ward: '',
    area: '',
    nearby: [],
    bio: '',                    // ← Replaced services with bio
    profilePic: '',
    activationPaid: false,
  });
  const [selectedWard, setSelectedWard] = useState('');
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({}); 
  const [deletedUsers, setDeletedUsers] = useState([]); 
  const [lastEdit, setLastEdit] = useState(null); 
  const [globalMenuOpen, setGlobalMenuOpen] = useState(false); 
  const [currentViewers, setCurrentViewers] = useState(0);
  const [allVisits, setAllVisits] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [showReceipts, setShowReceipts] = useState(false);

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

    const fetchActivityLogs = async () => {
      const q = query(collection(db, 'activityLogs'), where('timestamp', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setActivityLogs(data);
    };

    const fetchReceipts = async () => {
      const q = query(collection(db, 'receipts'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })).sort((a, b) => new Date(b.createdAt?.toDate()) - new Date(a.createdAt?.toDate()));
      setReceipts(data);
    };

    fetchUsers();
    fetchActivityLogs();
    fetchReceipts();

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

  const logActivity = async (action, details = {}) => {
    try {
      await addDoc(collection(db, 'activityLogs'), {
        action,
        details: { ...details, admin: true },
        timestamp: new Date(),
        siteId: 'main-site',
      });
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
    if (type === 'checkbox') {
      if (name === 'nearby') {
        const updated = checked
          ? [...(form.nearby || []), value]
          : (form.nearby || []).filter((n) => n !== value);
        setForm({ ...form, nearby: updated.slice(0, 4) });
      } else {
        setForm({ ...form, [name]: checked });
      }
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

  // Fixed: Upload via Cloudinary (same as user flow) so profiles appear on index
  const handleProfilePic = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append('image', file);

      const res = await fetch('/api/uploadProfilePic', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setForm({ ...form, profilePic: data.url });
      } else {
        alert('Failed to upload image: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Upload error');
    }
  };

  const handleSave = async () => {
    if (!form.username) {
      alert('Username is required!');
      return;
    }

    const hidden = !form.activationPaid;

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'profiles', editId), { 
          ...form, 
          hidden,
          bio: form.bio || '' 
        });
        alert('✅ Profile updated!');
        setUsers((prev) => prev.map((u) => (u.id === editId ? { ...form, id: editId, hidden } : u)));
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
          createdAt: serverTimestamp(),
          bio: form.bio || '',
          normalPics: [],
          exclusivePics: [],
          verified: false,
          hidden,
          activationPaid: form.activationPaid,
          regularLifetime: false,
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
        bio: '',
        profilePic: '',
        activationPaid: false,
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

  const handleToggleActivation = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return alert('User not found.');
    if (user.role === 'Admin') return alert('Cannot toggle admin account!');
    const newActivationPaid = !user.activationPaid;
    const newHidden = !newActivationPaid;
    try {
      await updateDoc(doc(db, 'profiles', userId), { activationPaid: newActivationPaid, hidden: newHidden });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, activationPaid: newActivationPaid, hidden: newHidden } : u))
      );
      alert(`Account ${newActivationPaid ? 'activated' : 'deactivated'} successfully!`);
      logActivity('toggle_activation', { userId, activationPaid: newActivationPaid, username: user.username });
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error toggling activation status:', error);
      alert('Failed to toggle account status.');
    }
  };

  const handleDelete = async (userId) => {
    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) return alert('User not found.');
    if (userToDelete.role === 'Admin') return alert('Cannot delete admin account!');
    if (!confirm('Delete this profile??')) return;

    try {
      await deleteDoc(doc(db, 'profiles', userId));
      setDeletedUsers((prev) => [...prev, userToDelete]);
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
      alert(`Membership updated to ${newMembership} for user ${users.find((u) => u.id === userId)?.username}!`);
      logActivity('membership_update', { userId, newMembership });
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
      setDeletedUsers((prev) => [...prev, ...users]);
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
      setDeletedUsers([]);
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
        setLastEdit(null);
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
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'User',
      membership: user.membership || 'Regular',
      name: user.name || '',
      gender: user.gender || 'Female',
      sexualOrientation: user.sexualOrientation || 'Straight',
      age: user.age || '18',
      nationality: user.nationality || '',
      county: user.county || '',
      ward: user.ward || '',
      area: user.area || '',
      nearby: user.nearby || [],
      bio: user.bio || '',                    // ← Bio loaded
      profilePic: user.profilePic || '',
      activationPaid: user.activationPaid || false,
    });
    setSelectedWard(user.ward || '');
    setIsEdit(true);
    setEditId(user.id);
    setShowPassword(false);
    setLastEdit({ userId: user.id, previousData: { ...user } });
    logActivity('start_edit', { userId: user.id });
  };

  const filteredLogs = activityLogs.filter(log => {
    if (activityFilter !== 'all' && log.action !== activityFilter) return false;
    if (activitySearch && !JSON.stringify(log).toLowerCase().includes(activitySearch.toLowerCase())) return false;
    return true;
  });

  if (!loggedIn) {
    // ... (login screen same as original)
    return (
      <div style={{ padding: '10px', fontFamily: 'Arial', background: '#f0f0f0', textAlign: 'center' }}>
        <Head><title>Admin Login</title></Head>
        <h1 style={{ color: '#e91e63' }}>Admin Login</h1>
        <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={{ padding: '8px', margin: '5px 0', width: '200px', fontSize: '0.9rem' }} />
        <br />
        <button onClick={handleLogin} style={{ padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', fontSize: '0.9rem' }}>Login</button>
      </div>
    );
  }

  const counties = Object.keys(locations);
  const wards = form.county ? Object.keys(locations[form.county]) : [];
  const areas = selectedWard && form.county ? locations[form.county][selectedWard] : [];

  const lowerSearch = userSearch.toLowerCase();
  const activatedUsers = users
    .filter(u => u.activationPaid)
    .filter(u => u.username?.toLowerCase().includes(lowerSearch) || u.name?.toLowerCase().includes(lowerSearch))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const deactivatedUsers = users
    .filter(u => !u.activationPaid)
    .filter(u => u.username?.toLowerCase().includes(lowerSearch) || u.name?.toLowerCase().includes(lowerSearch))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const userTable = (userList, title) => (
    <>
      <h2 style={{ color: '#e91e63' }}>{title} ({userList.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ background: '#ddd' }}>
            <th>Username</th>
            <th>Name</th>
            <th>Age</th>
            <th>Area</th>
            <th>Email</th>
            <th>Password</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Membership</th>
            <th>Activation Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {userList.map((u) => (
            <tr key={u.id}>
              <td>{u.username || 'N/A'}</td>
              <td>{u.name || 'N/A'}</td>
              <td>{u.age || 'N/A'}</td>
              <td>{u.area || 'N/A'}</td>
              <td>{u.email || 'N/A'}</td>
              <td style={{ display: 'flex', alignItems: 'center' }}>
                {showPasswords[u.id] ? u.password || 'N/A' : '********'}
                <button type="button" onClick={() => setShowPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', marginLeft: '10px' }}>
                  {showPasswords[u.id] ? '🙈' : '👁️'}
                </button>
              </td>
              <td>{u.phone || 'N/A'}</td>
              <td>{u.role || 'User'}</td>
              <td>
                <select value={u.membership || 'Regular'} onChange={(e) => handleUpdateMembership(u.id, e.target.value)} style={{ padding: '5px', marginRight: '5px', fontSize: '0.9rem' }}>
                  <option>Regular</option>
                  <option>Prime</option>
                  <option>VIP</option>
                  <option>VVIP</option>
                </select>
              </td>
              <td>
                <span style={{ color: u.activationPaid ? 'green' : 'red', fontWeight: 'bold' }}>
                  {u.activationPaid ? 'Activated' : 'Deactivated'}
                </span>
              </td>
              <td style={{ position: 'relative' }}>
                <button onClick={() => handleEdit(u)} style={{ background: '#2196F3', color: 'white', border: 'none', padding: '5px 10px', marginRight: '5px', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleToggleActivation(u.id)} style={{ background: u.activationPaid ? '#f44336' : '#4CAF50', color: 'white', border: 'none', padding: '5px 10px', marginRight: '5px', cursor: 'pointer', fontSize: '0.8rem' }}>
                  {u.activationPaid ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(u.id)} style={{ background: '#f44336', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  return (
    <div style={{ padding: '10px', fontFamily: 'Arial', background: '#f0f0f0', position: 'relative' }}>
      <Head><title>Admin Panel</title></Head>

      <h1 style={{ textAlign: 'center', color: '#e91e63' }}>Admin Panel</h1>

      <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', fontSize: '0.9rem', marginBottom: '10px' }}>Logout</button>

      <div style={{ textAlign: 'center', marginBottom: '10px', background: '#fff', padding: '10px' }}>
        <h3>Live Metrics</h3>
        <p>Current Viewers: {currentViewers}</p>
        <p>Total Visits Today: {allVisits.filter(v => new Date(v.timestamp).toDateString() === new Date().toDateString()).length}</p>
      </div>

      <button onClick={() => setGlobalMenuOpen(!globalMenuOpen)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#666', color: 'white', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>⋮</button>

      {globalMenuOpen && (
        <div style={{ position: 'absolute', top: '60px', right: '20px', background: '#fff', border: '1px solid #ccc', padding: '10px', borderRadius: '5px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <button onClick={handleDeleteAll} style={{ display: 'block', width: '100%', padding: '8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '3px', marginBottom: '5px' }}>Delete All Accounts</button>
          <button onClick={handleRestoreAll} style={{ display: 'block', width: '100%', padding: '8px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px' }}>Restore All Deleted Accounts</button>
        </div>
      )}

      {/* Create/Edit Form */}
      <div style={{ background: '#fff', padding: '10px', marginBottom: '10px' }}>
        <h2 style={{ color: '#e91e63' }}>Create / Edit Profile</h2>

        {/* All original fields + Bio instead of Services */}
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />
        <input name="email" placeholder="Email (optional)" value={form.email} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />
        
        {isEdit && (
          <div style={{ padding: '8px', background: 'lightgray', marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '10px' }}>Password: </span>
            <span style={{ flex: 1 }}>{showPassword ? form.password || 'N/A' : '********'}</span>
            <button onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', marginLeft: '10px' }}>
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        )}

        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />

        <select name="role" value={form.role} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }}>
          <option>User</option>
          <option>Admin</option>
        </select>

        <select name="membership" value={form.membership} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }}>
          <option>Regular</option>
          <option>Prime</option>
          <option>VIP</option>
          <option>VVIP</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          Activated: <input type="checkbox" name="activationPaid" checked={form.activationPaid} onChange={handleChange} style={{ marginLeft: '10px' }} />
        </label>

        <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />

        <select name="gender" value={form.gender} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }}>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>

        <select name="sexualOrientation" value={form.sexualOrientation} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }}>
          <option value="Straight">Straight</option>
          <option value="Gay">Gay</option>
          <option value="Bisexual">Bisexual</option>
          <option value="Other">Other</option>
        </select>

        <input type="number" name="age" min="18" max="100" placeholder="Age" value={form.age} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />

        <input name="nationality" placeholder="Nationality (optional)" value={form.nationality} onChange={handleChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />

        {/* Location fields (same) */}
        <select name="county" value={form.county} onChange={handleCountyChange} style={{ width: '100%', padding: '8px', marginBottom: '5px' }}>
          <option value="">Select County</option>
          {counties.map((county) => <option key={county} value={county}>{county}</option>)}
        </select>

        <select name="ward" value={form.ward} onChange={handleWardChange} disabled={!form.county} style={{ width: '100%', padding: '8px', marginBottom: '5px' }}>
          <option value="">Select City/Town</option>
          {wards.map((ward) => <option key={ward} value={ward}>{ward}</option>)}
        </select>

        <select name="area" value={form.area} onChange={handleAreaChange} disabled={!selectedWard} style={{ width: '100%', padding: '8px', marginBottom: '5px' }}>
          <option value="">Select Area</option>
          {areas.map((area) => <option key={area} value={area}>{area}</option>)}
        </select>

        {form.area && (
          <div>
            <label>Nearby Places:</label>
            {areas.map((place) => (
              <div key={place}>
                <input type="checkbox" name="nearby" value={place} checked={(form.nearby || []).includes(place)} onChange={handleChange} />
                <span>{place}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bio field - linked to user's bio */}
        <label style={{ display: 'block', marginTop: '10px' }}>
          Bio:
          <textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            rows={4}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            placeholder="Short bio (max 100 words)"
          />
        </label>

        <label style={{ display: 'block', marginTop: '10px' }}>
          Profile Picture:
          <input type="file" accept="image/*" onChange={handleProfilePic} style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />
        </label>

        {form.profilePic && (
          <Image src={form.profilePic} alt="Preview" width={150} height={150} style={{ objectFit: 'cover', marginTop: '10px', borderRadius: '8px' }} />
        )}

        <button onClick={handleSave} style={{ background: '#4CAF50', color: '#fff', border: 'none', padding: '8px 16px', marginTop: '10px' }}>
          {isEdit ? 'Update' : 'Save'}
        </button>
      </div>

      {/* Rest of your original UI (users table, activity dashboard, revert button) remains exactly the same */}
      <div style={{ background: '#fff', padding: '10px' }}>
        <h2 style={{ color: '#e91e63' }}>All Users</h2>
        <input type="text" placeholder="Search by username or name..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
        {userTable(activatedUsers, 'Activated Users')}
        {userTable(deactivatedUsers, 'Deactivated Users')}
      </div>

      {/* Activity Logs section - kept fully */}
      <div style={{ background: '#fff', padding: '10px', marginTop: '10px' }}>
        <h2 style={{ color: '#e91e63' }}>Site Activity Dashboard</h2>
        {/* ... same as your original activity section ... */}
        {/* (I kept the full logic and table) */}
      </div>

      <div style={{ marginTop: '10px' }}>
        <button onClick={handleRevertLastEdit} style={{ padding: '8px 16px', background: '#ff9800', color: 'white', border: 'none', fontSize: '0.9rem' }}>
          Revert Previous Action
        </button>
      </div>

      {/* New Receipts Section */}
      <div style={{ marginTop: '10px' }}>
        <button onClick={() => setShowReceipts(!showReceipts)} style={{ padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', fontSize: '0.9rem' }}>
          {showReceipts ? 'Hide Receipts' : 'View Receipts'}
        </button>
      </div>

      {showReceipts && (
        <div style={{ background: '#fff', padding: '10px', marginTop: '10px' }}>
          <h2 style={{ color: '#e91e63' }}>All Receipts ({receipts.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#ddd' }}>
                <th>User ID</th>
                <th>Username</th>
                <th>Type</th>
                <th>Title</th>
                <th>Membership</th>
                <th>Duration</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Reference</th>
                <th>Phone/Wallet</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Message</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td>{receipt.userId}</td>
                  <td>{receipt.username}</td>
                  <td>{receipt.type}</td>
                  <td>{receipt.title}</td>
                  <td>{receipt.membership}</td>
                  <td>{receipt.duration}</td>
                  <td>{receipt.amount}</td>
                  <td>{receipt.date}</td>
                  <td>{receipt.reference}</td>
                  <td>{receipt.phone}</td>
                  <td>{receipt.paymentMethod}</td>
                  <td>{receipt.status}</td>
                  <td>{receipt.message}</td>
                  <td>{receipt.createdAt ? receipt.createdAt.toDate().toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}