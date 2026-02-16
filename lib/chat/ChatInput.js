"use client";

import { useState, useRef, useEffect } from "react";
import ImagePreview from "./MediaPreview";

export default function ChatInput({ onSend, onTyping }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null); // New: For audio recording
  const [isRecording, setIsRecording] = useState(false); // New: Recording state
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false); // Added: Mobile detection
  const fileRef = useRef(null);
  const mediaRecorderRef = useRef(null); // New: MediaRecorder ref
  const typingTimeoutRef = useRef(null); // For debounce
  const textareaRef = useRef(null); // Added: Ref for textarea

  // Added: Detect mobile device (client-side only)
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMobile(/Mobi|Android/i.test(navigator.userAgent));
    }
  }, []);

  // Handle typing indicator with debounce
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

  // Added: Auto-resize textarea height (moved from onInput for better performance)
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

  // New: Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop()); // Clean up
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed:", err);
      alert("Microphone access denied or unavailable.");
    }
  };

  // New: Stop audio recording
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
      await onSend(text.trim(), imageFile, audioBlob); // Updated: Pass audioBlob
      setText("");
      setImageFile(null);
      setAudioBlob(null);
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
          }}
        >
          <ImagePreview file={imageFile} onRemove={() => setImageFile(null)} />
        </div>
      )}

      {/* New: Audio Preview */}
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

        {/* New: Audio Record Button */}
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

        {/* Text Input (textarea from previous) */}
        <textarea
          ref={textareaRef} // Added: Ref for height adjustment
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
            if (e.key === "Enter" && !e.shiftKey && !isMobile) { // Modified: Skip submit on mobile
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        {/* Send Button */}
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