// pages/inbox/[chatId].js
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  setDoc,
  getDocs,
  limit,
  increment,
} from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import styles from "../../styles/chat.module.css"; // Assuming similar styles
import ChatInput from "../../lib/chat/ChatInput"; // Your updated ChatInput
import { uploadMedia } from "../../lib/chat/"; // Import uploadMedia
import imageCompression from 'browser-image-compression';
import ChatHeader from "../../lib/chat/ChatHeader"; // Your ChatHeader component
import { getDatabase, ref, onValue, set, onDisconnect, ServerValue } from "firebase/database";

const db = getFirestore();
const database = getDatabase();

export default function PrivateChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { chatId } = router.query;
  const [messages, setMessages] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isTyping, setIsTyping] = useState(false); // Typing indicator
  const [otherUser, setOtherUser] = useState(null);
  const [isOnline, setIsOnline] = useState(false); // New: Online status for other user

  // Handle browser back button for image modal
  useEffect(() => {
    if (selectedImage) {
      history.pushState({ modal: true }, "");
      const handlePopState = () => {
        setSelectedImage(null);
      };
      window.addEventListener("popstate", handlePopState, { once: true });
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (history.state?.modal) {
          history.back();
        }
      };
    }
  }, [selectedImage]);

  // Set own presence (online/offline)
  useEffect(() => {
    if (!user) return;

    const connectedRef = ref(database, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        const presenceRef = ref(database, 'status/' + user.uid);
        set(presenceRef, { state: 'online', last_changed: ServerValue.TIMESTAMP });
        onDisconnect(presenceRef).set({ state: 'offline', last_changed: ServerValue.TIMESTAMP });
      }
    });

    return () => unsubscribe();
  }, [user]);

  // LOAD CHAT + LISTENERS (with Typing) and other user's presence
  useEffect(() => {
    if (!user || !chatId) return;

    let unsubMessages = null;
    let unsubChat = null;
    let unsubPresence = null;

    async function fetchChatDetails() {
      try {
        const chatRef = doc(db, "privateChats", chatId);
        const snap = await getDoc(chatRef);
        if (!snap.exists()) {
          router.push("/inbox"); // Redirect if chat doesn't exist
          return;
        }
        const data = snap.data();
        const otherUserId = data.participants.find(id => id !== user.uid);
        const otherUserSnap = await getDoc(doc(db, "profiles", otherUserId));
        setOtherUser(otherUserSnap.exists() ? { id: otherUserId, ...otherUserSnap.data() } : null);

        // Listen to other user's presence
        const presenceRef = ref(database, 'status/' + otherUserId);
        unsubPresence = onValue(presenceRef, (snap) => {
          const status = snap.val();
          setIsOnline(status?.state === 'online');
        });

        // MESSAGE LISTENER
        const q = query(
          collection(db, "privateChats", chatId, "messages"),
          orderBy("timestamp", "asc")
        );

        unsubMessages = onSnapshot(q, async (snapshot) => {
          const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

          const uids = [...new Set(msgs.map(m => m.senderId).filter(Boolean))];
          const missing = uids.filter(uid => !profilesMap[uid]);

          if (missing.length > 0) {
            const newMap = { ...profilesMap };
            await Promise.all(
              missing.map(async uid => {
                const snap = await getDoc(doc(db, "profiles", uid));
                if (snap.exists()) {
                  const p = snap.data();
                  newMap[uid] = {
                    name: p.name || p.displayName || "User",
                    profilePic: p.photoURL || p.profilePic || "/default-profile.png",
                  };
                } else {
                  newMap[uid] = { name: "User", profilePic: "/default-profile.png" };
                }
              })
            );
            setProfilesMap(newMap);
          }

          setMessages(msgs);
          setLoading(false);
        });

        // CHAT LISTENER for typing
        unsubChat = onSnapshot(chatRef, (snap) => {
          const data = snap.data() || {};
          const typingUsers = data.typing || [];
          setIsTyping(typingUsers.length > 0 && typingUsers[0] !== user.uid); // Show if other is typing
        });

        setLoading(false);
      } catch (err) {
        console.error("Private chat load failed:", err);
        setLoading(false);
      }
    }

    fetchChatDetails();

    return () => {
      if (unsubMessages) unsubMessages();
      if (unsubChat) unsubChat();
      if (unsubPresence) unsubPresence();
    };
  }, [user, chatId, profilesMap]);

  // MARK AS SEEN and reset unread
  useEffect(() => {
    if (!messages.length || !user || !chatId) return;

    messages.forEach(async (msg) => {
      if (!msg.seenBy?.includes(user.uid)) {
        const msgRef = doc(db, "privateChats", chatId, "messages", msg.id);
        try {
          await updateDoc(msgRef, {
            seenBy: arrayUnion(user.uid),
          });
        } catch (err) {
          console.error("Mark seen failed:", err);
        }
      }
    });

    // Reset unread for this user
    const chatRef = doc(db, "privateChats", chatId);
    updateDoc(chatRef, {
      [`unreadCounts.${user.uid}`]: 0
    });
  }, [messages, user, chatId]);

  // SEND MESSAGE (with upload support, viewOnce, and unread increment)
  const handleSend = async (text = "", imageFile = null, audioBlob = null, viewOnce = false) => {
    if (!user || (!text.trim() && !imageFile && !audioBlob)) return;

    try {
      let imageUrl = null;
      let audioUrl = null;
      if (imageFile) {
        // Compress image before upload
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(imageFile, options);
        imageUrl = await uploadMedia(compressedFile, "chatImages");
      }
      if (audioBlob) audioUrl = await uploadMedia(audioBlob, "chatAudio");

      let chosenName = "User";
      const profileSnap = await getDoc(doc(db, "profiles", user.uid));
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        chosenName = p.name || p.username || "User";
      }

      const replyToObj = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName,
        senderId: replyingTo.senderId
      } : null;

      const payload = {
        text: text.trim(),
        imageUrl: imageUrl || null,
        audioUrl: audioUrl || null,
        senderId: user.uid,
        senderName: chosenName,
        senderPhoto: user.photoURL || "/default-profile.png",
        timestamp: serverTimestamp(),
        seenBy: [user.uid],
        replyTo: replyToObj,
        deletedFor: [],
        viewOnce: (imageUrl && viewOnce) ? true : false,
        viewedBy: (imageUrl && viewOnce) ? [] : [],
      };

      await addDoc(collection(db, "privateChats", chatId, "messages"), payload);

      const chatRef = doc(db, "privateChats", chatId);
      const otherUserId = otherUser?.id;
      await updateDoc(chatRef, {
        lastMessage: text || (audioUrl ? "Voice message" : imageUrl ? "Photo" : "Message"),
        timestamp: serverTimestamp(),
        [`unreadCounts.${otherUserId}`]: increment(1),
      });

      setReplyingTo(null);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  // TYPING HANDLER
  const handleTyping = async (isTypingNow) => {
    if (!user) return;
    const chatRef = doc(db, "privateChats", chatId);
    try {
      await updateDoc(chatRef, {
        typing: isTypingNow ? arrayUnion(user.uid) : arrayRemove(user.uid),
      });
    } catch (err) {
      console.error("Typing update failed:", err);
    }
  };

  // DELETE MESSAGE (with lastMessage update)
  const handleDelete = async (messageId, forEveryone = false) => {
    const msgRef = doc(db, "privateChats", chatId, "messages", messageId);
    const chatRef = doc(db, "privateChats", chatId);
    if (forEveryone) {
      await deleteDoc(msgRef);
    } else {
      await updateDoc(msgRef, { deletedFor: arrayUnion(user.uid) });
    }

    // Update lastMessage
    const q = query(
      collection(db, "privateChats", chatId, "messages"),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      await updateDoc(chatRef, {
        lastMessage: "",
        timestamp: null,
      });
    } else {
      const lastMsg = snap.docs[0].data();
      await updateDoc(chatRef, {
        lastMessage: lastMsg.text || (lastMsg.audioUrl ? "Voice message" : lastMsg.imageUrl ? "Photo" : "Message"),
        timestamp: lastMsg.timestamp || serverTimestamp(),
      });
    }
  };

  // Handle image click for view once
  const handleImageClick = async (message) => {
    setSelectedImage(message.imageUrl);

    if (message.viewOnce && !message.viewedBy?.includes(user.uid)) {
      const msgRef = doc(db, "privateChats", chatId, "messages", message.id);
      await updateDoc(msgRef, {
        viewedBy: arrayUnion(user.uid),
      });
    }
  };

  if (!user) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Please log in</div>;
  }

  return (
    <div className={styles.chatContainer}>
      {/* Use the new ChatHeader with isOnline prop */}
      <ChatHeader 
        otherUser={otherUser} 
        onBack={() => router.back()} 
        onProfileClick={() => router.push(`/view-profile/${otherUser?.id}`)} 
        isOnline={isOnline} // Pass the online status
      />

      <main style={{ flex: 1, overflow: "auto", padding: "1.25rem" }}>
        {loading && <div style={{ textAlign: "center", opacity: 0.6 }}>Loading...</div>}
        {!loading && messages.length === 0 && <div style={{ textAlign: "center", opacity: 0.6 }}>No messages yet</div>}

        <PrivateMessageList
          messages={messages}
          profilesMap={profilesMap}
          currentUserId={user.uid}
          onDelete={handleDelete}
          onReply={setReplyingTo}
          onImageClick={handleImageClick}
        />
      </main>

      {isTyping && <div className={styles.typing}>Typing...</div>}

      {replyingTo && (
        <div className={styles.replyPreview}>
          Replying to: {replyingTo.text || "(Message)"}
          <button onClick={() => setReplyingTo(null)}>Cancel</button>
        </div>
      )}

      <ChatInput onSend={handleSend} onTyping={handleTyping} />

      {selectedImage && (
        <div
          className={styles.imageModal}
          onClick={() => setSelectedImage(null)}
        >
          <Image
            src={selectedImage}
            alt="Full size image"
            fill
            style={{ objectFit: "contain" }}
            loading="lazy"
          />
          <button
            className={styles.closeModal}
            onClick={() => setSelectedImage(null)}
            style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '20px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

/* ==================== MESSAGE LIST ==================== */
function PrivateMessageList({ messages = [], profilesMap = {}, currentUserId, onDelete, onReply, onImageClick }) {
  const containerRef = useRef(null);

  useEffect(() => {
    containerRef.current?.scrollTo(0, containerRef.current.scrollHeight);
  }, [messages]);

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {messages.map((m) => {
        if (m.deletedFor?.includes(currentUserId)) return null;
        const profile = profilesMap[m.senderId] || {};
        return (
          <PrivateMessageItem
            key={m.id}
            message={m}
            profile={profile}
            isOwn={m.senderId === currentUserId}
            onDelete={(forEveryone) => onDelete(m.id, forEveryone)}
            onReply={() => onReply(m)}
            onImageClick={onImageClick}
            currentUserId={currentUserId}
          />
        );
      })}
    </div>
  );
}

/* ==================== SINGLE MESSAGE ==================== */
function PrivateMessageItem({ message, profile = {}, isOwn, onDelete, onReply, onImageClick, currentUserId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const longPressTimer = useRef(null);

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
    }, 500);
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 70) onReply();
    setTouchStartX(null);
  };

  const senderName = profile.name || message.senderName || "User";
  const senderPic = profile.profilePic || "/default-profile.png";
  const time = message.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";

  const hasViewed = message.viewedBy?.includes(currentUserId);

  return (
    <div
      className={`${styles.messageRow} ${isOwn ? styles.ownRow : styles.otherRow}`}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`${styles.bubble} ${isOwn ? styles.ownBubble : styles.otherBubble}`} style={{ maxWidth: "78%" }}>
        {/* Reply Preview */}
        {message.replyTo && (
          <div style={{ background: "rgba(255,255,255,0.08)", padding: "8px", borderRadius: "8px", marginBottom: "8px", fontSize: "13px" }}>
            Replying to {message.replyTo.senderName || "someone"}: {message.replyTo.text?.slice(0, 50)}...
          </div>
        )}

        <div style={{ marginTop: 6 }}>
          {message.imageUrl && (
            <>
              {message.viewOnce && hasViewed ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#888",
                  fontStyle: "italic",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "12px",
                }}>
                  This photo can no longer be viewed
                </div>
              ) : message.viewOnce ? (
                <div
                  onClick={() => onImageClick(message)}
                  style={{
                    position: "relative",
                    width: "240px",
                    height: "240px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#111",
                  }}
                >
                  <Image
                    src={message.imageUrl}
                    alt="View once preview"
                    fill
                    style={{
                      objectFit: "cover",
                      filter: "blur(20px)",
                      transform: "scale(1.1)",
                    }}
                    loading="lazy"
                  />
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    color: "white",
                    zIndex: 1,
                  }}>
                    <div style={{ fontSize: "64px" }}>①</div>
                    <div style={{ fontSize: "14px", background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: "8px" }}>
                      View once
                    </div>
                  </div>
                </div>
              ) : (
                <Image
                  src={message.imageUrl}
                  alt="sent"
                  width={240}
                  height={240}
                  className={styles.chatImage}
                  style={{ borderRadius: "12px", cursor: "pointer" }}
                  onClick={() => onImageClick(message)}
                  loading="lazy"
                />
              )}
            </>
          )}
          {message.audioUrl && (
            <audio controls src={message.audioUrl} style={{ width: "100%", margin: "8px 0" }}>
              Your browser does not support audio.
            </audio>
          )}
          {message.text && <div className={styles.messageText}>{message.text}</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <div style={{ fontSize: 11, color: "#666" }}>{time}</div>
          {isOwn && (
            <div style={{ fontSize: 12, color: "#1e7f3e", marginLeft: 8 }}>
              {message.seenBy?.length > 1 ? "Seen" : "Sent"}
            </div>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className={styles.messageMenu} onMouseLeave={() => setMenuOpen(false)}>
          <button onClick={() => { onReply(); setMenuOpen(false); }}>Reply</button>
          <button onClick={() => { onDelete(false); setMenuOpen(false); }}>Delete for me</button>
          {isOwn && (
            <button onClick={() => { onDelete(true); setMenuOpen(false); }}>Delete for everyone</button>
          )}
          <button onClick={() => { navigator.clipboard.writeText(message.text || ""); setMenuOpen(false); }}>Copy</button>
          <button onClick={() => setMenuOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}