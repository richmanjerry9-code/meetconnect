// components/Navbar.js
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

export default function Navbar() {
  const router = useRouter();

  return (
    <nav className={styles.navbar}>
      <h1 onClick={() => router.push('/')} className={styles.navTitle}>
        MeetConnect ❤️
      </h1>
      <div className={styles.navLinks}>
        <button onClick={() => router.push('/profile-setup')} className={styles.button}>
          Profile
        </button>
        <button onClick={() => router.push('/')} className={styles.button}>
          Home
        </button>
      </div>
    </nav>
  );
}
