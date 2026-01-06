"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../contexts/AuthContext";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
  orderBy,
  updateDoc,
} from "firebase/firestore";
import Image from "next/image";
import EmojiPicker from "emoji-picker-react"; // Assume installed: npm install emoji-picker-react
import { uploadMedia } from "../../lib/chat/uploadMedia";
import MediaPreview from "../../lib/chat/MediaPreview";
import styles from "../../styles/chat.module.css"; // Assume similar styles, adjust as needed

export default function Chat() {
  const { user } = useAuth();
  const router = useRouter();
  const { id: chatId } = router.query;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user || !chatId) return;

    const db = getFirestore();

    // Get other user
    const fetchOtherUser = async () => {
      const chatSnap = await getDoc(doc(db, "privateChats", chatId));
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const otherId = data.participants.find((uid) => uid !== user.uid);
        const userSnap = await getDoc(doc(db, "profiles", otherId));
        if (userSnap.exists()) {
          setOtherUser({ id: otherId, ...userSnap.data() });
        }
      }
    };
    fetchOtherUser();

    // Listen to messages
    const q = query(
      collection(db, `privateChats/${chatId}/messages`),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    });

    return () => unsubscribe();
  }, [user, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    const db = getFirestore();
    let mediaUrl = null;
    let mediaType = null;

    if (selectedFile) {
      const folder = selectedFile.type.startsWith("image/") ? "images" : "videos";
      mediaUrl = await uploadMedia(selectedFile, folder);
      mediaType = folder.slice(0, -1); // 'image' or 'video'
    }

    await addDoc(collection(db, `privateChats/${chatId}/messages`), {
      text: newMessage.trim() || null,
      mediaUrl,
      mediaType,
      sender: user.uid,
      timestamp: serverTimestamp(),
    });

    // Update last message in chat
    let lastMsg = newMessage.trim();
    if (mediaUrl) {
      const mediaLabel = mediaType === "image" ? "[Image]" : "[Video]";
      lastMsg = lastMsg ? `${lastMsg} ${mediaLabel}` : mediaLabel;
    }
    await updateDoc(doc(db, "privateChats", chatId), {
      lastMessage: lastMsg || "[Media]",
      timestamp: serverTimestamp(),
    });

    setNewMessage("");
    setSelectedFile(null);
  };

  const togglePicker = () => {
    if (!showPicker) {
      inputRef.current?.blur(); // Close keyboard
    }
    setShowPicker(!showPicker);
  };

  const onEmojiClick = (emojiData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    setShowPicker(false);
    inputRef.current?.focus(); // Reopen keyboard
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
      setSelectedFile(file);
    } else {
      alert("Please select an image or video file.");
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  if (!user) return <div>Please log in.</div>;

  return (
    <div
      className={styles.chatContainer}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className={styles.chatHeader}>
        <button
          onClick={() => router.push("/inbox")}
          className={styles.backBtn}
          style={{
            fontSize: "26px",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          ←
        </button>
        <h2 className={styles.chatTitle}>{otherUser?.name || "Chat"}</h2>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              textAlign: msg.sender === user.uid ? "right" : "left",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                background: msg.sender === user.uid ? "#dcf8c6" : "#fff",
                padding: "8px 12px",
                borderRadius: "18px",
                display: "inline-block",
                maxWidth: "80%",
              }}
            >
              {msg.mediaUrl && (
                <>
                  {msg.mediaType === "image" ? (
                    <Image
                      src={msg.mediaUrl}
                      alt="Media"
                      width={200}
                      height={200}
                      style={{
                        maxWidth: "100%",
                        borderRadius: "8px",
                        marginBottom: msg.text ? "8px" : "0",
                      }}
                    />
                  ) : (
                    <video
                      src={msg.mediaUrl}
                      controls
                      width={200}
                      style={{
                        maxWidth: "100%",
                        borderRadius: "8px",
                        marginBottom: msg.text ? "8px" : "0",
                      }}
                    />
                  )}
                </>
              )}
              {msg.text && <span>{msg.text}</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker */}
      {showPicker && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40vh", // Keyboard-like height
            zIndex: 1000,
            background: "white",
            overflow: "auto",
          }}
        >
          <EmojiPicker onEmojiClick={onEmojiClick} />
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSend}
        style={{
          flex: "0 0 auto",
          display: "flex",
          padding: "10px",
          background: "#f0f0f0",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label
          htmlFor="file-input"
          style={{
            cursor: "pointer",
            marginRight: "10px",
            fontSize: "20px",
          }}
        >
          📎
          <input
            id="file-input"
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
        <button
          type="button"
          onClick={togglePicker}
          style={{ marginRight: "10px", fontSize: "20px" }}
        >
          😊
        </button>
        <textarea
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            resize: "none",
            height: "40px",
            padding: "10px",
            borderRadius: "20px",
            border: "1px solid #ccc",
          }}
        />
        <button type="submit" style={{ marginLeft: "10px", fontSize: "20px" }}>
          Send
        </button>
      </form>

      {selectedFile && (
        <MediaPreview file={selectedFile} onRemove={handleRemoveFile} />
      )}
    </div>
  );
}