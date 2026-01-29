
// messsagelist.js (updated with image modal viewer)
"use client";
import { useState } from "react"; // ✅ Added for state
import MessageItem from "./MessageItem";
import styles from "../../styles/chat.module.css";

export default function MessageList({
  messages = [],
  currentUserId,
  onReact,
  onReply,
  onDelete,
  onViewProfile,
  onPin, // Added
  pinnedMessages = [],
}) {
  const [selectedImage, setSelectedImage] = useState(null); // ✅ Added for image viewer

  const safeMessages = Array.isArray(messages) ? messages : [];
  // Filter out messages deleted for the current user
  const filteredMessages = safeMessages.filter(
    (msg) => !msg.deletedFor?.includes(currentUserId)
  );

  return (
    <div
      className={styles.messageList}
      style={{ flex: 1, width: "100%", height: "100%", overflowY: "auto" }}
    >
      {filteredMessages.length === 0 && (
        <div style={{ textAlign: "center", padding: "1rem", opacity: 0.6 }}>
          No messages yet
        </div>
      )}
      {filteredMessages.map((msg) => {
        // Lookup quoted message if replyingTo exists
        const quotedMessage = msg.replyingTo
          ? safeMessages.find((m) => m.id === msg.replyingTo)
          : null;

        return (
          <MessageItem
            key={msg.id}
            message={msg}
            isOwn={msg.userId === currentUserId} // Assuming message has userId (or senderId?)
            quotedMessage={quotedMessage}
            isPinned={pinnedMessages.includes(msg.id)}
            onReact={onReact ? (emoji) => onReact(msg.id, emoji) : null}
            onReply={onReply || null}
            onDelete={onDelete || null}
            onViewProfile={onViewProfile ? () => onViewProfile(msg.userId) : null}
            onPin={onPin || null}
            onImageClick={(imageUrl) => setSelectedImage(imageUrl)} // ✅ Added for image clicks
          />
        );
      })}

      {/* ✅ Image Modal Viewer */}
      {selectedImage && (
        <div
          className={styles.imageModal}
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} className={styles.fullImage} />
        </div>
      )}
    </div>
  );
}