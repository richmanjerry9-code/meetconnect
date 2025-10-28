import { memo } from 'react';
import Image from 'next/image';
import styles from '../styles/Home.module.css';

const ProfileCard = memo(({ p, router }) => {
  const {
    username = '',
    profilePic = null,
    name = 'Anonymous Lady',
    membership = 'Regular',
    verified = false,
    area = '',
    ward = '',
    county = 'Nairobi',
    services = [],
    phone = ''
  } = p;

  const handleClick = () => {
    if (!username.trim()) {
      alert('This profile lacks a username. Please update it in Profile Setup.');
      return;
    }
    router.push(`/view-profile/${encodeURIComponent(username)}`);
  };

  const handleImageError = (e) => {
    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
  };

  return (
    <div className={styles.profileCard} onClick={handleClick} role="listitem">
      <div className={styles.imageContainer}>
        <Image 
          src={profilePic || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='} 
          alt={`${name} Profile`} 
          width={150} 
          height={150} 
          className={styles.profileImage}
          loading="lazy"
          onError={handleImageError}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8Alt4mM5mC4RnhUFm0GM1iWySHWP/AEYX/xAAUEQEAAAAAAAAAAAAAAAAAAAAQ/9oADAMBAAIAAwAAABAL/ztt/8QAGxABAAIDAQAAAAAAAAAAAAAAAQACEhEhMVGh/9oACAEBAAE/It5l0M8wCjQ7Yg6Q6q5h8V4f/2gAIAQMBAT8B1v/EABYRAQEBAAAAAAAAAAAAAAAAAAERIf/aAAgBAgEBPwGG/8QAJBAAAQMCAwQDAAAAAAAAAAAAAAARESExQVFhcYHh8EHR0f/aAAwDAQACEAMAAAAQ+9P/2gAIAQMBAT8Q4v/EABkRAQADAQEAAAAAAAAAAAAAAABESEhQdHw/9oACAECAQE/EMkY6H/8QAAaEAEAAwEBAQAAAAAAAAAAAAABAhEhMUFRwdHw/9oADABGAAMAABAMG1v/2Q==" 
        />
        {verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
      </div>
      <div className={styles.profileInfo}>
        <h3>{name}</h3>
        {membership !== 'Regular' && <span className={`${styles.badge} ${styles[membership.toLowerCase()]}`}>{membership}</span>}
      </div>
      <p className={styles.location}>{area || ward || county}</p>
      {services?.length > 0 && (
        <div className={styles.services}>
          {services.slice(0, 3).map((s, idx) => <span key={idx} className={styles.serviceTag}>{s}</span>)}
          {services.length > 3 && <span className={styles.moreTags}>+{services.length - 3}</span>}
        </div>
      )}
      {phone && <p><a href={`tel:${phone}`} className={styles.phoneLink}>{phone}</a></p>}
    </div>
  );
});

export default ProfileCard;
