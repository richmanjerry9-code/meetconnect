"use client"; // Add this if your file doesn't already have it (required in Next.js App Router)

import { useState, useEffect, useRef } from "react";
import styles from "../../styles/groupchat.module.css";
import data from "@emoji-mart/data";

export default function GroupChatInput({ onSend }) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => setReplyTo(e.detail);
    window.addEventListener("groupchat:reply", handler);
    return () => window.removeEventListener("groupchat:reply", handler);
  }, []);

  // Auto-focus search when picker opens
  useEffect(() => {
    if (showEmoji && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showEmoji]);

  const handleSend = async () => {
    if (!text.trim()) return;

    await onSend({
      text: text.trim(),
      replyTo,
    });

    setText("");
    setReplyTo(null);
  };

  const addEmoji = (native) => {
    setText(text + native);
    setShowEmoji(false);
    setEmojiSearch("");
  };

  return (
    <div className={styles.chatInputBar} style={{ position: "relative" }}> {/* ← THIS IS THE FIX */}
      {/* Reply Preview */}
      {replyTo && (
        <div className={styles.replyPreview}>
          Replying to <strong>{replyTo.senderName?.split(" ")[0] || "User"}</strong>: {replyTo.text || "(media)"}
          <button onClick={() => setReplyTo(null)}>X</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
        <button className={styles.emojiBtn} onClick={() => setShowEmoji(!showEmoji)}>
          {showEmoji ? "❌" : "😀"}
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: "25px",
            border: "1px solid #444",
            background: "#222",
            color: "white",
            fontSize: "16px",
          }}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
        />

        <button
          onClick={handleSend}
          style={{
            background: "#00aaff",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "25px",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          Send
        </button>
      </div>

      {/* === CUSTOM ALL-EMOJI PANEL (NOW GUARANTEED TO APPEAR) === */}
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
          {/* Search */}
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search all ~3,800 emojis + skin tones..."
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
              /* Search results – flat grid */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                  gap: "10px",
                  padding: "0 8px",
                }}
              >
                {Object.values(data.emojis).flatMap((e) => {
                  const searchTerms = [
                    e.name || "",
                    ...(Array.isArray(e.shortcodes) ? e.shortcodes : []),
                    ...(Array.isArray(e.keywords) ? e.keywords : []),
                    ...(Array.isArray(e.emoticons) ? e.emoticons : []),
                  ].join(" ").toLowerCase();

                  if (!searchTerms.includes(emojiSearch)) return [];

                  return e.skins.map((skin) => (
                    <button
                      key={skin.unified}
                      style={{ fontSize: "34px", background: "none", border: "none", cursor: "pointer", borderRadius: "8px", padding: "4px" }}
                      onClick={() => addEmoji(skin.native)}
                      title={e.name}
                    >
                      {skin.native}
                    </button>
                  ));
                })}
              </div>
            ) : (
              /* All emojis – continuous scroll with sticky category headers */
              <>
                {data.categories.map((category) => (
                  <div key={category.id}>
                    <h3
                      style={{
                        margin: "24px 12px 8px",
                        padding: "8px 12px",
                        color: "#aaa",
                        fontSize: "15px",
                        fontWeight: "600",
                        position: "sticky",
                        top: "53px",
                        background: "#1e1e1e",
                        zIndex: 5,
                        borderBottom: "1px solid #333",
                      }}
                    >
                      {category.name}
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                        gap: "10px",
                        padding: "0 8px 16px",
                      }}
                    >
                      {category.emojis.flatMap((emojiId) => {
                        const e = data.emojis[emojiId];
                        if (!e) return null;
                        return e.skins.map((skin, i) => (
                          <button
                            key={`${emojiId}-${i}`}
                            style={{ fontSize: "34px", background: "none", border: "none", cursor: "pointer", borderRadius: "8px", padding: "4px" }}
                            onClick={() => addEmoji(skin.native)}
                            title={e.name}
                          >
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
    </div>
  );
}