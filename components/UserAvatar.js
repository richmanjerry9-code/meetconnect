// components/UserAvatar.js
import Image from 'next/image';
import getProfilePic from '../utils/getProfilePic'; // your util to get pics

export default function UserAvatar({ profile, size = 100 }) {
  // Get the profile pic or fallback
  const src = profile?.profilePic ? getProfilePic(profile.profilePic) : '/default-profile.png';

  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
      <Image
        src={src}
        alt={profile?.name || 'User Avatar'}
        width={size}
        height={size}
        className="rounded-full"
        unoptimized // optional: remove if using Next.js Image Optimization
        onError={(e) => {
          e.currentTarget.src = '/default-profile.png'; // fallback if image fails
        }}
      />
    </div>
  );
}
