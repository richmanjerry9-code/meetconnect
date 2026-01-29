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
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

const servicesList = [
  'Dinner Date',
  'Just Vibes',
  'Relationship',
  'Night Out',
  'Friendship',
];

const ADMIN_PASSWORD = '447962Pa$$word';

export default function AdminPanel() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refresh, setRefresh] = useState(false);

  // Profile picture upload state
  const [profilePicFile, setProfilePicFile] = useState(null);

  const [form, setForm] = useState({
    username: '',
    email: '',
    phone: '',
    role: 'User',
    membership: 'Regular',
    subscriptionEndDate: '',
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
    hidden: false,
    bio: '',
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
  const [userFilter, setUserFilter] = useState('all');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [expiringSoon, setExpiringSoon] = useState(0);

  useEffect(() => {
    if (!loggedIn) return;

    const fetchData = async () => {
      try {
        const usersQuery = query(collection(db, 'profiles'), orderBy('createdAt', 'desc'));
        const usersSnapshot = await getDocs(usersQuery);
        let userData = usersSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        // Auto-clean expired memberships
        const now = new Date();
        const expired = userData.filter(u => u.subscriptionEndDate && new Date(u.subscriptionEndDate) < now);
        if (expired.length > 0) {
          const promises = expired.map(u => updateDoc(doc(db, 'profiles', u.id), { membership: 'Regular', subscriptionEndDate: null }));
          await Promise.all(promises);
          console.log(`Cleaned ${expired.length} expired memberships`);
        }

        // Set activationPaid for legacy live accounts
        const legacyLive = userData.filter(u => !u.hidden && (u.activationPaid === undefined || u.activationPaid === false));
        if (legacyLive.length > 0) {
          const promises = legacyLive.map(u => updateDoc(doc(db, 'profiles', u.id), { activationPaid: true }));
          await Promise.all(promises);
          console.log(`Updated ${legacyLive.length} legacy accounts to activated`);
        }

        // Refetch after cleaning
        const refreshedSnapshot = await getDocs(usersQuery);
        userData = refreshedSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setUsers(userData);

        const transactionsQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'));
        const transactionsSnapshot = await getDocs(transactionsQuery);
        const transactionData = transactionsSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setTransactions(transactionData);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const logsQuery = query(
          collection(db, 'activityLogs'),
          where('timestamp', '>=', thirtyDaysAgo),
          orderBy('timestamp', 'desc')
        );
        const logsSnapshot = await getDocs(logsQuery);
        const logData = logsSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setActivityLogs(logData);

        const revenue = transactionData.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        setTotalRevenue(revenue);

        const activeSubs = userData.filter((u) =>
          u.subscriptionEndDate && new Date(u.subscriptionEndDate) > now
        ).length;
        setActiveSubscriptions(activeSubs);

        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const expiring = userData.filter((u) =>
          u.subscriptionEndDate &&
          new Date(u.subscriptionEndDate) > now &&
          new Date(u.subscriptionEndDate) < sevenDaysFromNow
        ).length;
        setExpiringSoon(expiring);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();

    const storedVisits = JSON.parse(localStorage.getItem('visits') || '[]');
    const newVisit = { timestamp: new Date().toISOString() };
    const updatedVisits = [...storedVisits, newVisit];
    localStorage.setItem('visits', JSON.stringify(updatedVisits));
    setAllVisits(updatedVisits);
    setCurrentViewers((prev) => prev + 1);
    const handleUnload = () => setCurrentViewers((prev) => Math.max(prev - 1, 0));
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [loggedIn, refresh]);

  const logActivity = async (action, details = {}) => {
    try {
      await addDoc(collection(db, 'activityLogs'), {
        action,
        details: { ...details, admin: true },
        timestamp: serverTimestamp(),
        siteId: 'main-site',
      });
      setActivityLogs((prev) => [
        {
          id: Date.now().toString(),
          action,
          details: { ...details, admin: true },
          timestamp: new Date(),
        },
        ...prev,
      ]);
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
    } else if (type === 'checkbox' && name === 'hidden') {
      setForm({ ...form, hidden: checked });
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

    setProfilePicFile(file);

    const reader = new FileReader();
    reader.onload = () => setForm(prev => ({ ...prev, profilePic: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.username) {
      alert('Username is required!');
      return;
    }

    let finalPhotoURL = form.profilePic;

    if (profilePicFile) {
      try {
        const fd = new FormData();
        fd.append('media', profilePicFile);
        fd.append('userId', isEdit ? editId : 'admin');
        fd.append('isExclusive', 'false');
        fd.append('caption', 'profile_pic');
        const res = await fetch('/api/uploadPost', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Upload failed');
        }
        finalPhotoURL = data.url;
      } catch (err) {
        console.error('Admin profile pic upload error:', err);
        alert('Failed to upload profile picture');
        return;
      }
    }

    try {
      const profileData = {
        ...form,
        profilePic: finalPhotoURL,
        subscriptionEndDate: form.subscriptionEndDate ? new Date(form.subscriptionEndDate) : null,
        bio: form.bio || '',
      };

      if (isEdit) {
        await updateDoc(doc(db, 'profiles', editId), profileData);
        alert('Profile updated!');
        setUsers((prev) => prev.map((u) => (u.id === editId ? { ...u, ...profileData } : u)));
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
        const newProfileData = {
          ...profileData,
          email: fakeEmail,
          password: fakePassword,
          createdAt: Date.now(),
        };
        const docRef = await addDoc(collection(db, 'profiles'), newProfileData);
        alert(`Profile saved!\nFake Email: ${fakeEmail}\nPassword: ${fakePassword}`);
        setUsers((prev) => [...prev, { id: docRef.id, ...newProfileData }]);
        logActivity('profile_create', { userId: docRef.id, username: form.username });
      }

      setForm({
        username: '',
        email: '',
        phone: '',
        role: 'User',
        membership: 'Regular',
        subscriptionEndDate: '',
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
        hidden: false,
        bio: '',
      });
      setProfilePicFile(null);
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
    const isActivated = user.activationPaid && !user.hidden;
    const newActivated = !isActivated;
    try {
      await updateDoc(doc(db, 'profiles', userId), { activationPaid: newActivated, hidden: !newActivated });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, activationPaid: newActivated, hidden: !newActivated } : u))
      );
      alert(`Account ${newActivated ? 'activated' : 'deactivated'} successfully!`);
      logActivity('toggle_activation', { userId, activated: newActivated, username: user.username });
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error toggling activation:', error);
      alert('Failed to toggle activation.');
    }
  };

  const handleDelete = async (userId) => {
    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) return alert('User not found.');
    if (userToDelete.role === 'Admin') return alert('Cannot delete admin account!');
    if (!confirm('Delete this profile?')) return;
    try {
      await deleteDoc(doc(db, 'profiles', userId));
      setDeletedUsers((prev) => [...prev, userToDelete]);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      alert('Profile deleted successfully!');
      logActivity('profile_delete', { userId, username: userToDelete.username });
      setRefresh(!refresh);
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

  const handleCleanExpired = async () => {
    if (!confirm('Clean expired memberships? This will set expired ones to Regular.')) return;
    try {
      const now = new Date();
      const expired = users.filter(u => u.subscriptionEndDate && new Date(u.subscriptionEndDate) < now);
      const promises = expired.map(u => updateDoc(doc(db, 'profiles', u.id), { membership: 'Regular', subscriptionEndDate: null }));
      await Promise.all(promises);
      setUsers(prev => prev.map(u => {
        if (expired.some(e => e.id === u.id)) {
          return { ...u, membership: 'Regular', subscriptionEndDate: null };
        }
        return u;
      }));
      alert(`${expired.length} memberships cleaned.`);
      logActivity('clean_expired', { count: expired.length });
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error cleaning expired:', error);
      alert('Failed to clean expired.');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all accounts? This cannot be undone directly.')) return;
    try {
      const promises = users.map((u) => deleteDoc(doc(db, 'profiles', u.id)));
      await Promise.all(promises);
      setDeletedUsers((prev) => [...prev, ...users]);
      setUsers([]);
      alert('All accounts deleted!');
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
        addDoc(collection(db, 'profiles'), { ...user, id: undefined, activationPaid: false, hidden: true })
      );
      await Promise.all(promises);
      setDeletedUsers([]);
      setRefresh(!refresh);
      alert('All deleted accounts restored!');
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
        alert('Last edit reverted successfully!');
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
      subscriptionEndDate: user.subscriptionEndDate ? new Date(user.subscriptionEndDate).toISOString().split('T')[0] : '',
      hidden: user.hidden || false,
      bio: user.bio || '',
    });
    setSelectedWard(user.ward || '');
    setIsEdit(true);
    setEditId(user.id);
    setShowPassword(false);
    setLastEdit({ userId: user.id, previousData: { ...user } });
    logActivity('start_edit', { userId: user.id });
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = JSON.stringify(u).toLowerCase().includes(userSearch.toLowerCase());
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (userFilter === 'active') return u.active && matchesSearch;
    if (userFilter === 'inactive') return !u.active && matchesSearch;
    if (userFilter === 'expiring') {
      return (
        matchesSearch &&
        u.subscriptionEndDate &&
        new Date(u.subscriptionEndDate) > now &&
        new Date(u.subscriptionEndDate) < sevenDaysFromNow
      );
    }
    if (userFilter === 'hidden') return u.hidden && matchesSearch;
    return matchesSearch;
  });

  const filteredLogs = activityLogs.filter((log) => {
    if (activityFilter !== 'all' && log.action !== activityFilter) return false;
    if (activitySearch && !JSON.stringify(log).toLowerCase().includes(activitySearch.toLowerCase()))
      return false;
    return true;
  });

  if (!loggedIn) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#f5f5f5',
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        <Head>
          <title>Admin Login</title>
        </Head>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>Admin Login</h1>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          style={{
            padding: '12px',
            width: '300px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginBottom: '10px',
            fontSize: '1rem',
          }}
        />
        <button
          onClick={handleLogin}
          style={{
            padding: '12px 24px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: 'pointer',
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
      style={{
        padding: '20px',
        fontFamily: "'Roboto', sans-serif",
        background: '#f5f5f5',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      <Head>
        <title>Admin Panel</title>
      </Head>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#333' }}>Admin Panel</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

      <button
        onClick={() => setGlobalMenuOpen(!globalMenuOpen)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'transparent',
          color: '#333',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
        }}
      >
        More
      </button>
      {globalMenuOpen && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '20px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: '10px',
            zIndex: 100,
          }}
        >
          <button
            onClick={handleDeleteAll}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              background: 'transparent',
              color: '#f44336',
              border: 'none',
              textAlign: 'left',
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
              padding: '10px',
              background: 'transparent',
              color: '#4CAF50',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            Restore All Deleted
          </button>
          <button
            onClick={handleRevertLastEdit}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              background: 'transparent',
              color: '#ff9800',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            Revert Last Action
          </button>
          <button
            onClick={handleCleanExpired}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              background: 'transparent',
              color: '#2196f3',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            Clean Expired Memberships
          </button>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px',
        }}
      >
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>Total Users</h3>
          <p style={{ fontSize: '2rem', color: '#333' }}>{users.length}</p>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>Active Subscriptions</h3>
          <p style={{ fontSize: '2rem', color: '#333' }}>{activeSubscriptions}</p>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>Expiring Soon (7 days)</h3>
          <p style={{ fontSize: '2rem', color: '#333' }}>{expiringSoon}</p>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>Total Revenue</h3>
          <p style={{ fontSize: '2rem', color: '#333' }}>${totalRevenue.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>Current Viewers</h3>
          <p style={{ fontSize: '2rem', color: '#333' }}>{currentViewers}</p>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>Visits Today</h3>
          <p style={{ fontSize: '2rem', color: '#333' }}>
            {allVisits.filter((v) => new Date(v.timestamp).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
      </div>

      <div
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '30px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <h2 style={{ color: '#333', marginBottom: '20px' }}>{isEdit ? 'Edit Profile' : 'Create Profile'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <input name="username" placeholder="Username" value={form.username} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input name="email" placeholder="Email (optional)" value={form.email} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
          {isEdit && (
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', padding: '12px' }}>
              <span style={{ flex: 1 }}>Password: {showPassword ? form.password || 'N/A' : '********'}</span>
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          )}
          <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <select name="role" value={form.role} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option>User</option>
            <option>Admin</option>
          </select>
          <select name="membership" value={form.membership} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option>Regular</option>
            <option>Prime</option>
            <option>VIP</option>
            <option>VVIP</option>
          </select>
          <input type="date" name="subscriptionEndDate" value={form.subscriptionEndDate} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <label style={{ display: 'flex', alignItems: 'center' }}>
            Hidden:
            <input type="checkbox" name="hidden" checked={form.hidden} onChange={handleChange} style={{ marginLeft: '10px' }} />
          </label>
          <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <select name="gender" value={form.gender} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option>Female</option>
            <option>Male</option>
          </select>
          <select name="sexualOrientation" value={form.sexualOrientation} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option>Straight</option>
            <option>Gay</option>
            <option>Bisexual</option>
            <option>Other</option>
          </select>
          <input type="number" name="age" min="18" max="100" placeholder="Age" value={form.age} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input name="nationality" placeholder="Nationality (optional)" value={form.nationality} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <select name="county" value={form.county} onChange={handleCountyChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option>Select County</option>
            {counties.map((county) => (
              <option key={county} value={county}>{county}</option>
            ))}
          </select>
          <select name="ward" value={form.ward} onChange={handleWardChange} disabled={!form.county} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option>Select City/Town</option>
            {wards.map((ward) => (
              <option key={ward} value={ward}>{ward}</option>
            ))}
          </select>
          <select name="area" value={form.area} onChange={handleAreaChange} disabled={!selectedWard} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option>Select Area</option>
            {areas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '10px' }}>Nearby Places:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {areas.map((place) => (
                <label key={place} style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="checkbox" name="nearby" value={place} checked={(form.nearby || []).includes(place)} onChange={handleChange} />
                  {place}
                </label>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '10px' }}>Services:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {servicesList.map((service) => (
                <label key={service} style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="checkbox" name="services" value={service} checked={(form.services || []).includes(service)} onChange={handleChange} />
                  {service}
                </label>
              ))}
            </div>
          </div>
          <input name="otherServices" placeholder="Other Services (optional)" value={form.otherServices} onChange={handleChange} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px', gridColumn: 'span 2' }} />
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '10px' }}>Bio</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={6} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '10px' }}>Profile Picture:</label>
            <input type="file" accept="image/*" onChange={handleProfilePic} style={{ padding: '12px' }} />
            {form.profilePic && (
              <Image src={form.profilePic} alt="Profile Picture" width={150} height={150} style={{ borderRadius: '8px', marginTop: '10px' }} />
            )}
          </div>
        </div>
        <button onClick={handleSave} style={{ marginTop: '20px', padding: '12px 24px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', fontSize: '1rem', cursor: 'pointer' }}>
          {isEdit ? 'Update Profile' : 'Create Profile'}
        </button>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>All Users</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <input type="text" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ padding: '12px', width: '300px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="all">All Users</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expiring">Expiring Soon</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Username</th>
                <th style={{ padding: '12px' }}>Name</th>
                <th style={{ padding: '12px' }}>Age</th>
                <th style={{ padding: '12px' }}>Area</th>
                <th style={{ padding: '12px' }}>Email</th>
                <th style={{ padding: '12px' }}>Password</th>
                <th style={{ padding: '12px' }}>Phone</th>
                <th style={{ padding: '12px' }}>Role</th>
                <th style={{ padding: '12px' }}>Membership</th>
                <th style={{ padding: '12px' }}>Subscription Ends</th>
                <th style={{ padding: '12px' }}>Activation Status</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const subEnd = u.subscriptionEndDate ? new Date(u.subscriptionEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                const isExpired = u.subscriptionEndDate && new Date(u.subscriptionEndDate) < new Date();
                const isActivated = u.activationPaid && !u.hidden;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '12px' }}>{u.username || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>{u.name || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>{u.age || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>{u.area || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>{u.email || 'N/A'}</td>
                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center' }}>
                      {showPasswords[u.id] ? u.password || 'N/A' : '********'}
                      <button onClick={() => setShowPasswords((prev) => ({ ...prev, [u.id]: !prev[u.id] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '10px' }}>
                        {showPasswords[u.id] ? 'Hide' : 'Show'}
                      </button>
                    </td>
                    <td style={{ padding: '12px' }}>{u.phone || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>{u.role || 'User'}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select value={u.membership || 'Regular'} onChange={(e) => handleUpdateMembership(u.id, e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                          <option>Regular</option>
                          <option>Prime</option>
                          <option>VIP</option>
                          <option>VVIP</option>
                        </select>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: isExpired ? 'red' : 'green' }}>{subEnd}</td>
                    <td style={{ padding: '12px', color: isActivated ? 'green' : 'red' }}>{isActivated ? 'Activated' : 'Deactivated'}</td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => handleEdit(u)} style={{ padding: '8px 12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', marginRight: '10px', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleToggleActivation(u.id)} style={{ padding: '8px 12px', background: isActivated ? '#ff1744' : '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', marginRight: '10px', cursor: 'pointer' }}>{isActivated ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => handleDelete(u.id)} style={{ padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No users found.</p>
          )}
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>All Purchases & Transactions</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Transaction ID</th>
                <th style={{ padding: '12px' }}>User</th>
                <th style={{ padding: '12px' }}>Amount</th>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Type</th>
                <th style={{ padding: '12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const user = users.find((u) => u.id === tx.userId);
                const txDate = tx.date ? new Date(tx.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }) : 'N/A';
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '12px' }}>{tx.id}</td>
                    <td style={{ padding: '12px' }}>{user ? user.username : 'Unknown'}</td>
                    <td style={{ padding: '12px' }}>${tx.amount?.toFixed(2) || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>{txDate}</td>
                    <td style={{ padding: '12px' }}>{tx.type || 'Subscription'}</td>
                    <td style={{ padding: '12px', color: tx.status === 'success' ? 'green' : 'red' }}>{tx.status || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {transactions.length === 0 && (
            <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No transactions found.</p>
          )}
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>Activity Logs</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="all">All Actions</option>
            <option value="profile_create">Profile Created</option>
            <option value="profile_update">Profile Updated</option>
            <option value="profile_delete">Profile Deleted</option>
            <option value="membership_update">Membership Updated</option>
            <option value="toggle_active">Account Toggled</option>
            <option value="toggle_hidden">Profile Toggled</option>
            <option value="admin_login">Admin Login</option>
            <option value="admin_logout">Admin Logout</option>
          </select>
          <input type="text" placeholder="Search logs..." value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} style={{ padding: '12px', width: '300px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <button onClick={() => setRefresh(!refresh)} style={{ padding: '12px 24px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Timestamp</th>
                <th style={{ padding: '12px' }}>Action</th>
                <th style={{ padding: '12px' }}>Details</th>
                <th style={{ padding: '12px' }}>Site</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '12px' }}>
                    {new Date(log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px' }}>{log.action}</td>
                  <td style={{ padding: '12px' }}>{JSON.stringify(log.details).slice(1, -1).replace(/"/g, '') || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{log.siteId || 'Main'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No activity logs found.</p>
          )}
        </div>
      </div>
    </div>
  );
}