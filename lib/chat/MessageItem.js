// messageitems.js (updated calls with checks, fix seen ticks, add quoted display, pinned indicator, swipe calls onReply(id))
import { useState, useRef } from "react";
import Image from "next/image";
import styles from "../../styles/chat.module.css";

export default function MessageItem({
  message,
  isOwn,
  quotedMessage,
  isPinned,
  onDelete,
  onReply,
  onPin,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [highlight, setHighlight] = useState(false);

  // Use refs for touch handling
  const touchTimeout = useRef(null);
  const touchStartX = useRef(0);

  const handleTouchStart = () => {
    touchTimeout.current = setTimeout(() => setShowMenu(true), 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    clearTimeout(touchTimeout.current);
  };

  const handleTouchMove = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    // Cancel long press if moved significantly
    if (Math.abs(diff) > 20) {
      clearTimeout(touchTimeout.current);
    }

    if (diff > 50) { // Swipe left > 50px
      setHighlight(true);
      if (onReply) onReply(message.id); // Trigger reply
      setTimeout(() => setHighlight(false), 1000); // Reset highlight after 1s
    } else if (touchEndX - touchStartX.current > 50) { // Swipe right
      // Optional: Other action
    }
  };

  const handleTouchStartCoord = (e) => {
    touchStartX.current = e.touches[0].clientX;
    handleTouchStart();
  };

  return (
    <div
      className={`${styles.messageRow} ${
        isOwn ? styles.ownRow : styles.otherRow
      } ${highlight ? styles.highlighted : ''}`}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }} // Right-click for menu
      onTouchStart={handleTouchStartCoord}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* MESSAGE BUBBLE */}
      <div
        className={`${styles.bubble} ${
          isOwn ? styles.ownBubble : styles.otherBubble
        } ${isOwn ? styles.messageRight : styles.messageLeft}`}
        style={{ maxWidth: '80%' }}
      >
        {/* PINNED INDICATOR */}
        {isPinned && <span className={styles.pinned}>📌</span>}

        {/* QUOTED MESSAGE IF REPLYING */}
        {quotedMessage && (
          <div className={styles.quoted}>
            <p>{quotedMessage.text || (quotedMessage.imageUrl ? "(Image)" : "")}</p>
          </div>
        )}

        {message.imageUrl && (
          <Image
            src={message.imageUrl}
            alt="Chat"
            width={220}
            height={220}
            className={styles.chatImage}
          />
        )}

        {message.text && <p className={styles.messageText}>{message.text}</p>}

        {/* MESSAGE TIME */}
        <div className={styles.messageTime}>
          {message.timestamp?.toDate?.().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }) || ""}
        </div>

        {/* MESSAGE TICKS (single for sent, double for seen by recipient) */}
        {isOwn && (
          <span className={styles.tick}>
            {message.seenBy?.length > 1 ? "✅✅" : "✅"}
          </span>
        )}
      </div>

      {/* MENU (shown on long press or click) */}
      {showMenu && (
        <div className={styles.messageMenu}>
          <button onClick={() => { console.log('Reply clicked'); if (onReply) onReply(message.id); setShowMenu(false); }}>Reply to this message</button>
          <button onClick={() => { console.log('Delete for me clicked'); if (onDelete) onDelete(message.id, false); setShowMenu(false); }}>Delete for me</button>
          <button onClick={() => { console.log('Delete for everyone clicked'); if (onDelete) onDelete(message.id, true); setShowMenu(false); }}>Delete for everyone</button>
          <button onClick={() => { console.log('Pin clicked'); if (onPin) onPin(message.id); setShowMenu(false); }}>Pin message</button>
          <button onClick={() => setShowMenu(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}