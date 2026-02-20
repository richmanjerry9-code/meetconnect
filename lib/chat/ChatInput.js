// lib/chat/ChatInput.js (updated)
"use client";

import { useState, useRef, useEffect } from "react";
// import ImagePreview from "./MediaPreview"; // Assuming you have this or remove if not needed

export default function ChatInput({ onSend, onTyping }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewOnce, setViewOnce] = useState(false); // New: View once option
  const fileRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMobile(/Mobi|Android/i.test(navigator.userAgent));
    }
  }, []);

  useEffect(() => {
    if (onTyping) {
      if (text.trim().length > 0) {
        onTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
      } else {
        onTyping(false);
      }
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [text, onTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [text]);

  const handleImageChange = (e) => {
    const file = e.target?.files?.[0];
    if (file) setImageFile(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed:", err);
      alert("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!onSend || (!text.trim() && !imageFile && !audioBlob)) return;

    try {
      setSending(true);
      await onSend(text.trim(), imageFile, audioBlob, viewOnce); // Updated: Pass viewOnce
      setText("");
      setImageFile(null);
      setAudioBlob(null);
      setViewOnce(false);
      if (onTyping) onTyping(false);
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
      {/* Image Preview */}
      {imageFile && (
        <div
          style={{
            padding: "8px 16px 4px",
            background: "#1e1e1e",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ position: "relative", maxWidth: "200px" }}>
            <img
              src={URL.createObjectURL(imageFile)}
              alt="Preview"
              style={{ width: "100%", borderRadius: "8px" }}
            />
            <button
              type="button"
              onClick={() => setImageFile(null)}
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                background: "rgba(0,0,0,0.7)",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={viewOnce}
              onChange={(e) => setViewOnce(e.target.checked)}
            />
            View once
          </label>
        </div>
      )}

      {/* Audio Preview */}
      {audioBlob && !isRecording && (
        <div
          style={{
            padding: "8px 16px 4px",
            background: "#1e1e1e",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <audio controls src={URL.createObjectURL(audioBlob)} style={{ flex: 1 }} />
          <button type="button" onClick={() => setAudioBlob(null)}>Remove</button>
        </div>
      )}

      {/* Main Input Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          maxWidth: "100vw",
          boxSizing: "border-box",
        }}
      >
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

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={sending}
          style={{
            background: isRecording ? "#ff0000" : "none",
            border: "none",
            fontSize: "24px",
            padding: "8px",
            cursor: "pointer",
            borderRadius: "8px",
            flexShrink: 0,
            color: isRecording ? "white" : "inherit",
          }}
        >
          {isRecording ? "⏹️" : "🎤"}
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          rows={1}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "12px 16px",
            borderRadius: "24px",
            border: "1px solid #444",
            background: "#222",
            color: "white",
            fontSize: "16px",
            outline: "none",
            resize: "none",
            overflow: "hidden",
            minHeight: "48px",
            maxHeight: "150px",
            overflowY: "auto",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isMobile) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

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