"use client";  // For client-side FCM

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../contexts/AuthContext";
import MessageList from "../../lib/chat/MessageList";
import ChatInput from "../../lib/chat/ChatInput";
import ChatHeader from "../../lib/chat/ChatHeader";
import { listenMessages, sendMessage, uploadMedia } from "../../lib/chat/";
import { messaging } from "../../lib/firebase";  // Import from lib/firebase.js
import { getToken, onMessage } from "firebase/messaging";
import { db } from "../../lib/firebase";  // For Firestore

import {
  doc,
  getDoc,
  increment,
  setDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

import styles from "../../styles/chat.module.css";
import Image from "next/image";

export default function PrivateChat() {
  const router = useRouter();
  const { chatId } = router.query;
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [otherUserId, setOtherUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [toast, setToast] = useState(null);  // For foreground notifications
  const [isTyping, setIsTyping] = useState(false);  // Typing indicator

  // FCM Setup with Error Handling
  useEffect(() => {
    if (!user) return;

    const setupFCM = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });  // From Firebase Console
          if (token) {
            await fetch('/api/save-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await user.getIdToken()}`,
              },
              body: JSON.stringify({ token }),
            });
          }
        }

        onMessage(messaging, (payload) => {
          setToast(payload.notification?.body || 'New message!');
          setTimeout(() => setToast(null), 5000);
        });
      } catch (err) {
        console.error('FCM setup error:', err);
      }
    };

    setupFCM();
  }, [user]);

  // LOAD CHAT + USER (with Typing Listener)
  useEffect(() => {
    if (!chatId || !user) return;

    let unsubscribeMessages = null;
    let unsubscribeChat = null;
    let unsubscribeTyping = null;

    async function fetchChatDetails() {
      try {
        const chatRef = doc(db, "privateChats", chatId);
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
          setLoading(false);
          return;
        }

        const data = chatSnap.data() || {};
        const participants = data.participants || [];

        const otherId = participants.find((id) => id !== user.uid);
        if (!otherId) {
          setLoading(false);
          return;
        }

        setOtherUserId(otherId);

        const otherUserDoc = await getDoc(doc(db, "profiles", otherId));
        setOtherUser(otherUserDoc.exists() ? otherUserDoc.data() : null);

        // RESET MY UNREAD
        await setDoc(
          chatRef,
          {
            unreadCounts: {
              [user.uid]: 0,
            },
          },
          { merge: true }
        );

        // MESSAGE LISTENER
        unsubscribeMessages = listenMessages(
          `privateChats/${chatId}/messages`,
          (msgs) => setMessages(Array.isArray(msgs) ? msgs : [])
        );

        // PIN LISTENER
        unsubscribeChat = onSnapshot(chatRef, (snap) => {
          setPinnedMessages(snap.data()?.pinnedMessages || []);
        });

        // TYPING LISTENER
        unsubscribeTyping = onSnapshot(chatRef, (snap) => {
          const typingUsers = snap.data()?.typing || [];
          setIsTyping(typingUsers.includes(otherUserId));
        });

        setLoading(false);
      } catch (err) {
        console.error("Chat load failed:", err);
        setLoading(false);
      }
    }

    fetchChatDetails();

    return () => {
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeChat) unsubscribeChat();
      if (unsubscribeTyping) unsubscribeTyping();
    };
  }, [chatId, user]);

  // MARK AS SEEN
  useEffect(() => {
    if (!messages.length || !user || !chatId) return;

    messages.forEach(async (msg) => {
      if (msg.senderId !== user.uid && !msg.seenBy?.includes(user.uid)) {
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
  }, [messages, user, chatId]);

  // SEND MESSAGE
  const handleSend = async (text, imageFile) => {
    if (!text && !imageFile) return;
    if (!user || !chatId) return;

    try {
      let imageUrl = null;
      if (imageFile) imageUrl = await uploadMedia(imageFile, "chatImages");

      await sendMessage(
        `privateChats/${chatId}/messages`,
        text,
        imageUrl,
        user.uid,
        user.displayName || "User",
        replyingTo
      );

      if (otherUserId) {
        const chatRef = doc(db, "privateChats", chatId);

        await setDoc(
          chatRef,
          {
            unreadCounts: {
              [otherUserId]: increment(1),
            },
            lastMessage: text || "📷 Image",
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setReplyingTo(null);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  // TYPING HANDLER (call from ChatInput onChange)
  const handleTyping = async (isTypingNow) => {
    if (!chatId || !user) return;
    const chatRef = doc(db, "privateChats", chatId);
    try {
      await updateDoc(chatRef, {
        typing: isTypingNow ? arrayUnion(user.uid) : arrayRemove(user.uid),
      });
    } catch (err) {
      console.error("Typing update failed:", err);
    }
  };

  // DELETE MESSAGE (with inbox preview update)
  const handleDelete = async (messageId, forEveryone) => {
    if (!user || !chatId) return;

    const msgRef = doc(db, "privateChats", chatId, "messages", messageId);
    const chatRef = doc(db, "privateChats", chatId);

    try {
      if (forEveryone) {
        await deleteDoc(msgRef);
      } else {
        await updateDoc(msgRef, {
          deletedFor: arrayUnion(user.uid),
        });
      }

      // UPDATE LAST MESSAGE FOR INBOX
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
          lastMessage: lastMsg.text || "📷 Image",
          timestamp: lastMsg.timestamp || serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // PIN MESSAGE
  const handlePin = async (messageId) => {
    if (!user || !chatId) return;
    const chatRef = doc(db, "privateChats", chatId);

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

  if (!user) return <div>Please log in to access this chat.</div>;
  if (!chatId || loading) return <div>Loading chat...</div>;

  return (
    <div className={styles.chatContainer}>
      <ChatHeader
        otherUser={otherUser || {}}
        onBack={() => router.back()}
        onProfileClick={() => {
          if (otherUserId) {
            router.push(`/view-profile/${otherUserId}`);
          }
        }}
      />

      <MessageList
        messages={messages}
        currentUserId={user.uid}
        onReply={setReplyingTo}  // Updated to direct set (match if ChatInput uses it)
        onDelete={handleDelete}
        onPin={handlePin}
        pinnedMessages={pinnedMessages}
        onImageClick={setSelectedImage}
      />

      {isTyping && <div className={styles.typing}>Typing...</div>}

      {replyingTo && (
        <div className={styles.replyPreview}>
          Replying to:{" "}
          {messages.find((m) => m.id === replyingTo)?.text || "(Message)"}
          <button onClick={() => setReplyingTo(null)}>Cancel</button>
        </div>
      )}

      <ChatInput onSend={handleSend} onTyping={handleTyping} />  // Pass for input change

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
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className={styles.closeModal}
            onClick={() => setSelectedImage(null)}
          >
            ×
          </button>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}