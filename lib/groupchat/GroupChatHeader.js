import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { db } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import styles from "../../styles/chat.module.css";

export default function GroupChatHeader({ title = "MeetConnect Group Chat 💕", memberCount = 0, onLeave }) {
  const router = useRouter();
  const [photoURL, setPhotoURL] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "groupChats", "main"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPhotoURL(data.photoURL || "");
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className={styles.chatHeader} style={{ display: "flex", alignItems: "center" }}>
      
      {/* ✅ FAR LEFT BACK ARROW */}
      <button
        onClick={() => router.push("/inbox")}
        className={styles.backBtn}
        style={{ marginRight: "12px" }}
      >
        ←
      </button>

      {/* ✅ CENTER TITLE ROW */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flex: 1,
        }}
      >
        {/* ✅ GROUP PHOTO OR FALLBACK TO FAVICON */}
        <Image
          src={photoURL || "/favicon-512x512.png"}
          alt="MeetConnect"
          width={32}
          height={32}
        />

        <div>
          <div className={styles.title}>{title}</div>
          <div className={styles.subtitle} style={{ fontSize: "12px", opacity: 0.7 }}>{memberCount} members</div>
        </div>
      </div>

      {/* ✅ RIGHT SIDE MENU */}
      <div className={styles.headerActions} style={{ position: "relative" }}>
        <button className={styles.iconBtn} onClick={() => setMenuOpen(!menuOpen)}>⋮</button>
        {menuOpen && (
          <div className={styles.menuDropdown} style={{ position: "absolute", right: 0, top: "100%", background: "white", border: "1px solid #ccc", borderRadius: "8px", padding: "8px" }}>
            <button onClick={() => { onLeave(); setMenuOpen(false); }}>Leave group</button>
          </div>
        )}
      </div>
    </div>
  );
}



