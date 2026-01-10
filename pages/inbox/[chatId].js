// /pages/inbox/[chatId].js
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../contexts/AuthContext";
import MessageList from "../../lib/chat/MessageList";
import ChatInput from "../../lib/chat/ChatInput";
import ChatHeader from "../../lib/chat/ChatHeader";
import { listenMessages, sendMessage, uploadImage } from "../../lib/chat";

import {
  doc,
  getDoc,
  getFirestore,
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

  // ✅ LOAD CHAT + USER
  useEffect(() => {
    if (!chatId || !user) return;

    let unsubscribeMessages = null;
    let unsubscribeChat = null;

    async function fetchChatDetails() {
      try {
        const db = getFirestore();
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

        // ✅ RESET MY UNREAD
        await setDoc(
          chatRef,
          {
            unreadCounts: {
              [user.uid]: 0,
            },
          },
          { merge: true }
        );

        // ✅ MESSAGE LISTENER
        unsubscribeMessages = listenMessages(
          `privateChats/${chatId}/messages`,
          (msgs) => setMessages(Array.isArray(msgs) ? msgs : [])
        );

        // ✅ PIN LISTENER
        unsubscribeChat = onSnapshot(chatRef, (snap) => {
          setPinnedMessages(snap.data()?.pinnedMessages || []);
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
    };
  }, [chatId, user]);

  // ✅ MARK AS SEEN
  useEffect(() => {
    if (!messages.length || !user || !chatId) return;

    const db = getFirestore();
    messages.forEach(async (msg) => {
      if (msg.senderId !== user.uid && !msg.seenBy?.includes(user.uid)) {
        const msgRef = doc(db, "privateChats", chatId, "messages", msg.id);
        await updateDoc(msgRef, {
          seenBy: arrayUnion(user.uid),
        });
      }
    });
  }, [messages, user, chatId]);

  // ✅ SEND MESSAGE
  const handleSend = async (text, imageFile) => {
    if (!text && !imageFile) return;
    if (!user || !chatId) return;

    let imageUrl = null;
    if (imageFile) imageUrl = await uploadImage(imageFile, "chatImages");

    await sendMessage(
      `privateChats/${chatId}/messages`,
      text,
      imageUrl,
      user.uid,
      user.displayName || "User",
      replyingTo
    );

    if (otherUserId) {
      const db = getFirestore();
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
  };

  const handleReply = (messageId) => {
    setReplyingTo(messageId);
  };

  // ✅ ✅ ✅ FULLY FIXED DELETE (UPDATES INBOX PREVIEW)
  const handleDelete = async (messageId, forEveryone) => {
    if (!user || !chatId) return;

    const db = getFirestore();
    const msgRef = doc(db, "privateChats", chatId, "messages", messageId);
    const chatRef = doc(db, "privateChats", chatId);

    if (forEveryone) {
      await deleteDoc(msgRef);
    } else {
      await updateDoc(msgRef, {
        deletedFor: arrayUnion(user.uid),
      });
    }

    // ✅ UPDATE LAST MESSAGE FOR INBOX
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
  };

  // ✅ PIN MESSAGE
  const handlePin = async (messageId) => {
    if (!user || !chatId) return;
    const db = getFirestore();
    const chatRef = doc(db, "privateChats", chatId);

    if (pinnedMessages.includes(messageId)) {
      await updateDoc(chatRef, {
        pinnedMessages: arrayRemove(messageId),
      });
    } else {
      await updateDoc(chatRef, {
        pinnedMessages: arrayUnion(messageId),
      });
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
            router.push(`/${`/view-profile/${otherUserId}`}`);
          }
        }}
      />

      <MessageList
        messages={messages}
        currentUserId={user.uid}
        onReply={handleReply}
        onDelete={handleDelete}
        onPin={handlePin}
        pinnedMessages={pinnedMessages}
      />

      {replyingTo && (
        <div className={styles.replyPreview}>
          Replying to:{" "}
          {messages.find((m) => m.id === replyingTo)?.text || "(Message)"}
          <button onClick={() => setReplyingTo(null)}>Cancel</button>
        </div>
      )}

      <ChatInput onSend={handleSend} />
    </div>
  );
}