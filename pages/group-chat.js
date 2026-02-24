// pages/group-chat.js
"use client";  // Note: This directive is for App Router; in Pages Router, it may not be needed or could cause issues—consider removing if using Pages Router strictly.

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import {
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
  increment,
  getDocs,
  limit,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import styles from "styles/groupchat.module.css";
import GroupChatHeader from "../lib/groupchat/GroupChatHeader";
import GroupChatInput from "../lib/groupchat/GroupChatInput";
import { uploadMedia } from "../lib/chat/";  // Import uploadMedia for consistency
import { getMessaging, onMessage, getToken } from "firebase/messaging";  // Import messaging utilities here (client-only)
import { db } from "../lib/firebase";  // Import db from firebase.js to ensure app initialization
import imageCompression from 'browser-image-compression';

// Replace with your actual VAPID key from Firebase Console
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'; // Get from Firebase > Project Settings > Cloud Messaging > Web configuration

// Helper function to subscribe to topic (server-side via API)
async function subscribeToTopic(topic) {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging();  // Initialize messaging here (client-only)
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      await fetch('/api/subscribeToTopic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, topic }),
      });
    }
  } catch (err) {
    console.error('Subscription failed:', err);
  }
}

// Helper function to unsubscribe from topic (server-side via API)
async function unsubscribeFromTopic(topic) {
  try {
    const messaging = getMessaging();  // Initialize messaging here (client-only)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    await fetch('/api/unsubscribeFromTopic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, topic }),
    });
  } catch (err) {
    console.error('Unsubscription failed:', err);
  }
}

