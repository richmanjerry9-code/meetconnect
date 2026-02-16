import { useEffect, useRef } from "react";
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  return (
    <div className={styles.messageList}>
      {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
        <div key={dateLabel}>
          {/* Header will be: Today, Yesterday, Monday, or Feb 9 2026 */}
          <div className={styles.dateHeader}>{dateLabel}</div>
          
          {msgs.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              isOwn={msg.userId === currentUserId}
              quotedMessage={messages.find((m) => m.id === msg.replyingTo)}
              isPinned={pinnedMessages.includes(msg.id)}
              onDelete={onDelete}
              onReply={onReply}
              onPin={onPin}
              onImageClick={onImageClick}
            />
          ))}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}