// lib/groupchat/GroupMessageItem.js
import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import styles from "../../styles/groupchat.module.css";

export default function GroupMessageItem({ 
  message, 
  currentUser, 
  onLocalDelete,
  profilesMap = {}  // ← ADD THIS PROP FROM PARENT
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwn = currentUser?.uid === message.senderId;

  // Get real profile data
  const profile = profilesMap[message.senderId] || {};
  const senderName = profile.name || message.senderName || "User";
  const senderPhoto = profile.photoURL || message.senderPhoto || "/default-profile.png";

  // Reply name (real name from profilesMap)
  const replyName = message.replyTo 
    ? (profilesMap[message.replyTo.senderId]?.name || 
       message.replyTo.senderName?.split(" ")[0] || 
       "Someone")
    : null;

  const handleReply = () => {
    const ev = new CustomEvent("group-reply", {
      detail: {
        id: message.id,
        text: message.text || "(image/voice)",
        senderName: senderName,
        senderId: message.senderId
      },
    });
    document.dispatchEvent(ev);
    setMenuOpen(false);
  };

  const time = message.timestamp?.toDate?.().toLocaleTimeString([], { 
    hour: "2-digit", 
    minute: "2-digit" 
  }) || "";

  return (
    <div 
      className={`${styles.messageRow} ${isOwn ? styles.ownRow : styles.otherRow}`}
      onLongPress={() => setMenuOpen(true)}
    >
      {/* AVATAR */}
      {!isOwn && (
        <button onClick={() => router.push(`/view-profile/${message.senderId}`)} className={styles.avatarWrap}>
          <Image
            src={senderPhoto}
            alt={senderName}
            width={40}
            height={40}
            className={styles.avatar}
          />
        </button>
      )}

      {/* BUBBLE */}
      <div className={`${styles.bubble} ${isOwn ? styles.ownBubble : styles.otherBubble}`}>
        {/* Sender Name */}
        {!isOwn && (
          <div className={styles.senderName}>
            {senderName}
          </div>
        )}

        {/* Pinned Badge */}
        {message.pinned && <span style={{ fontSize: "12px", opacity: 0.7 }}> Pinned</span>}

        {/* REPLY QUOTE */}
        {message.replyTo && (
          <div className={styles.quoted}>
            <div style={{ fontSize: "12px", opacity: 0.8, fontWeight: "600" }}>
              {replyName}
            </div>
            <div style={{ fontSize: "13px", opacity: 0.7 }}>
              {message.replyTo.text || "Photo/Voice"}
            </div>
          </div>
        )}

        {/* IMAGE */}
        {message.imageUrl && (
          <div className={styles.imageWrapper}>
            <Image
              src={message.imageUrl}
              alt="sent"
              width={280}
              height={280}
              className={styles.msgImage}
              style={{ borderRadius: "12px" }}
            />
          </div>
        )}

        {/* VOICE MESSAGE */}
        {message.audioUrl && (
          <audio controls controlsList="nodownload" style={{ width: "100%", margin: "8px 0" }}>
            <source src={message.audioUrl} type="audio/webm" />
            Your browser does not support audio.
          </audio>
        )}

        {/* TEXT */}
        {message.text && (
          <div className={styles.text}>
            {message.text}
          </div>
        )}

        {/* TIME + SEEN */}
        <div className={styles.metaRow}>
          <span className={styles.time}>{time}</span>
          {isOwn && (
            <span style={{ color: "#4fc3f7", fontSize: "11px" }}>
              {message.seenBy?.length > 1 ? "Seen" : "Sent"}
            </span>
          )}
        </div>
      </div>

      {/* MENU */}
      <div className={styles.menuWrap}>
        <button 
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className={styles.menuBtn}
        >
          More
        </button>

        {menuOpen && (
          <div className={styles.menuPopup} onClick={(e) => e.stopPropagation()}>
            <button onClick={handleReply}>Reply</button>
            <button onClick={() => { onLocalDelete(message.id, false); setMenuOpen(false); }}>
              Delete for me
            </button>
            {isOwn && (
              <button onClick={() => { onLocalDelete(message.id, true); setMenuOpen(false); }}>
                Delete for everyone
              </button>
            )}
            <button onClick={() => { navigator.clipboard.writeText(message.text || ""); setMenuOpen(false); }}>
              Copy
            </button>
            <button onClick={() => setMenuOpen(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}