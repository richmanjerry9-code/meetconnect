// lib/groupchat/GroupMessageList.js
import React, { useEffect, useState, useRef } from "react";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import GroupMessageItem from "./GroupMessageItem";
import styles from "../../styles/groupchat.module.css";
import { GROUP_CHAT_PATH, GROUP_CHAT_DOC } from "./index";

export default function GroupMessageList({ currentUser }) {
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);
  const db = getFirestore();

  useEffect(() => {
    const q = query(
      collection(db, GROUP_CHAT_PATH),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(data);
        // scroll to bottom
        setTimeout(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        }, 50);

        // mark all visible messages seen by current user (safe bulk)
        if (currentUser?.uid) {
          snap.docs.forEach(async (docSnap) => {
            const m = docSnap.data();
            if (!Array.isArray(m.seenBy) || !m.seenBy.includes(currentUser.uid)) {
              try {
                await updateDoc(doc(db, `${GROUP_CHAT_PATH}/${docSnap.id}`), {
                  seenBy: arrayUnion(currentUser.uid),
                });
              } catch (e) {
                // ignore network errors
              }
            }
          });
        }
      },
      (err) => {
        console.error("Group chat snapshot error", err);
      }
    );

    return () => unsub();
  }, [db, currentUser]);

  const handleDeleteLocal = (id, forEveryone = false) => {
    // We pass control to child component functions (they'll call firestore)
    // But we still optimistically remove deleted-for-me messages from UI
    if (!forEveryone && currentUser?.uid) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, deletedFor: Array.isArray(m.deletedFor) ? [...m.deletedFor, currentUser.uid] : [currentUser.uid] } : m
        )
      );
    } else if (forEveryone) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  };

  return (
    <div className={styles.messageList} ref={listRef}>
      {messages.length === 0 && (
        <div className={styles.noMessages}>No messages yet</div>
      )}

      {messages.map((m) => (
        <GroupMessageItem
          key={m.id}
          message={m}
          currentUser={currentUser}
          onLocalDelete={handleDeleteLocal}
        />
      ))}
    </div>
  );
}