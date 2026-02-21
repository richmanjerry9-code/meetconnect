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

          if (!otherUserId) {
            return null;
          }

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
            unreadCounts: data.unreadCounts || {},
            otherUserId,
            otherUser,
          };
        })
      );

      // Filter out chats without messages (no timestamp) and null entries
      const filteredChats = chatList.filter(chat => chat && chat.timestamp);

      // Sort: pinned first → newest first
      setChats(
        filteredChats.sort((a, b) => {
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

  // Pin / Unpin
  const handlePin = async (chatId, isPinned) => {
    const db = getFirestore();
    const chatRef = doc(db, "privateChats", chatId);
    await updateDoc(chatRef, {
      pinnedBy: isPinned ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
    setOpenMenuId(null);
  };

  // Delete chat
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

  // Handle chat click: Mark as read then navigate
  const handleChatClick = async (chatId) => {
    const db = getFirestore();
    const chatRef = doc(db, "privateChats", chatId);
    await updateDoc(chatRef, {
      [`unreadCounts.${user.uid}`]: 0
    });
    router.push(`/inbox/${chatId}`);
  };

  if (!user) return <div>Please log in to view your inbox.</div>;

  return (
    <div className={styles.inboxContainer}>
      {/* Back Arrow + Title + Group Chat Button */}
      <div className={styles.inboxHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
        <button
          onClick={() => router.push("/group-chat")}
          className={styles.groupChatBtn}
        >
          Group Chat
        </button>
      </div>

      {chats.length === 0 && (
        <p style={{ textAlign: "center", opacity: 0.6, marginTop: "40px" }}>
          No messages yet
        </p>
      )}

      {chats.map((chat) => {
        const hasUnread = chat.unreadCounts?.[user.uid] > 0;

        return (
          <div
            key={chat.id}
            className={styles.chatRow}
            onClick={() => handleChatClick(chat.id)}
          >
            {/* Avatar */}
            <Image
              src={chat.otherUser?.profilePic || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iNjAiIHI9IjUwIiBmaWxsPSIjQkRCREJEIiAvPgogIDxwYXRoIGQ9Ik01MCAxNTAgUTEwMCAxMTAgMTUwIDE1MCBRMTUwIDIwMCA1MCAyMDAgWiIgZmlsbD0iI0JEQkRCRCIgLz4KPC9zdmc+Cg=='}
              width={50}
              height={50}
              className={styles.avatar}
              alt="User"
            />

            {/* Name + Last message */}
            <div className={styles.chatInfo}>
              <div className={styles.chatNameRow}>
                <span className={styles.chatName}>
                  {chat.otherUser?.name || "User"}
                </span>

                {hasUnread && <span className={styles.unreadDot}></span>}
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

            {/* 3-Dot Menu */}
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
        );
      })}
    </div>
  );
}