export default function GroupChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);  // Typing indicator
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const chatId = "main";  // Fixed group chat ID

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

  // CLEANED UP FCM: Only listen for foreground messages (optional for group)
  useEffect(() => {
    if (!user) return;

    const messaging = getMessaging();  // Initialize messaging here (client-only)
    const unsubscribe = onMessage(messaging, (payload) => {
      if (payload.data?.chatId === chatId) {
        // Handle group notification if needed
      }
    });

    return () => unsubscribe();
  }, [user, chatId]);

  // CHECK MEMBERSHIP + LOAD CHAT + LISTENERS (with Typing and Pinned)
  useEffect(() => {
    if (!user) return;

    let unsubMessages = null;
    let unsubChat = null;

    async function fetchChatDetails() {
      try {
        const chatRef = doc(db, "groupChats", chatId);
        const snap = await getDoc(chatRef);
        if (!snap.exists()) {
          await setDoc(chatRef, { 
            createdAt: serverTimestamp(), 
            typing: [], 
            pinnedMessages: [], 
            members: [], 
            memberCount: 0 
          });
          setShowJoinPrompt(true);
          setLoading(false);
          return;
        }

        const data = snap.data();
        const userIsMember = data.members?.includes(user.uid) || false;
        setIsMember(userIsMember);
        setMemberCount(data.memberCount || 0);

        if (!userIsMember) {
          setShowJoinPrompt(true);
          setLoading(false);
          return;
        }

        // Subscribe to notifications if member
        await subscribeToTopic(`group_${chatId}`);

        // MESSAGE LISTENER
        const q = query(
          collection(db, "groupChats", chatId, "messages"),
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

        // CHAT LISTENER for pinned, typing, members
        unsubChat = onSnapshot(chatRef, (snap) => {
          const data = snap.data() || {};
          setPinnedMessages(data.pinnedMessages || []);
          const typingUsers = data.typing || [];
          setIsTyping(typingUsers.length > 0);
          setMemberCount(data.memberCount || 0);
          setIsMember(data.members?.includes(user.uid) || false);
        });

        setLoading(false);
      } catch (err) {
        console.error("Group chat load failed:", err);
        setLoading(false);
      }
    }

    fetchChatDetails();

    return () => {
      if (unsubMessages) unsubMessages();
      if (unsubChat) unsubChat();
      if (isMember) {
        unsubscribeFromTopic(`group_${chatId}`);
      }
    };
  }, [user, profilesMap]);

  // MARK AS SEEN
  useEffect(() => {
    if (!messages.length || !user || !chatId || !isMember) return;

    messages.forEach(async (msg) => {
      if (!msg.seenBy?.includes(user.uid)) {
        const msgRef = doc(db, "groupChats", chatId, "messages", msg.id);
        try {
          await updateDoc(msgRef, {
            seenBy: arrayUnion(user.uid),
          });
        } catch (err) {
          console.error("Mark seen failed:", err);
        }
      }
    });
  }, [messages, user, chatId, isMember]);

  // HANDLE JOIN
  const handleJoin = async () => {
    if (!user) return;
    const chatRef = doc(db, "groupChats", chatId);
    try {
      await updateDoc(chatRef, {
        members: arrayUnion(user.uid),
        memberCount: increment(1),
      });
      await subscribeToTopic(`group_${chatId}`);
      setShowJoinPrompt(false);
      setIsMember(true);
      // Load will happen via onSnapshot
    } catch (err) {
      console.error("Join failed:", err);
    }
  };

  // HANDLE LEAVE
  const handleLeave = async () => {
    if (!user || !confirm("Are you sure you want to leave the group?")) return;
    const chatRef = doc(db, "groupChats", chatId);
    try {
      await updateDoc(chatRef, {
        members: arrayRemove(user.uid),
        memberCount: increment(-1),
        typing: arrayRemove(user.uid), // Clean up if typing
      });
      await unsubscribeFromTopic(`group_${chatId}`);
      router.push("/inbox");
    } catch (err) {
      console.error("Leave failed:", err);
    }
  };

  // SEND MESSAGE (with upload support and viewOnce)
  const handleSend = async (text = "", imageFile = null, audioBlob = null, viewOnce = false) => {
    if (!user || !isMember || (!text.trim() && !imageFile && !audioBlob)) return;

    try {
      let imageUrl = null;
      let audioUrl = null;
      if (imageFile) {
        // Compress image before upload
        const options = {
          maxSizeMB: 1, // Max 1MB
          maxWidthOrHeight: 1024, // Resize if larger
          useWebWorker: true, // Offload to worker for speed
        };
        const compressedFile = await imageCompression(imageFile, options);
        imageUrl = await uploadMedia(compressedFile, "chatImages");
      }
      if (audioBlob) audioUrl = await uploadMedia(audioBlob, "chatAudio");

      // ALWAYS get the chosen name from Firestore profile (NEVER email or Firebase name)
      let chosenName = "User";
      const profileSnap = await getDoc(doc(db, "profiles", user.uid));
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        chosenName = p.name || p.username || "User"; // ONLY profile name
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
        senderName: chosenName, // ONLY THIS NAME IS SAVED
        senderPhoto: user.photoURL || "/default-profile.png",
        timestamp: serverTimestamp(),
        seenBy: [user.uid],
        replyTo: replyToObj,
        deletedFor: [],
        viewOnce: (imageUrl && viewOnce) ? true : false,
        viewedBy: (imageUrl && viewOnce) ? [] : [],  // Do not add sender initially for view once
      };

      await addDoc(collection(db, "groupChats", chatId, "messages"), payload);

      await updateDoc(doc(db, "groupChats", chatId), {
        lastMessage: text || (audioUrl ? "Voice message" : imageUrl ? "Photo" : "Message"),
        timestamp: serverTimestamp(),
      });

      setReplyingTo(null);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  // TYPING HANDLER (called from GroupChatInput on input change)
  const handleTyping = async (isTypingNow) => {
    if (!user || !isMember) return;
    const chatRef = doc(db, "groupChats", chatId);
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
    const msgRef = doc(db, "groupChats", chatId, "messages", messageId);
    const chatRef = doc(db, "groupChats", chatId);
    if (forEveryone) {
      await deleteDoc(msgRef);
    } else {
      await updateDoc(msgRef, { deletedFor: arrayUnion(user.uid) });
    }

    // Update lastMessage
    const q = query(
      collection(db, "groupChats", chatId, "messages"),
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

  // PIN MESSAGE
  const handlePin = async (messageId) => {
    if (!user) return;
    const chatRef = doc(db, "groupChats", chatId);

    try {
      if (pinnedMessages.includes(messageId)) {
        await updateDoc(chatRef, {
          pinnedMessages: arrayRemove(messageId),
        });
      } else {
        await updateDoc(chatRef, {
          pinnedMessages: arrayUnion(messageId),
        });
      }
    } catch (err) {
      console.error("Pin failed:", err);
    }
  };

  // Handle image click for view once
  const handleImageClick = async (message) => {
    setSelectedImage(message.imageUrl);

    if (message.viewOnce && !message.viewedBy?.includes(user.uid)) {
      const msgRef = doc(db, "groupChats", chatId, "messages", message.id);
      await updateDoc(msgRef, {
        viewedBy: arrayUnion(user.uid),
      });
    }
  };

  if (!user) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Please log in</div>;
  }

  if (showJoinPrompt) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", background: "#f9f9f9", borderRadius: "12px", maxWidth: "400px", margin: "auto" }}>
        <h2 style={{ marginBottom: "1rem" }}>Join MeetConnect Group Chat? 💕</h2>
        <p style={{ marginBottom: "1.5rem", color: "#666" }}>Connect with others, share stories, and have fun in our community group chat. You'll receive notifications for new messages.</p>
        <button onClick={handleJoin} style={{ margin: "0 10px", padding: "10px 20px", background: "#D81B60", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Join Now</button>
        <button onClick={() => router.push("/inbox")} style={{ margin: "0 10px", padding: "10px 20px", background: "#ccc", color: "#333", border: "none", borderRadius: "8px", cursor: "pointer" }}>Not Now</button>
      </div>
    );
  }

  if (!isMember) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>You are not a member of this group.</div>;
  }

  return (
    <div className={styles.chatContainer}>
      <GroupChatHeader memberCount={memberCount} onLeave={handleLeave} />

      <main style={{ flex: 1, overflow: "auto", padding: "1.25rem" }}>
        {loading && <div style={{ textAlign: "center", opacity: 0.6 }}>Loading...</div>}
        {!loading && messages.length === 0 && <div style={{ textAlign: "center", opacity: 0.6 }}>No messages yet</div>}

        <GroupMessageList
          messages={messages}
          profilesMap={profilesMap}
          currentUserId={user.uid}
          onProfileClick={(uid) => router.push(`/view-profile/${uid}`)}
          onDelete={handleDelete}
          onReply={setReplyingTo}
          onPin={handlePin}
          pinnedMessages={pinnedMessages}
          onImageClick={handleImageClick}
        />
      </main>

      {isTyping && <div className={styles.typing}>Typing...</div>}

      {replyingTo && (
        <div className={styles.replyPreview}>
          Replying to:{" "}
          {replyingTo.text || "(Message)"}
          <button onClick={() => setReplyingTo(null)}>Cancel</button>
        </div>
      )}

      <GroupChatInput onSend={handleSend} onTyping={handleTyping} />

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
function GroupMessageList({ messages = [], profilesMap = {}, currentUserId, onProfileClick, onDelete, onReply, onPin, pinnedMessages, onImageClick }) {
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
          <GroupMessageItem
            key={m.id}
            message={m}
            profile={profile}
            isOwn={m.senderId === currentUserId}
            onProfileClick={() => onProfileClick(m.senderId)}
            onDelete={(forEveryone) => onDelete(m.id, forEveryone)}
            onReply={() => onReply(m)}
            onPin={() => onPin(m.id)}
            isPinned={pinnedMessages.includes(m.id)}
            onImageClick={onImageClick}
            currentUserId={currentUserId}
          />
        );
      })}
    </div>
  );
}

