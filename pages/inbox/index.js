// /pages/inbox/index.js
"use client";
import { useState, useEffect } from "react";
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
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import Image from "next/image";
import styles from "../../styles/chat.module.css";

export default function Inbox() {
  const { user } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const db = getFirestore();

    const q = query(
      collection(db, "privateChats"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();

          const otherUserId = data.participants.find(
            (id) => id !== user.uid
          );

          let otherUser = null;
          try {
            const userSnap = await getDoc(doc(db, "profiles", otherUserId));
            if (userSnap.exists()) {
              otherUser = { id: userSnap.id, ...userSnap.data() };
            }
          } catch (err) {
            console.error("Profile fetch failed:", err);
          }

          return {
            id: docSnap.id,
            lastMessage: data.lastMessage || "No message",
            timestamp: data.timestamp || null,
            pinnedBy: data.pinnedBy || [],
            otherUserId,
            otherUser,
          };
        })
      );

      // ✅ Sort: pinned first → newest first
      setChats(
        chatList.sort((a, b) => {
          const aPinned = a.pinnedBy.includes(user.uid) ? 1 : 0;
          const bPinned = b.pinnedBy.includes(user.uid) ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;

          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;

          return b.timestamp.toMillis() - a.timestamp.toMillis();
        })
      );
    });

    return () => unsubscribe();
  }, [user]);

  // ✅ Pin / Unpin
  const handlePin = async (chatId, isPinned) => {
    const db = getFirestore();
    const chatRef = doc(db, "privateChats", chatId);
    await updateDoc(chatRef, {
      pinnedBy: isPinned ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
    setOpenMenuId(null);
  };

  // ✅ Delete chat
  const handleDelete = async (chatId) => {
    if (confirm("Are you sure you want to delete this conversation?")) {
      const db = getFirestore();
      const chatRef = doc(db, "privateChats", chatId);
      const chatSnap = await getDoc(chatRef);

      if (chatSnap.exists()) {
        const data = chatSnap.data();
        if (data.participants.length > 1) {
          await updateDoc(chatRef, {
            participants: arrayRemove(user.uid),
          });
        } else {
          await deleteDoc(chatRef);
        }
      }
      setOpenMenuId(null);
    }
  };

  if (!user) return <div>Please log in to view your inbox.</div>;

  return (
    <div className={styles.inboxContainer}>
      {/* ✅ Back Arrow + Title */}
      <div className={styles.inboxHeader}>
        <button
          onClick={() => router.push("/")}
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
        <h2 className={styles.inboxTitle}>Inbox</h2>
      </div>

      {chats.length === 0 && (
        <p style={{ textAlign: "center", opacity: 0.6, marginTop: "40px" }}>
          No messages yet
        </p>
      )}

      {chats.map((chat) => (
        <div
          key={chat.id}
          className={styles.chatRow}
          onClick={() => router.push(`/inbox/${chat.id}`)}
        >
          {/* Avatar */}
          <Image
            src={chat.otherUser?.profilePic || "/default-profile.png"}
            width={50}
            height={50}
            className={styles.avatar}
            alt="User"
          />

          {/* Name + Last message */}
          <div className={styles.chatInfo}>
            <div className={styles.chatName}>
              {chat.otherUser?.name || "User"}
            </div>

            <div className={styles.chatLastMessageRow}>
              <span className={styles.chatLastMessage}>
                {chat.lastMessage}
              </span>
            </div>
          </div>

          {/* Time */}
          <div className={styles.chatTime}>
            {chat.timestamp?.toDate?.().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }) || "--"}
          </div>

          {/* ✅ 3-Dot Menu */}
          <div className={styles.chatActions}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === chat.id ? null : chat.id);
              }}
              className={styles.menuBtn}
              style={{ fontSize: "22px" }}
            >
              ⋮
            </button>

            {openMenuId === chat.id && (
              <div className={styles.menuDropdown}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePin(chat.id, chat.pinnedBy.includes(user.uid));
                  }}
                >
                  {chat.pinnedBy.includes(user.uid) ? "Unpin" : "Pin"} Chat
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(chat.id);
                  }}
                >
                  Delete Chat
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
