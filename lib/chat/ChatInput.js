// /lib/chat/ChatInput.js
"use client";

import { useState, useRef, useEffect } from "react";
import ImagePreview from "./MediaPreview";

export default function ChatInput({ onSend, onTyping }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);
  const typingTimeoutRef = useRef(null); // For debounce

  // Handle typing indicator with debounce
  useEffect(() => {
    if (onTyping) {
      if (text.trim().length > 0) {
        onTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000); // Stop after 2s inactivity
      } else {
        onTyping(false);
      }
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [text, onTyping]);

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
      if (onTyping) onTyping(false); // Stop typing after send
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        position: "relative",
        width: "100%",
        background: "#111",
        borderTop: "1px solid #333",
      }}
    >
      {/* Image Preview (above input bar like replies in group chat) */}
      {imageFile && (
        <div
          style={{
            padding: "8px 16px 4px",
            background: "#1e1e1e",
            borderBottom: "1px solid #333",
          }}
        >
          <ImagePreview file={imageFile} onRemove={() => setImageFile(null)} />
        </div>
      )}

      {/* Main Input Bar - Super mobile-friendly flex layout */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,                  // Tight gap = fits even on smallest phones
          padding: "8px 10px",      // Small horizontal padding
          maxWidth: "100vw",
          boxSizing: "border-box",
        }}
      >
        {/* Attachment */}
        <button
          type="button"
          onClick={() => fileRef.current.click()}
          style={{
            background: "none",
            border: "none",
            fontSize: "24px",
            padding: "8px",
            cursor: "pointer",
            borderRadius: "8px",
            flexShrink: 0,
          }}
        >
          📎
        </button>

        {/* Text Input - Now a textarea for multi-line support */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          rows={1} // Starts as single-line, but expands naturally
          style={{
            flex: 1,
            minWidth: 0,                    // Crucial: allows input to shrink properly on tiny screens
            padding: "12px 16px",
            borderRadius: "24px",
            border: "1px solid #444",
            background: "#222",
            color: "white",
            fontSize: "16px",
            outline: "none",
            resize: "none",                 // Optional: prevent manual resize; auto-expands via content
            overflow: "hidden",             // Hide scrollbar until needed
            minHeight: "48px",              // Match original input height
            maxHeight: "150px",             // Limit expansion (adjust as needed)
            overflowY: "auto",              // Scroll if too long
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
            // Shift + Enter will naturally insert a new line
          }}
          onInput={(e) => {
            // Auto-resize height based on content (optional enhancement)
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; // Cap at maxHeight
          }}
        />

        {/* Send Button - always visible & reachable */}
        <button
          type="submit"
          disabled={sending}
          style={{
            background: "#00aaff",
            color: "white",
            border: "none",
            padding: "12px 18px",
            borderRadius: "24px",
            fontWeight: "bold",
            fontSize: "15px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>

      <input type="file" accept="image/*" onChange={handleImageChange} ref={fileRef} style={{ display: "none" }} />
    </form>
  );
}