/* ==================== SINGLE MESSAGE ==================== */
function GroupMessageItem({ message, profile = {}, isOwn, onProfileClick, onDelete, onReply, onPin, isPinned, onImageClick, currentUserId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const longPressTimer = useRef(null);

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
    }, 500); // 500ms for long press
  };

  const handleTouchMove = () => {
    // Cancel long press if moving
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
      {!isOwn && (
        <button onClick={onProfileClick} className={styles.profileBtn}>
          <Image src={senderPic} width={40} height={40} alt="" className={styles.avatar} />
        </button>
      )}

      <div className={`${styles.bubble} ${isOwn ? styles.ownBubble : styles.otherBubble}`} style={{ maxWidth: "78%" }}>
        {/* Reply Preview */}
        {message.replyTo && (
          <div style={{ background: "rgba(255,255,255,0.08)", padding: "8px", borderRadius: "8px", marginBottom: "8px", fontSize: "13px" }}>
            Replying to {message.replyTo.senderName || "someone"}: {message.replyTo.text?.slice(0, 50)}...
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#D81B60" }}>{senderName}</div>
          </div>
        </div>

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
                /* Blurred preview for view-once (for both sender and receivers who haven't opened yet) */
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
                /* Normal image display (non-view-once) */
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

      {isOwn && (
        <button onClick={onProfileClick} className={styles.profileBtn}>
          <Image src={senderPic} width={36} height={36} alt="" className={styles.avatar} />
        </button>
      )}

      {menuOpen && (
        <div className={styles.messageMenu} onMouseLeave={() => setMenuOpen(false)}>
          <button onClick={() => { onReply(); setMenuOpen(false); }}>Reply</button>
          <button onClick={() => { onDelete(false); setMenuOpen(false); }}>Delete for me</button>
          {isOwn && (
            <button onClick={() => { onDelete(true); setMenuOpen(false); }}>Delete for everyone</button>
          )}
          <button onClick={() => { onPin(); setMenuOpen(false); }}>{isPinned ? "Unpin" : "Pin"}</button>
          <button onClick={() => { navigator.clipboard.writeText(message.text || ""); setMenuOpen(false); }}>Copy</button>
          <button onClick={() => setMenuOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}