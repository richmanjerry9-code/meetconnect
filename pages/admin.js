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
    const handleUnload = () =>
      setCurrentViewers((prev) => Math.max(prev - 1, 0));
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

  // ✅ Auto fake email + password generator
  const handleSave = async () => {
    if (!form.username) {
      alert('Username is required!');
      return;
    }

    const q = query(
      collection(db, 'profiles'),
      where('username', '==', form.username)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      alert('Username already exists!');
      return;
    }

    const fakeEmail =
      form.email || `${form.username.toLowerCase()}@meetconnect.fake`;
    const fakePassword = Math.random().toString(36).slice(-8);

    const profileData = {
      ...form,
      email: fakeEmail,
      password: fakePassword,
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, 'profiles'), profileData);
      alert(
        `✅ Profile saved!\nFake Email: ${fakeEmail}\nPassword: ${fakePassword}`
      );
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

  // ✅ Delete and refresh from Firestore
  const handleDelete = async (userId) => {
    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) return alert('User not found.');
    if (userToDelete.role === 'Admin')
      return alert('Cannot delete admin account!');
    if (!confirm('Delete this profile?')) return;

    try {
      await deleteDoc(doc(db, 'profiles', userId));
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
    <div style={{ padding: '10px', fontFamily: 'Arial', background: '#f0f0f0' }}>
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
          Save
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
                <td>{u.phone || 'N/A'}</td>
                <td>{u.role || 'User'}</td>
                <td>{u.membership || 'Regular'}</td>
                <td>
                  <button
                    onClick={() => setForm(u)}
                    style={{
                      background: '#2196F3',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      marginRight: '5px',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    style={{
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
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
  );
}

