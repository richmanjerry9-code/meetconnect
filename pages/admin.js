import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Nairobi } from '../data/locations';
import styles from '../styles/Admin.module.css';

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
    username: '', email: '', phone: '', role: 'User', membership: 'Regular',
    name: '', gender: '', age: '', nationality: '', county: '', ward: '',
    area: '', nearby: [], services: [], otherServices: '', incallRate: '', outcallRate: '', profilePic: null,
  });

  const servicesList = [
    'Dinner Date', 'Travel Companion', 'Lesbian Show', 'Rimming', 'Raw BJ', 'BJ',
    'GFE', 'COB – Cum On Body', 'CIM – Cum In Mouth', '3 Some', 'Anal', 'Massage', 'Other Services',
  ];

  useEffect(() => {
    const storedUsers = JSON.parse(localStorage.getItem('profiles') || '[]');
    setUsers(storedUsers);
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

  const handleSave = () => {
    if (!form.username) {
      alert('Username is required!');
      return;
    }
    const existing = JSON.parse(localStorage.getItem('profiles') || '[]');
    const duplicate = existing.find(
      (u) => u.username === form.username && u.username !== form.username
    );
    if (duplicate) {
      alert('Username already exists!');
      return;
    }
    const updatedUser = { ...form };
    const index = existing.findIndex((u) => u.username === form.username && form.username !== '');
    if (index >= 0) {
      if (existing[index].role === 'Admin' && form.role !== 'Admin') {
        alert('Cannot downgrade Admin role!');
        return;
      }
      existing[index] = updatedUser;
    } else {
      existing.push(updatedUser);
    }
    localStorage.setItem('profiles', JSON.stringify(existing));
    alert('✅ Profile saved successfully!');
    setUsers(existing);
    setForm({
      username: '', email: '', phone: '', role: 'User', membership: 'Regular',
      name: '', gender: '', age: '', nationality: '', county: '', ward: '',
      area: '', nearby: [], services: [], otherServices: '', incallRate: '', outcallRate: '', profilePic: null,
    });
    setRefresh(!refresh);
  };

  const handleDelete = (username) => {
    const existing = JSON.parse(localStorage.getItem('profiles') || '[]');
    const user = existing.find((u) => u.username === username);
    if (user?.role === 'Admin') {
      alert('Cannot delete admin!');
      return;
    }
    if (!confirm('Delete this profile?')) return;
    const filtered = existing.filter((u) => u.username !== username);
    localStorage.setItem('profiles', JSON.stringify(filtered));
    setUsers(filtered);
    setRefresh(!refresh);
  };

  const handleUpload = () => {
    if (!uploadFile) return alert('No file selected!');
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parseCSV(e.target.result);
      const existing = JSON.parse(localStorage.getItem('profiles') || '[]');
      const newUsers = data.filter(
        (newUser) => !existing.some((u) => u.username === newUser.username)
      );
      const allUsers = [...existing, ...newUsers];
      localStorage.setItem('profiles', JSON.stringify(allUsers));
      alert('Bulk upload complete!');
      setUploadFile(null);
      setUsers(allUsers);
      setRefresh(!refresh);
    };
    reader.readAsText(uploadFile);
  };

  const wards = Nairobi ? Object.keys(Nairobi) : [];
  const areasForWard = form.ward && Nairobi ? Nairobi[form.ward] : [];

  if (!loggedIn) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Meetconnect Admin Login</title>
          <meta name="description" content="Admin login for Meetconnect management" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <h1 className={styles.title}>Admin Login</h1>
        <input
          type="password"
          placeholder="Admin password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          className={styles.input}
        />
        <button onClick={handleLogin} className={styles.button}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Meetconnect Admin Panel</title>
        <meta name="description" content="Admin dashboard for managing Meetconnect profiles" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <h1 className={styles.title}>Admin Panel</h1>
      <button onClick={handleLogout} className={`${styles.button} ${styles.logout}`}>
        Logout
      </button>
      <div className={styles.stats}>
        <div className={styles.statCard}>Total Profiles: {users.length}</div>
        <div className={styles.statCard}>Users: {users.filter((u) => u.role === 'User').length}</div>
        <div className={styles.statCard}>Admins: {users.filter((u) => u.role === 'Admin').length}</div>
        <div className={styles.statCard}>Current Viewers: {currentViewers}</div>
        <div className={styles.statCard}>All-Time Visits: {allVisits.length}</div>
      </div>
      <div className={styles.formContainer}>
        <h2>Create / Edit Profile</h2>
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} className={styles.input} />
        <input name="email" placeholder="Email (optional)" value={form.email} onChange={handleChange} className={styles.input} />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} className={styles.input} />
        <select name="role" value={form.role} onChange={handleChange} className={styles.input}>
          <option>User</option>
          <option>Admin</option>
        </select>
        <select name="membership" value={form.membership} onChange={handleChange} className={styles.input}>
          <option>VVIP</option>
          <option>VIP</option>
          <option>Prime</option>
          <option>Regular</option>
        </select>
        <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} className={styles.input} />
        <select name="gender" value={form.gender} onChange={handleChange} className={styles.input}>
          <option value="">Select Gender</option>
          <option>Male</option>
          <option>Female</option>
        </select>
        <input name="age" type="number" placeholder="Age" value={form.age} onChange={handleChange} className={styles.input} />
        <input name="nationality" placeholder="Nationality" value={form.nationality} onChange={handleChange} className={styles.input} />
        <input name="county" placeholder="County" value={form.county} onChange={handleChange} className={styles.input} />
        <select name="ward" value={form.ward} onChange={handleChange} className={styles.input}>
          <option value="">Select Ward</option>
          {wards.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        {form.ward && (
          <select name="area" value={form.area} onChange={handleChange} className={styles.input}>
            <option value="">Select Area</option>
            {areasForWard.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        )}
        {form.ward && (
          <div className={styles.checkboxGroup}>
            <label>Nearby Places (max 4)</label>
            {areasForWard.map((place) => (
              <div key={place}>
                <input
                  type="checkbox"
                  name="nearby"
                  value={place}
                  checked={form.nearby.includes(place)}
                  onChange={handleChange}
                />
                <span>{place}</span>
              </div>
            ))}
          </div>
        )}
        <div className={styles.checkboxGroup}>
          <label>Services Offered</label>
          {servicesList.map((s) => (
            <div key={s}>
              <input
                type="checkbox"
                name="services"
                value={s}
                checked={form.services.includes(s)}
                onChange={handleChange}
              />
              <span>{s}</span>
            </div>
          ))}
          {form.services.includes('Other Services') && (
            <input
              name="otherServices"
              placeholder="Other Services"
              value={form.otherServices}
              onChange={handleChange}
              className={styles.input}
            />
          )}
        </div>
        <input
          name="incallRate"
          type="number"
          placeholder="Incalls Rate (KSh/hr)"
          value={form.incallRate}
          onChange={handleChange}
          className={styles.input}
        />
        <input
          name="outcallRate"
          type="number"
          placeholder="Outcalls Rate (KSh/hr)"
          value={form.outcallRate}
          onChange={handleChange}
          className={styles.input}
        />
        <label className={styles.profilePic}>
          <div>
            {form.profilePic ? (
              <Image
                src={form.profilePic}
                alt="Profile"
                layout="responsive"
                width={100}
                height={100}
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <span>Click to add pic</span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleProfilePic}
            style={{ display: 'none' }}
          />
        </label>
        <button type="button" onClick={handleSave} className={styles.button}>
          Save Profile
        </button>
      </div>
      <div className={styles.formContainer}>
        <h2>Bulk Upload</h2>
        <input type="file" accept=".csv" onChange={(e) => setUploadFile(e.target.files[0])} />
        <button type="button" onClick={handleUpload} className={styles.button}>
          Upload CSV
        </button>
      </div>
      <div className={styles.formContainer}>
        <h2>All Users</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Membership</th>
                <th>Name</th>
                <th>County</th>
                <th>Ward</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.username}</td>
                  <td>{u.email || 'N/A'}</td>
                  <td>{u.phone}</td>
                  <td>{u.role}</td>
                  <td>{u.membership || 'Regular'}</td>
                  <td>{u.name}</td>
                  <td>{u.county}</td>
                  <td>{u.ward}</td>
                  <td>
                    <button className={styles.actionButton} onClick={() => setForm({ ...u })}>
                      Edit
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.delete}`}
                      onClick={() => handleDelete(u.username)}
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