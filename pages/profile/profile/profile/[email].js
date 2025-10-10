import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function ProfilePage() {
  const router = useRouter();
  const { email } = router.query;
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!email) return;
    const profiles = JSON.parse(localStorage.getItem('profiles') || '[]');
    const found = profiles.find((p) => p.email === email);
    if (found) setProfile(found);
  }, [email]);

  if (!profile) {
    return (
      <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif' }}>
        <p style={{ color: '#777' }}>Profile not found.</p>
        <button onClick={() => router.push('/')} style={btnStyle}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif', minHeight: '100vh', background: 'linear-gradient(to bottom right,#fff5f7,#ffe6ee)' }}>
      <button onClick={() => router.push('/')} style={{ ...btnStyle, marginBottom: 20 }}>
        ⬅ Back
      </button>
      <div style={{ maxWidth: 400, margin: '0 auto', background: '#fff', padding: 30, borderRadius: 20, textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
        {profile.profilePic ? (
          <Image
            src={profile.profilePic}
            alt={profile.name || 'Profile'}
            width={120}
            height={120}
            style={{ borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }}
          />
        ) : (
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#ffe6ee', margin: '0 auto 10px' }} />
        )}
        <h2 style={{ color: '#e91e63', margin: '10px 0' }}>{profile.name}</h2>
        <p style={{ fontSize: 14, color: '#555', margin: '4px 0' }}>
          {profile.area || profile.city || 'Nairobi'}, {profile.county || ''}
        </p>
        {profile.phone && (
          <p style={{ margin: '6px 0' }}>
            <a href={`tel:${profile.phone}`} style={{ color: '#e91e63', textDecoration: 'underline' }}>
              {profile.phone}
            </a>
          </p>
        )}
        {profile.services && profile.services.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {profile.services.map((s, idx) => (
              <span
                key={idx}
                style={{ display: 'inline-block', margin: '3px 5px', padding: '3px 7px', background: '#ffe6ee', borderRadius: 5, fontSize: 12 }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  background: '#e91e63',
  color: 'white',
  border: 'none',
  padding: '8px 15px',
  borderRadius: 10,
  cursor: 'pointer',
};

