// /lib/chat/ChatInput.js
"use client";

import { useState, useRef } from "react";
import ImagePreview from "./ImagePreview";
import styles from "../../styles/chat.module.css";

export default function ChatInput({ onSend }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target?.files?.[0];
    if (file) setImageFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!onSend || (!text.trim() && !imageFile)) return;

    try {
      setSending(true);
      await onSend(text.trim(), imageFile);
      setText("");
      setImageFile(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.chatInput}>
      <button type="button" className={styles.iconBtn} onClick={() => fileRef.current.click()}>📎</button>
      <input type="file" accept="image/*" onChange={handleImageChange} ref={fileRef} style={{ display: 'none' }} />

      {imageFile && (
        <ImagePreview
          file={imageFile}
          onRemove={() => setImageFile(null)}
        />
      )}

      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
      />

      <button type="submit" disabled={sending}>
        {sending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
