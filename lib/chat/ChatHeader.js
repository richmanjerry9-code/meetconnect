// chatheader.js
import Image from "next/image";
import styles from "../../styles/chat.module.css";

export default function ChatHeader({ otherUser, onBack, onProfileClick, onDeleteChat }) {
  return (
    <div className={styles.chatHeader}>
      <button onClick={onBack} className={styles.backBtn}>←</button>
      <div
        className={styles.headerUser}
        onClick={onProfileClick}
        style={{ cursor: "pointer" }}
      >
        <Image
          src={otherUser?.profilePic || "/placeholder.jpg"}
          width={42}
          height={42}
          alt="Profile"
          className={styles.headerPic}
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


