import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Nairobi } from '../data/locations';
import { db } from '../firebase';
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
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [lastEdit, setLastEdit] = useState(null);
  const [globalMenuOpen, setGlobalMenuOpen] = useState(false);
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
        const fakePassword = form.password || Math.random().toString(36).slice(-8);

        const profileData = {
          ...form,
          email: fakeEmail,
          password: fakePassword,
          createdAt: Date.now(),
          sexualOrientation: '',
          incallsRate: form.incallsRate,
          outcallsRate: form.outcallsRate,
          county: form.county || 'Nairobi',
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
      setDeletedUsers((prev) => [...prev, userToDelete]);
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
      alert(`Membership updated to ${newMembership} for ${users.find((u) => u.id === userId)?.username}!`);
      setRefresh(!refresh);
    } catch (error) {
      console.error('Error updating membership:', error);
      alert('Failed to update membership.');
    }
  };

  const handleEdit = (user) => {
    setForm({
      ...user,
      services: user.services || [],
      nearby: user.nearby || [],
    });
    setIsEdit(true);
    setEditId(user.id);
    setLastEdit({ userId: user.id, previousData: { ...user } });
  };

  if (!loggedIn) {
    return (
      <div style={{ textAlign: 'center', padding: '10px' }}>
        <Head>
          <title>Admin Login</title>
        </Head>
        <h1>Admin Login</h1>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="Enter Admin Password"
          style={{ padding: '8px', margin: '5px' }}
        />
        <button onClick={handleLogin} style={{ padding: '8px 16px' }}>
          Login
        </button>
      </div>
    );
  }

  const wards = Nairobi ? Object.keys(Nairobi) : [];
  const areasForWard = form.ward && Nairobi ? Nairobi[form.ward] : [];

  return (
    <div style={{ padding: '10px', fontFamily: 'Arial' }}>
      <Head>
        <title>Admin Panel</title>
      </Head>

      <h1 style={{ textAlign: 'center' }}>Admin Panel</h1>

      <button
        onClick={handleLogout}
        style={{ background: '#f44336', color: 'white', padding: '8px', border: 'none' }}
      >
        Logout
      </button>

      <div style={{ background: '#fff', padding: '10px', marginTop: '10px' }}>
        <h2>Create Profile</h2>

        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} />
        <input name="email" placeholder="Email (optional)" value={form.email} onChange={handleChange} />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
        <input name="password" placeholder="Password (optional)" value={form.password || ''} onChange={handleChange} />
        <button onClick={handleSave}>Save</button>
      </div>

      <div style={{ background: '#fff', padding: '10px', marginTop: '10px' }}>
        <h2>All Users</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#ddd' }}>
              <th>Username</th>
              <th>Email</th>
              <th>Password</th>
              <th>Phone</th>
              <th>Membership</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username || 'N/A'}</td>
                <td>{u.email || 'N/A'}</td>
                <td>{u.password || 'N/A'}</td>
                <td>{u.phone || 'N/A'}</td>
                <td>{u.membership || 'Regular'}</td>
                <td>
                  <button onClick={() => handleEdit(u)}>Edit</button>
                  <button onClick={() => handleDelete(u.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

