// /lib/chat/ChatHeader.js
import Image from "next/image";
import styles from "../../styles/chat.module.css";

export default function ChatHeader({ otherUser, onBack, onProfileClick }) {
  const avatarSrc =
    otherUser?.profilePic && otherUser.profilePic.trim() !== ""
      ? otherUser.profilePic
      : "/default-avatar.png";

  return (
    <div className={styles.chatHeader}>
      {/* Back */}
      <button onClick={onBack} className={styles.backBtn}>
        ←
      </button>

      {/* Clickable Profile Area */}
      <div
        className={styles.headerUser}
        onClick={onProfileClick}
        role="button"
        aria-label="View profile"
        style={{ cursor: "pointer" }}
      >
        <Image
          src={avatarSrc}
          width={42}
          height={42}
          alt="Profile picture"
          className={styles.headerPic}
          onError={(e) => {
            e.currentTarget.src = "/default-avatar.png";
          }}
        />

        <div className={styles.headerInfo}>
          <span className={styles.headerName}>
            {otherUser?.name || "User"}
          </span>
        </div>
      </div>
    </div>
  );
}
