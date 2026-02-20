// pages/inbox/[chatId].js (updated to use MessageList for date headers; nothing else changed)
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  getFirestore,
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  getDocs,
  limit,
} from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import styles from "../../styles/chat.module.css"; // Assuming similar styles
import ChatInput from "../../lib/chat/ChatInput"; // Your updated ChatInput
import { uploadMedia } from "../../lib/chat/"; // Import uploadMedia
import imageCompression from 'browser-image-compression';
import ChatHeader from "../../lib/chat/ChatHeader"; // Your ChatHeader component
import { getDatabase, ref, onValue, set, onDisconnect, ServerValue } from "firebase/database";
import MessageList from "../../lib/chat/MessageList"; // Import your MessageList

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

  // SEND MESSAGE (with upload support, viewOnce, and API call for save + push)
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

      let senderName = "User";
      const profileSnap = await getDoc(doc(db, "profiles", user.uid));
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        senderName = p.name || p.username || "User";
      }

      const replyToObj = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName,
        senderId: replyingTo.senderId
      } : null;

      // Call API to save message and send push
      await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUid: user.uid,
          receiverUid: otherUser?.id,
          messageText: text.trim(),
          senderName,
          chatId,
          imageUrl,
          audioUrl,
          viewOnce,
          replyTo: replyToObj,
        }),
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

        <MessageList
          messages={messages}
          currentUserId={user.uid}
          onDelete={handleDelete}
          onReply={setReplyingTo}
          onImageClick={handleImageClick}
          onPin={() => {}} // Stub if not implemented
          pinnedMessages={[]} // Stub if not implemented
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