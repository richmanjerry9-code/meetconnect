// lib/groupchat/GroupChatInput.js
import { useState, useRef, useEffect } from "react";
import styles from "../../styles/groupchat.module.css";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

export default function GroupChatInput({ onSend }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    const handler = (e) => setReplyTo(e.detail);
    document.addEventListener("group-reply", handler);
    return () => document.removeEventListener("group-reply", handler);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      alert("Allow microphone");
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];

      const form = new FormData();
      form.append("file", blob, "voice.webm");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (res.ok) {
        await onSend({ audioUrl: data.url, replyTo });
        setReplyTo(null);
      }
      setIsRecording(false);
    };
  };

  const handleSend = async () => {
    if (!text.trim() && !imageFile) return;

    let imageUrl = null;
    if (imageFile) {
      const form = new FormData();
      form.append("file", imageFile);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) imageUrl = data.url;
    }

    await onSend({
      text: text.trim(),
      imageUrl,
      replyTo,
    });

    setText("");
    setImageFile(null);
    setReplyTo(null);
  };

  return (
    <div className={styles.chatInputBar}>
      {/* Reply Preview */}
      {replyTo && (
        <div className={styles.replyPreview}>
          Replying to <strong>
            {replyTo.senderName?.split(" ")[0] || "User"}
          </strong>: {replyTo.text || "(media)"}
          <button onClick={() => setReplyTo(null)}>X</button>
        </div>
      )}

      {/* Attached Image Preview */}
      {imageFile && (
        <div style={{ padding: "8px", background: "#333", color: "white", fontSize: "14px" }}>
          {imageFile.name} <button onClick={() => setImageFile(null)} style={{ marginLeft: 10 }}>Remove</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
        {/* REAL EMOJI PICKER (like WhatsApp) */}
        <button onClick={() => setShowEmoji(!showEmoji)} style={{ fontSize: "28px" }}>
          {showEmoji ? "X" : "Emoji"}
        </button>

        {/* ATTACH FILE */}
        <label>
          <span style={{ fontSize: "26px", cursor: "pointer" }}>Attachment</span>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => setImageFile(e.target.files[0])} />
        </label>

        {/* CAMERA - WORKS ON MOBILE */}
        <label>
          <span style={{ fontSize: "26px", cursor: "pointer" }}>Camera</span>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => setImageFile(e.target.files[0])} />
        </label>

        {/* TEXT INPUT */}
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

        {/* MIC - HOLD TO RECORD */}
        <button
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: isRecording ? "#d32f2f" : "#333",
            color: "white",
            fontSize: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
          }}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
        >
          {isRecording ? "Recording" : "Microphone"}
        </button>

        {/* SEND */}
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

      {/* FULL EMOJI PICKER - EXACTLY LIKE PHONE */}
      {showEmoji && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, zIndex: 1000 }}>
          <Picker
            data={data}
            onEmojiSelect={(emoji) => {
              setText(text + emoji.native);
              setShowEmoji(false);
            }}
            theme="dark"
            previewPosition="none"
            maxFrequentRows={1}
          />
        </div>
      )}
    </div>
  );
}