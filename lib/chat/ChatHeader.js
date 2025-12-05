// /lib/chat/ChatHeader.js  (or wherever it is)
import Image from "next/image";
import styles from "../../styles/chat.module.css";

const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDIiIGhlaWdodD0iNDIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2RkZCIgcng9IjIxIiByeT0iMjEiLz48Y2lyY2xlIGN4PSIyMSIgb3N2ZyI+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5LjUiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIFBpYzwvdGV4dD48L3N2Zz4=";

export default function ChatHeader({ otherUser, onBack, onProfileClick }) {
  const hasProfile = !!onProfileClick;   // true only if profile exists

  return (
    <div className={styles.chatHeader}>
      <button onClick={onBack} className={styles.backBtn}>←</button>

      <div
        className={styles.headerUser}
        onClick={hasProfile ? onProfileClick : undefined}
        style={{ 
          cursor: hasProfile ? "pointer" : "default",
          opacity: hasProfile ? 1 : 0.6   // slightly grayed if no profile
        }}
        role={hasProfile ? "button" : undefined}
        aria-label={hasProfile ? "View profile" : undefined}
      >
        <Image
          src={otherUser?.profilePic || placeholderSvg}
          width={42}
          height={42}
          alt=""
          className={styles.headerPic}
          unoptimized
        />

        <div className={styles.headerInfo}>
          <span className={styles.headerName}>
            {otherUser?.name || "User"}
            {!hasProfile && " (no profile)"}
          </span>
        </div>
      </div>
    </div>
  );
}

