import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function ViewProfile() {
  const router = useRouter();
  const { username } = router.query;
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (username) {
      const profiles = JSON.parse(localStorage.getItem('profiles') || '[]');
      const foundProfile = profiles.find((p) => p.username === username);
      if (foundProfile) {
        setProfile(foundProfile);
      } else {
        router.push('/404');
      }
    }
  }, [username, router]);

  if (!profile) {
    return <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Poppins, sans-serif', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ color: '#e91e63', textAlign: 'center' }}>Profile Details: {profile.name || profile.username}</h1>
      <div style={{ background: '#fff', padding: 20, borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
        {profile.profilePic && (
          <Image
            src={profile.profilePic}
            alt={profile.name || 'Profile'}
            width={150}
            height={150}
            style={{ objectFit: 'cover', borderRadius: 10, marginBottom: 15, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
          />
        )}
        <p>
          <strong>Username:</strong> {profile.username}
        </p>
        <p>
          <strong>Email:</strong> {profile.email || 'N/A'}
        </p>
        <p>
          <strong>Phone:</strong>{' '}
          {profile.phone ? (
            <a href={`tel:${profile.phone}`} style={{ color: '#e91e63', textDecoration: 'underline' }}>
              {profile.phone}
            </a>
          ) : (
            'N/A'
          )}
        </p>
        <p>
          <strong>Membership:</strong> {profile.membership || 'Regular'}
        </p>
        <p>
          <strong>Name:</strong> {profile.name || 'N/A'}
        </p>
        <p>
          <strong>Gender:</strong> {profile.gender || 'N/A'}
        </p>
        <p>
          <strong>Age:</strong> {profile.age || 'N/A'}
        </p>
        <p>
          <strong>Nationality:</strong> {profile.nationality || 'N/A'}
        </p>
        <p>
          <strong>County:</strong> {profile.county || 'N/A'}
        </p>
        <p>
          <strong>Ward:</strong> {profile.ward || 'N/A'}
        </p>
        <p>
          <strong>Area:</strong> {profile.area || 'N/A'}
        </p>
        <p>
          <strong>Nearby Places:</strong> {profile.nearby?.join(', ') || 'N/A'}
        </p>
        <p>
          <strong>Services:</strong> {profile.services?.join(', ') || 'N/A'}
        </p>
        {profile.otherServices && (
          <p>
            <strong>Other Services:</strong> {profile.otherServices}
          </p>
        )}
        <p>
          <strong>Incall Rate:</strong> {profile.incallRate ? `${profile.incallRate} KSh/hr` : 'N/A'}
        </p>
        <p>
          <strong>Outcall Rate:</strong> {profile.outcallRate ? `${profile.outcallRate} KSh/hr` : 'N/A'}
        </p>
      </div>
      <button
        onClick={() => router.push('/')}
        style={{ background: '#e91e63', color: '#fff', padding: '8px 15px', borderRadius: 8, border: 'none', cursor: 'pointer', marginTop: 15, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
      >
        Back to Home
      </button>
    </div>
  );
}