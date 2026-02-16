"use client";

import { useState, useEffect, useRef } from "react";
import MessageItem from "./MessageItem";
import styles from "../../styles/chat.module.css";

export default function MessageList({
  messages,
  currentUserId,
  onReply,
  onDelete,
  onPin,
  pinnedMessages = [],
  onImageClick,
}) {
  const messagesEndRef = useRef(null);
  const listRef = useRef(null);

  // Long press state (per-message menu)
  const [longPressMessageId, setLongPressMessageId] = useState(null);
  const messageRefs = useRef({});
  const touchStartRef = useRef(null);
  const touchTimerRef = useRef(null);

  // Auto-scroll to bottom on new messages (smooth + performant)
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

  // --- Helper: Logic for Today vs Yesterday vs Weekday vs Date ---
  const getDateLabel = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate(); // Convert Firebase timestamp to JS Date
    const now = new Date();

    // Reset time portions to midnight to compare just the calendar days
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today - checkDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7 && diffDays > 0) {
      // Shows "Monday", "Tuesday", etc.
      return checkDate.toLocaleDateString("en-US", { weekday: "long" });
    } else {
      // Shows "Feb 9, 2026"
      return checkDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  // 1. FILTER FIRST: Remove deleted messages before grouping
  // This guarantees that if a day only has deleted messages, no header appears.
  const visibleMessages = messages.filter(
    (msg) => !msg.deletedFor?.includes(currentUserId)
  );

  // 2. GROUP: Organize by our smart date label
  const groupedMessages = visibleMessages.reduce((groups, msg) => {
    const label = getDateLabel(msg.timestamp);

    if (!groups[label]) groups[label] = [];
    groups[label].push(msg);
    return groups;
  }, {});

  // --- Mobile Long Press Handlers (prevents accidental reply on scroll) ---
  // Handle long press start
  const handleTouchStart = (e, messageId) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchTimerRef.current = setTimeout(() => {
      setLongPressMessageId(messageId);
      // Haptic feedback (if supported)
      if (navigator.vibrate) navigator.vibrate(50);
    }, 450); // Fast but reliable
  };

  // Cancel long press on movement (allows smooth scrolling)
  const handleTouchMove = (e) => {
    if (touchStartRef.current && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
      if (dx > 15 || dy > 15) { // Tolerance for natural scrolling
        if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        touchStartRef.current = null;
      }
    }
  };

  // Cleanup on touch end
  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchStartRef.current = null;
  };

  // Close menu on tap outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        longPressMessageId &&
        !messageRefs.current[longPressMessageId]?.contains(e.target)
      ) {
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
      onTouchMove={handleTouchMove} // Global for the whole list
      style={{
        // Native smooth scrolling on iOS/Android
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        touchAction: "pan-y", // Vertical scroll only (no accidental horizontal)
      }}
    >
      {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
        <div key={dateLabel}>
          {/* Date Header */}
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
                onTouchMove={handleTouchMove} // Per-message for extra safety
                style={{ position: "relative" }} // For menu positioning
              >
                <MessageItem
                  message={msg}
                  isOwn={msg.userId === currentUserId}
                  quotedMessage={messages.find((m) => m.id === msg.replyingTo)}
                  isPinned={isPinned}
                  onDelete={onDelete}
                  onReply={onReply}
                  onPin={onPin}
                  onImageClick={onImageClick}
                  // Pass long press handlers to MessageItem (update it to use these)
                  onTouchStart={(e) => handleTouchStart(e, msg.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                />

                {/* Context Menu (floating over the message) */}
                {showMenu && (
                  <div className={styles.messageMenu}>
                    <button
                      onClick={() => {
                        onReply(msg.id);
                        setLongPressMessageId(null);
                      }}
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => {
                        onDelete(msg.id, false);
                        setLongPressMessageId(null);
                      }}
                    >
                      Delete for me
                    </button>
                    <button
                      onClick={() => {
                        onDelete(msg.id, true);
                        setLongPressMessageId(null);
                      }}
                    >
                      Delete for everyone
                    </button>
                    <button
                      onClick={() => {
                        onPin(msg.id);
                        setLongPressMessageId(null);
                      }}
                    >
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