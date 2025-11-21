// pages/view-profile/[username].js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { db } from '../../lib/firebase.js';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ViewProfile() {
  const router = useRouter();
  const { username } = router.query;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    const fetchProfile = async () => {
      try {
        const q = query(collection(db, 'profiles'), where('username', '==', username));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const found = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
          setProfile(found);
        } else {
          setProfile('notfound');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setProfile('notfound');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: 50 }}>Loading profile...</p>;
  }

  if (profile === 'notfound') {
    return (
      <div style={{ textAlign: 'center', marginTop: 50 }}>
        <h1>Profile Not Found</h1>
        <button onClick={() => router.push('/')} style={btnStyle}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 20 }}>
      <button onClick={() => router.push('/')} style={backBtn}>
        ← Back
      </button>

      <div style={cardStyle}>
        {profile.profilePic ? (
          <Image
            src={profile.profilePic}
            alt={profile.name}
            width={200}
            height={200}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div style={placeholderPic}>No Picture</div>
        )}

        <h1 style={{ color: '#e91e63', marginTop: 10 }}>{profile.name}</h1>
        <p>@{profile.username}</p>

        <p style={infoText}>
          <b>Gender:</b> {profile.gender || 'N/A'} <br />
          <b>Orientation:</b> {profile.sexualOrientation || 'N/A'} <br />
          <b>Age:</b> {profile.age || 'N/A'} <br />
          <b>Nationality:</b> {profile.nationality || 'N/A'} <br />
          <b>County:</b> {profile.county || 'N/A'} <br />
          <b>Ward:</b> {profile.ward || 'N/A'} <br />
          <b>Area:</b> {profile.area || 'N/A'} <br />
        </p>

        {profile.nearby?.length > 0 && (
          <div style={{ marginBottom: 15 }}>
            <b>Nearby:</b>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {profile.nearby.map((n, i) => (
                <span key={i} style={tagStyle}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.services?.length > 0 && (
          <div style={{ marginBottom: 15 }}>
            <b>Services:</b>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {profile.services.map((s, i) => (
                <span key={i} style={tagStyle}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {(profile.incallsRate || profile.outcallsRate) && (
          <div style={{ marginBottom: 15 }}>
            <b>Rates:</b>
            <p>
              {profile.incallsRate && `Incalls: KSh ${profile.incallsRate}/hr`} <br />
              {profile.outcallsRate && `Outcalls: KSh ${profile.outcallsRate}/hr`}
            </p>
          </div>
        )}

        {profile.phone && (
          <div>
            <a href={`tel:${profile.phone}`} style={callBtn}>
              📞 Call {profile.phone}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'white',
  borderRadius: 15,
  padding: 20,
  textAlign: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
};

const placeholderPic = {
  width: 200,
  height: 200,
  borderRadius: '50%',
  background: '#ffe6ee',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#e91e63',
  fontWeight: 'bold',
};

const tagStyle = {
  background: '#ffe6ee',
  color: '#e91e63',
  padding: '5px 10px',
  borderRadius: 10,
  fontSize: 14,
};

const infoText = {
  textAlign: 'left',
  marginTop: 20,
  lineHeight: 1.8,
};

const callBtn = {
  display: 'inline-block',
  background: '#e91e63',
  color: 'white',
  padding: '10px 20px',
  borderRadius: 10,
  textDecoration: 'none',
  fontWeight: 'bold',
};

const btnStyle = {
  background: '#e91e63',
  color: 'white',
  padding: '8px 20px',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  marginTop: 20,
};

const backBtn = {
  background: 'transparent',
  border: 'none',
  color: '#e91e63',
  fontSize: 16,
  cursor: 'pointer',
  marginBottom: 15,
};
