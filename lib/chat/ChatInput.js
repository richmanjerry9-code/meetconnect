// /lib/chat/ChatInput.js
"use client";

import { useState, useRef, useEffect } from "react";
import ImagePreview from "./MediaPreview";
import data from "@emoji-mart/data";

export default function ChatInput({ onSend }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const fileRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (showEmoji && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showEmoji]);

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
      setShowEmoji(false);
      setEmojiSearch("");
    } finally {
      setSending(false);
    }
  };

  const addEmoji = (native) => {
    setText(text + native);
    setShowEmoji(false);
    setEmojiSearch("");
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

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
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
          {showEmoji ? "❌" : "😀"}
        </button>

        {/* Text Input - takes all remaining space */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
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
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
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

      {/* FULL EMOJI PANEL - same insane version */}
      {showEmoji && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            maxHeight: "80vh",
            overflow: "auto",
            background: "#1e1e1e",
            border: "1px solid #444",
            borderRadius: "12px 12px 0 0",
            zIndex: 1000,
            boxShadow: "0 -10px 30px rgba(0,0,0,0.7)",
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search all ~3,800 emojis..."
            value={emojiSearch}
            onChange={(e) => setEmojiSearch(e.target.value.toLowerCase())}
            style={{
              position: "sticky",
              top: 0,
              width: "100%",
              padding: "14px 16px",
              background: "#111",
              color: "white",
              border: "none",
              borderBottom: "1px solid #444",
              fontSize: "16px",
              zIndex: 10,
              boxSizing: "border-box",
            }}
          />

          <div style={{ padding: "12px 8px" }}>
            {emojiSearch ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", gap: "10px" }}>
                {Object.values(data.emojis).flatMap((e) => {
                  const searchTerms = [e.name || "", ...(e.shortcodes || []), ...(e.keywords || []), ...(e.emoticons || [])].join(" ").toLowerCase();
                  if (!searchTerms.includes(emojiSearch)) return [];
                  return e.skins.map((skin) => (
                    <button key={skin.unified} onClick={() => addEmoji(skin.native)} style={{ fontSize: "34px", background: "none", border: "none", cursor: "pointer" }}>
                      {skin.native}
                    </button>
                  ));
                })}
              </div>
            ) : (
              <>
                {data.categories.map((category) => (
                  <div key={category.id}>
                    <h3 style={{ margin: "24px 12px 8px", padding: "8px 12px", color: "#aaa", fontSize: "15px", fontWeight: "600", position: "sticky", top: "53px", background: "#1e1e1e", zIndex: 5 }}>
                      {category.name}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", gap: "10px", padding: "0 8px 16px" }}>
                      {category.emojis.flatMap((emojiId) => {
                        const e = data.emojis[emojiId];
                        if (!e) return [];
                        return e.skins.map((skin, i) => (
                          <button key={`${emojiId}-${i}`} onClick={() => addEmoji(skin.native)} style={{ fontSize: "34px", background: "none", border: "none", cursor: "pointer" }}>
                            {skin.native}
                          </button>
                        ));
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
