// /lib/chat/ChatInput.js
"use client";

import { useState } from "react";
import EmojiPicker from "emoji-picker-react";
import ImagePreview from "./ImagePreview";
import styles from "../../styles/chat.module.css";

export default function ChatInput({ onSend }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target?.files?.[0];
    if (file) setImageFile(file);
  };

  const handleEmojiClick = (emojiData) => {
    setText((prevText) => prevText + emojiData.emoji);
    setShowEmojiPicker(false); // Optionally close after selection
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!onSend || (!text.trim() && !imageFile)) return;

    try {
      setSending(true);
      await onSend(text.trim(), imageFile);
      setText("");
      setImageFile(null);
      setShowEmojiPicker(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.chatInput}>
      <input type="file" accept="image/*" onChange={handleImageChange} />

      {imageFile && (
        <ImagePreview
          file={imageFile}
          onRemove={() => setImageFile(null)}
        />
      )}

      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
        />
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          style={{ position: "absolute", right: "40px", top: "50%", transform: "translateY(-50%)" }} // Adjust positioning as needed
        >
          😊
        </button>
        {showEmojiPicker && (
          <div style={{ position: "absolute", bottom: "100%", zIndex: 10 }}>
            <EmojiPicker onEmojiClick={handleEmojiClick} />
          </div>
        )}
      </div>

      <button type="submit" disabled={sending}>
        {sending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
