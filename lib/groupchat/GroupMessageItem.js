// pages/group-chat.js
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
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import styles from "../styles/groupchat.module.css";
import GroupChatHeader from "../lib/groupchat/GroupChatHeader";

const db = getFirestore();

export default function GroupChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [pinnedMessages, setPinnedMessages] = useState([]);

  useEffect(() => {
    const chatRef = doc(db, "groupChats", "main");
    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) setPinnedMessages(snap.data().pinnedMessages || []);
    });

    (async () => {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        await setDoc(chatRef, { pinnedMessages: [], createdAt: serverTimestamp() });
      }
    })();

    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "groupChats", "main", "messages"),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
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

    return () => unsub();
  }, [profilesMap]);

  // NOW SUPPORTS: text, replyTo + FULL PRIVACY
  const sendMessage = async (text = "", imageUrl = null, audioUrl = null, replyTo = null) => {
    if (!user || (!text.trim() && !imageUrl && !audioUrl)) return;

    // ALWAYS get the chosen name from Firestore profile (NEVER email or Firebase name)
    let chosenName = "User";
    try {
      const profileSnap = await getDoc(doc(db, "profiles", user.uid));
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        chosenName = p.name || p.username || "User"; // ONLY profile name
      }
    } catch (err) {
      console.log("Could not fetch profile name");
    }

    const payload = {
      text: text.trim(),
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      senderId: user.uid,
      senderName: chosenName, // ONLY THIS NAME IS SAVED
      senderPhoto: user.photoURL || "/default-profile.png",
      timestamp: serverTimestamp(),
      seenBy: [user.uid],
      replyTo: replyTo || null,
      deletedFor: [],
    };

    await addDoc(collection(db, "groupChats", "main", "messages"), payload);

    await updateDoc(doc(db, "groupChats", "main"), {
      lastMessage: text || (audioUrl ? "Voice message" : imageUrl ? "Photo" : "Message"),
      timestamp: serverTimestamp(),
    });
  };

  const deleteMessage = async (messageId, forEveryone = false) => {
    const msgRef = doc(db, "groupChats", "main", "messages", messageId);
    if (forEveryone) {
      await deleteDoc(msgRef);
    } else {
      await updateDoc(msgRef, { deletedFor: arrayUnion(user.uid) });
    }
  };

  const pinMessage = async (messageId) => {
    const chatRef = doc(db, "groupChats", "main");
    const isPinned = pinnedMessages.includes(messageId);
    await updateDoc(chatRef, {
      pinnedMessages: isPinned ? arrayRemove(messageId) : arrayUnion(messageId),
    });
  };

  if (!user) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Please log in</div>;
  }

  return (
    <div className={styles.chatContainer}>
      <GroupChatHeader />

      <main style={{ flex: 1, overflow: "auto", padding: "1.25rem" }}>
        {loading && <div style={{ textAlign: "center", opacity: 0.6 }}>Loading...</div>}
        {!loading && messages.length === 0 && <div style={{ textAlign: "center", opacity: 0.6 }}>No messages yet</div>}

        <GroupMessageList
          messages={messages}
          profilesMap={profilesMap}
          currentUserId={user.uid}
          onProfileClick={(uid) => router.push(`/view-profile/${uid}`)}
          onDelete={deleteMessage}
          onPin={pinMessage}
          pinnedMessages={pinnedMessages}
          onReply={(msg) => {
            const ev = new CustomEvent("groupchat:reply", { detail: msg });
            window.dispatchEvent(ev);
          }}
        />
      </main>

      <GroupChatInput onSend={sendMessage} />
    </div>
  );
}

/* ==================== MESSAGE LIST ==================== */
function GroupMessageList({ messages = [], profilesMap = {}, currentUserId, onProfileClick, onDelete, onPin, pinnedMessages = [], onReply }) {
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
            isPinned={pinnedMessages.includes(m.id)}
            onProfileClick={() => onProfileClick(m.senderId)}
            onDelete={(forEveryone) => onDelete(m.id, forEveryone)}
            onPin={() => onPin(m.id)}
            onReply={() => onReply(m)}
          />
        );
      })}
    </div>
  );
}

/* ==================== SINGLE MESSAGE ==================== */
function GroupMessageItem({ message, profile = {}, isOwn, isPinned, onProfileClick, onDelete, onPin, onReply }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  const handleTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 70) onReply();
    setTouchStartX(null);
  };

  const senderName = profile.name || message.senderName || "User";
  const senderPic = profile.profilePic || "/default-profile.png";
  const time = message.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";

  return (
    <div
      className={`${styles.messageRow} ${isOwn ? styles.ownRow : styles.otherRow}`}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
      onTouchStart={handleTouchStart}
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
            {isPinned && <span style={{ fontSize: 12, color: "#999" }}>Pinned</span>}
          </div>
        </div>

        <div style={{ marginTop: 6 }}>
          {message.imageUrl && (
            <Image src={message.imageUrl} alt="sent" width={240} height={240} className={styles.chatImage} style={{ cursor: "pointer" }} />
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

      <div className={styles.threeDots} onClick={() => setMenuOpen(true)}>More</div>

      {menuOpen && (
        <div className={styles.messageMenu} onMouseLeave={() => setMenuOpen(false)}>
          <button onClick={() => { onReply(); setMenuOpen(false); }}>Reply</button>
          <button onClick={() => { onDelete(false); setMenuOpen(false); }}>Delete for me</button>
          <button onClick={() => { onDelete(true); setMenuOpen(false); }}>Delete for everyone</button>
          <button onClick={() => { navigator.clipboard.writeText(message.text || ""); setMenuOpen(false); }}>Copy</button>
          <button onClick={() => { onPin(); setMenuOpen(false); }}>
            {isPinned ? "Unpin" : "Pin"}
          </button>
          <button onClick={() => setMenuOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/* ==================== ULTIMATE INPUT (EMOJI + CAMERA + AUDIO) ==================== */
function GroupChatInput({ onSend }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => {
    const handler = (e) => setReplyTo(e.detail);
    window.addEventListener("groupchat:reply", handler);
    return () => window.removeEventListener("groupchat:reply", handler);
  }, []);

  const handleSend = async () => {
    if (!text.trim()) return;
    await onSend(text.trim(), null, null, replyTo);
    setText("");
    setReplyTo(null);
  };

  return (
    <div className={styles.chatInputBar}>
      {replyTo && (
        <div className={styles.replyPreview}>
          Replying to {replyTo.senderName}: {replyTo.text?.slice(0, 40)}...
          <button onClick={() => setReplyTo(null)}>X</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className={styles.chatInputText}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
          style={{ flex: 1 }}
        />

        <button onClick={handleSend} className={styles.chatSendBtn}>Send</button>
      </div>
    </div>
  );
}