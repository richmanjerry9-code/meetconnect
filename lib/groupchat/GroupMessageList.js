// lib/groupchat/GroupMessageList.js
"use client";

import { useState, useEffect, useRef } from "react";
import styles from "../../styles/groupchat.module.css";

export default function GroupMessageList({
  messages,
  profilesMap = {},
  currentUserId,
  onProfileClick,
  onDelete,
  onReply,
  onPin,
  pinnedMessages,
  onImageClick,
}) {
  const messagesEndRef = useRef(null);
  const listRef = useRef(null);

  // Long press state
  const [longPressMessageId, setLongPressMessageId] = useState(null);
  const messageRefs = useRef({});
  const touchStartRef = useRef(null);
  const touchTimerRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // === 100% IDENTICAL TO YOUR PRIVATE CHAT (with Math.round fix) ===
  const getDateLabel = (timestamp) => {
    if (!timestamp) return "Unknown";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today - checkDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays > 1 && diffDays < 7) {
      return checkDate.toLocaleDateString("en-US", { weekday: "long" });
    }

    // Exact format from your private chat
    const dayName = checkDate.toLocaleDateString("en-US", { weekday: "long" });
    const dayNum = checkDate.getDate();
    const month = checkDate.toLocaleDateString("en-US", { month: "short" });
    const year = checkDate.getFullYear();

    return `${dayName} ${dayNum} ${month} ${year}`;
  };

  // Filter + sort (exactly like private chat)
  const visibleMessages = messages
    .filter((msg) => !msg.deletedFor?.includes(currentUserId))
    .sort((a, b) => {
      const timeA = a.timestamp?.toDate?.()?.getTime() || 0;
      const timeB = b.timestamp?.toDate?.()?.getTime() || 0;
      return timeA - timeB;
    });

  // Group by date label
  const groupedMessages = visibleMessages.reduce((groups, msg) => {
    const label = getDateLabel(msg.timestamp);
    if (!groups[label]) groups[label] = [];
    groups[label].push(msg);
    return groups;
  }, {});

  // Long press handlers
  const handleTouchStart = (e, messageId) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchTimerRef.current = setTimeout(() => {
      setLongPressMessageId(messageId);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 450);
  };

  const handleTouchMove = (e) => {
    if (touchStartRef.current && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
      if (dx > 15 || dy > 15) {
        if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        touchStartRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchStartRef.current = null;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (longPressMessageId && !messageRefs.current[longPressMessageId]?.contains(e.target)) {
        setLongPressMessageId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [longPressMessageId]);

  return (
    <div
      ref={listRef}
      className={styles.messageList}
      onTouchMove={handleTouchMove}
      style={{
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        touchAction: "pan-y",
      }}
    >
      {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
        <div key={dateLabel}>
          {/* Date Header - now guaranteed to show */}
          <div className={styles.dateHeader}>{dateLabel}</div>

          {msgs.map((msg) => {
            const isPinned = pinnedMessages.includes(msg.id);
            const showMenu = longPressMessageId === msg.id;

            return (
              <div
                key={msg.id}
                ref={(el) => (messageRefs.current[msg.id] = el)}
                onTouchStart={(e) => handleTouchStart(e, msg.id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                style={{ position: "relative" }}
              >
                <GroupMessageItem
                  message={msg}
                  profile={profilesMap[msg.senderId] || {}}
                  isOwn={msg.senderId === currentUserId}
                  onProfileClick={() => onProfileClick(msg.senderId)}
                  quotedMessage={msgs.find((m) => m.id === msg.replyTo?.id)}
                  isPinned={isPinned}
                  onDelete={onDelete}
                  onReply={onReply}
                  onPin={onPin}
                  onImageClick={onImageClick}
                />

                {showMenu && (
                  <div className={styles.messageMenu}>
                    <button onClick={() => { onReply(msg); setLongPressMessageId(null); }}>Reply</button>
                    <button onClick={() => { onDelete(msg.id, false); setLongPressMessageId(null); }}>Delete for me</button>
                    <button onClick={() => { onDelete(msg.id, true); setLongPressMessageId(null); }}>Delete for everyone</button>
                    <button onClick={() => { onPin(msg.id); setLongPressMessageId(null); }}>
                      {isPinned ? "Unpin" : "Pin"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}