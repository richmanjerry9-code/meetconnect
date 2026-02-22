import { useState, useEffect } from "react";
import Image from "next/image";
import styles from "../../styles/chat.module.css";

export default function ChatHeader({ otherUser, onBack, onProfileClick, isOnline, lastSeen }) {
  const [imgSrc, setImgSrc] = useState(
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iNjAiIHI9IjUwIiBmaWxsPSIjQkRCREJEIiAvPgogIDxwYXRoIGQ9Ik01MCAxNTAgUTEwMCAxMTAgMTUwIDE1MCBRMTUwIDIwMCA1MCAyMDAgWiIgZmlsbD0iI0JEQkRCRCIgLz4KPC9zdmc+Cg=='
  );

  console.log("ChatHeader Props ->", { isOnline, lastSeen });

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return ''; 

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: true 
    });

    // Get today's and yesterday's dates at midnight for an accurate comparison
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Compare the dates
    if (targetDate.getTime() === today.getTime()) {
      return `last seen today at ${timeStr}`;
    } else if (targetDate.getTime() === yesterday.getTime()) {
      return `last seen yesterday at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
      return `last seen ${dateStr} at ${timeStr}`;
    }
  };

  useEffect(() => {
    if (otherUser?.profilePic && otherUser.profilePic.trim() !== "") {
      setImgSrc(otherUser.profilePic);
    } else {
      setImgSrc(
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iNjAiIHI9IjUwIiBmaWxsPSIjQkRCREJEIiAvPgogIDxwYXRoIGQ9Ik01MCAxNTAgUTEwMCAxMTAgMTUwIDE1MCBRMTUwIDIwMCA1MCAyMDAgWiIgZmlsbD0iI0JEQkRCRCIgLz4KPC9zdmc+Cg=='
      );
    }
  }, [otherUser]);

  return (
    <header className={styles.chatHeader}>
      <div className={styles.headerLeftSection}>
        <button onClick={onBack} className={styles.backBtn} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className={styles.headerUserGroup} onClick={onProfileClick} role="button" tabIndex={0}>
          <div className={styles.avatarWrapper}>
            <Image
              src={imgSrc}
              width={38}
              height={38}
              alt="Avatar"
              className={styles.headerPic}
              onError={() => setImgSrc(
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iNjAiIHI9IjUwIiBmaWxsPSIjQkRCREJEIiAvPgogIDxwYXRoIGQ9Ik01MCAxNTAgUTEwMCAxMTAgMTUwIDE1MCBRMTUwIDIwMCA1MCAyMDAgWiIgZmlsbD0iI0JEQkRCRCIgLz4KPC9zdmc+Cg=='
              )}
            />
          </div>

          <div className={styles.headerTextInfo}>
            <span className={styles.headerName}>
              {otherUser?.name || "User"}
            </span>
            <span className={styles.headerStatus}>
              {isOnline ? "online" : formatLastSeen(lastSeen)}
            </span>
          </div>
        </div>
      </div>
      <div className={styles.headerIconsRight}></div>
    </header>
  );
}