import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Nairobi } from '../data/locations';

const ADMIN_PASSWORD = '447962Pa$$word';

const parseCSV = (text) => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.reduce((obj, h, i) => {
      obj[h] = values[i] || '';
      return obj;
    }, {});
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
    setCurrentViewers(prev => prev + 1);
    window.addEventListener('beforeunload', () => setCurrentViewers(prev => Math.max(prev - 1, 0)));
    return () => window.removeEventListener('beforeunload', () => {});
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
    setForm(prev => {
      if (type === 'checkbox' && name === 'services') {
        const services = checked ? [...prev.services, value] : prev.services.filter(s => s !== value);
        return { ...prev, services };
      } else if (type === 'checkbox' && name === 'nearby') {
        const nearby = checked ? [...prev.nearby, value].slice(0, 4) : prev.nearby.filter(n => n !== value);
        return { ...prev, nearby };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleProfilePic = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setForm(prev => ({ ...prev, profilePic: e.target.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!form.username) {
      alert('Username is required!');
      return;
    }
    const existing = JSON.parse(localStorage.getItem('profiles') || '[]');
    if (existing.find(u => u.username === form.username)) {
      alert('Username already exists!');
      return;
    }
    const newUsers = [...existing, form];
    localStorage.setItem('profiles', JSON.stringify(newUsers));
    setUsers(newUsers);
    setForm({
      username: '', email: '', phone: '', role: 'User', membership: 'Regular',
      name: '', gender: '', age: '', nationality: '', county: '', ward: '',
      area: '', nearby: [], services: [], otherServices: '', incallRate: '', outcallRate: '', profilePic: null,
    });
    setRefresh(!refresh);
  };

  const handleDelete = (username) => {
    if (!confirm('Delete this profile?')) return;
    const newUsers = users.filter(u => u.username !== username);
    localStorage.setItem('profiles', JSON.stringify(newUsers));
    setUsers(newUsers);
    setRefresh(!refresh);
  };

  const handleUpload = () => {
    if (!uploadFile) return alert('No file selected!');
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parseCSV(e.target.result);
      const newUsers = [...users, ...data];
      localStorage.setItem('profiles', JSON.stringify(newUsers));
      setUsers(newUsers);
      setUploadFile(null);
      setRefresh(!refresh);
    };
    reader.readAsText(uploadFile);
  };

  const wards = Nairobi ? Object.keys(Nairobi) : [];
  const areasForWard = form.ward && Nairobi ? Nairobi[form.ward] : [];

  if (!loggedIn) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial', background: '#f0f0f0', textAlign: 'center' }}>
        <Head>
          <title>Admin Login</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <h1>Admin Login</h1>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          style={{ padding: '10px', margin: '10px', width: '200px' }}
        />
        <button onClick={handleLogin} style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none' }}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', background: '#f0f0f0' }}>
      <Head>
        <title>Admin Panel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <h1>Admin Panel</h1>
      <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#f44336', color: 'white', border: 'none' }}>
        Logout
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', margin: '20px 0' }}>
        <div style={{ background: '#fff', padding: '10px' }}>Total Profiles: {users.length}</div>
        <div style={{ background: '#fff', padding: '10px' }}>Users: {users.filter(u => u.role === 'User').length}</div>
        <div style={{ background: '#fff', padding: '10px' }}>Admins: {users.filter(u => u.role === 'Admin').length}</div>
        <div style={{ background: '#fff', padding: '10px' }}>Current Viewers: {currentViewers}</div>
        <div style={{ background: '#fff', padding: '10px' }}>All-Time Visits: {allVisits.length}</div>
      </div>
      <div style={{ background: '#fff', padding: '20px', marginBottom: '20px' }}>
        <h2>Create Profile</h2>
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <select name="role" value={form.role} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }}>
          <option>User</option>
          <option>Admin</option>
        </select>
        <select name="membership" value={form.membership} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }}>
          <option>Regular</option>
          <option>VIP</option>
          <option>VVIP</option>
        </select>
        <input name="name" placeholder="Name" value={form.name} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <select name="gender" value={form.gender} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }}>
          <option value="">Select Gender</option>
          <option>Male</option>
          <option>Female</option>
        </select>
        <input name="age" type="number" placeholder="Age" value={form.age} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <input name="nationality" placeholder="Nationality" value={form.nationality} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <input name="county" placeholder="County" value={form.county} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <select name="ward" value={form.ward} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }}>
          <option value="">Select Ward</option>
          {wards.map(w => <option key={w}>{w}</option>)}
        </select>
        {form.ward && (
          <select name="area" value={form.area} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }}>
            <option value="">Select Area</option>
            {areasForWard.map(a => <option key={a}>{a}</option>)}
          </select>
        )}
        {form.ward && areasForWard.map(place => (
          <div key={place} style={{ margin: '5px 0' }}>
            <input type="checkbox" name="nearby" value={place} checked={form.nearby.includes(place)} onChange={handleChange} />
            <span>{place}</span>
          </div>
        ))}
        {servicesList.map(service => (
          <div key={service} style={{ margin: '5px 0' }}>
            <input type="checkbox" name="services" value={service} checked={form.services.includes(service)} onChange={handleChange} />
            <span>{service}</span>
          </div>
        ))}
        {form.services.includes('Other Services') && (
          <input name="otherServices" placeholder="Other Services" value={form.otherServices} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        )}
        <input name="incallRate" type="number" placeholder="Incall Rate" value={form.incallRate} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <input name="outcallRate" type="number" placeholder="Outcall Rate" value={form.outcallRate} onChange={handleChange} style={{ padding: '10px', margin: '5px 0', width: '200px' }} />
        <label style={{ display: 'block', margin: '5px 0' }}>
          <input type="file" accept="image/*" onChange={handleProfilePic} style={{ display: 'none' }} />
          <div style={{ width: '120px', height: '120px', border: '2px dashed #000', textAlign: 'center', lineHeight: '120px' }}>
            {form.profilePic ? <Image src={form.profilePic} alt="Profile" width={120} height={120} /> : 'Upload Pic'}
          </div>
        </label>
        <button onClick={handleSave} style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none' }}>
          Save
        </button>
      </div>
      <div style={{ background: '#fff', padding: '20px', marginBottom: '20px' }}>
        <h2>Bulk Upload</h2>
        <input type="file" accept=".csv" onChange={(e) => setUploadFile(e.target.files[0])} />
        <button onClick={handleUpload} style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none' }}>
          Upload
        </button>
      </div>
      <div style={{ background: '#fff', padding: '20px' }}>
        <h2>All Users</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#ddd' }}>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Username</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Email</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Phone</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Role</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Membership</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Name</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>County</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Ward</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.username}>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{u.username}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{u.email || 'N/A'}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{u.phone}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{u.role}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{u.membership || 'Regular'}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{u.name}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{u.county}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{u.ward}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                  <button onClick={() => setForm(u)} style={{ padding: '5px 10px', background: '#2196F3', color: 'white', border: 'none' }}>Edit</button>
                  <button onClick={() => handleDelete(u.username)} style={{ padding: '5px 10px', background: '#f44336', color: 'white', border: 'none', marginLeft: '5px' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}