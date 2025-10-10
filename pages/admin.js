import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Nairobi } from '../data/locations';

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
      <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif' }}>
        <h1>Admin Login</h1>
        <input
          type='password'
          placeholder='Admin password'
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          style={inputStyle}
        />
        <button onClick={handleLogin} style={btnStyle}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif', background: '#f8f4ff', minHeight: '100vh' }}>
      <h1 style={{ color: '#6a0dad' }}>Admin Panel</h1>
      <button
        onClick={handleLogout}
        style={{ ...btnStyle, background: '#e91e63', marginBottom: 20 }}
      >
        Logout
      </button>
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div style={statCardStyle}>Total Profiles: {users.length}</div>
        <div style={statCardStyle}>Users: {users.filter((u) => u.role === 'User').length}</div>
        <div style={statCardStyle}>Admins: {users.filter((u) => u.role === 'Admin').length}</div>
        <div style={statCardStyle}>Current Viewers: {currentViewers}</div>
        <div style={statCardStyle}>All-Time Visits: {allVisits.length}</div>
      </div>
      <div style={formContainerStyle}>
        <h2 style={{ color: '#6a0dad' }}>Create / Edit Profile</h2>
        <input name='username' placeholder='Username' value={form.username} onChange={handleChange} style={inputStyle} />
        <input name='email' placeholder='Email (optional)' value={form.email} onChange={handleChange} style={inputStyle} />
        <input name='phone' placeholder='Phone' value={form.phone} onChange={handleChange} style={inputStyle} />
        <select name='role' value={form.role} onChange={handleChange} style={inputStyle}>
          <option>User</option>
          <option>Admin</option>
        </select>
        <select name='membership' value={form.membership} onChange={handleChange} style={inputStyle}>
          <option>VVIP</option>
          <option>VIP</option>
          <option>Prime</option>
          <option>Regular</option>
        </select>
        <input name='name' placeholder='Full Name' value={form.name} onChange={handleChange} style={inputStyle} />
        <select name='gender' value={form.gender} onChange={handleChange} style={inputStyle}>
          <option value=''>Select Gender</option>
          <option>Male</option>
          <option>Female</option>
        </select>
        <input name='age' type='number' placeholder='Age' value={form.age} onChange={handleChange} style={inputStyle} />
        <input name='nationality' placeholder='Nationality' value={form.nationality} onChange={handleChange} style={inputStyle} />
        <input name='county' placeholder='County' value={form.county} onChange={handleChange} style={inputStyle} />
        <select name='ward' value={form.ward} onChange={handleChange} style={inputStyle}>
          <option value=''>Select Ward</option>
          {wards.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        {form.ward && (
          <select name='area' value={form.area} onChange={handleChange} style={inputStyle}>
            <option value=''>Select Area</option>
            {areasForWard.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        )}
        {form.area && (
          <div style={{ textAlign: 'left', margin: '10px 0' }}>
            <label>Nearby Places (max 4)</label>
            {areasForWard.map((place) => (
              <div key={place}>
                <input
                  type='checkbox'
                  name='nearby'
                  value={place}
                  checked={form.nearby.includes(place)}
                  onChange={handleChange}
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
                checked={form.services.includes(s)}
                onChange={handleChange}
              />
              <span style={{ marginLeft: 5 }}>{s}</span>
            </div>
          ))}
          {form.services.includes('Other Services') && (
            <input
              name='otherServices'
              placeholder='Other Services'
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
        <label style={{ display: 'block', margin: '10px 0', cursor: 'pointer' }}>
          <div style={profilePicStyle}>
            {form.profilePic ? (
              <Image
                src={form.profilePic}
                alt='Profile'
                width={120}
                height={120}
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <span>Click to add pic</span>
            )}
          </div>
          <input
            type='file'
            accept='image/*'
            onChange={handleProfilePic}
            style={{ display: 'none' }}
          />
        </label>
        <button type='button' onClick={handleSave} style={btnStyle}>
          Save Profile
        </button>
      </div>
      <div style={formContainerStyle}>
        <h2 style={{ color: '#6a0dad' }}>Bulk Upload</h2>
        <input type='file' accept='.csv' onChange={(e) => setUploadFile(e.target.files[0])} />
        <button type='button' onClick={handleUpload} style={{ ...btnStyle, marginTop: 10 }}>
          Upload CSV
        </button>
      </div>
      <div style={formContainerStyle}>
        <h2 style={{ color: '#6a0dad' }}>All Users</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Username</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Membership</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>County</th>
              <th style={thStyle}>Ward</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.username}>
                <td style={tdStyle}>{u.username}</td>
                <td style={tdStyle}>{u.email || 'N/A'}</td>
                <td style={tdStyle}>{u.phone}</td>
                <td style={tdStyle}>{u.role}</td>
                <td style={tdStyle}>{u.membership || 'Regular'}</td>
                <td style={tdStyle}>{u.name}</td>
                <td style={tdStyle}>{u.county}</td>
                <td style={tdStyle}>{u.ward}</td>
                <td style={tdStyle}>
                  <button style={actionBtn} onClick={() => setForm({ ...u })}>
                    Edit
                  </button>
                  <button
                    style={{ ...actionBtn, background: '#e91e63' }}
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
  );
}

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: 8,
  margin: '8px 0',
  borderRadius: 8,
  border: '1px solid #6a0dad',
};
const btnStyle = {
  background: '#6a0dad',
  color: '#fff',
  padding: '8px 15px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
};
const statCardStyle = {
  flex: 1,
  background: '#fff',
  padding: 20,
  borderRadius: 10,
  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
  textAlign: 'center',
  fontWeight: 'bold',
};
const formContainerStyle = {
  background: '#fff',
  padding: 20,
  borderRadius: 10,
  marginBottom: 20,
  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
};
const thStyle = { padding: 10, borderBottom: '1px solid #ccc', textAlign: 'left' };
const tdStyle = { padding: 10, borderBottom: '1px solid #eee' };
const actionBtn = {
  marginRight: 5,
  padding: '4px 8px',
  border: 'none',
  borderRadius: 5,
  background: '#6a0dad',
  color: '#fff',
  cursor: 'pointer',
};
const profilePicStyle = {
  width: 120,
  height: 120,
  background: '#f3e6ff',
  border: '2px dashed #6a0dad',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};