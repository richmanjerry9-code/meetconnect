import { useState, useEffect } from "react";
import Image from "next/image";
import styles from "../../styles/chat.module.css";

export default function ChatHeader({ otherUser, onBack, onProfileClick }) {
  const [imgSrc, setImgSrc] = useState("/default-avatar.png");

  useEffect(() => {
    if (otherUser?.profilePic && otherUser.profilePic.trim() !== "") {
      setImgSrc(otherUser.profilePic);
    } else {
      setImgSrc("/default-avatar.png");
    }
  }, [otherUser]);

  return (
    <header className={styles.chatHeader}>
      <div className={styles.headerLeftSection}>
        {/* 1. Back Arrow */}
        <button onClick={onBack} className={styles.backBtn} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* 2. Profile + Name (Clickable Group) */}
        <div
          className={styles.headerUserGroup}
          onClick={onProfileClick}
          role="button"
          tabIndex={0}
        >
          <div className={styles.avatarWrapper}>
            <Image
              src={imgSrc}
              width={38}
              height={38}
              alt="Avatar"
              className={styles.headerPic}
              onError={() => setImgSrc("/default-avatar.png")}
            />
          </div>

          <div className={styles.headerTextInfo}>
            <span className={styles.headerName}>
              {otherUser?.name || "User"}
            </span>
            <span className={styles.headerStatus}>online</span>
          </div>
        </div>
      </div>

      {/* 3. Optional: Right side icons (Call, Video, etc.) */}
      <div className={styles.headerIconsRight}>
        {/* Add more buttons here if needed */}
      </div>
    </header>
  );
}