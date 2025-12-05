import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { db } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import styles from "../../styles/chat.module.css";

export default function GroupChatHeader({ title = "MeetConnect Group Chat 💕" }) {
  const router = useRouter();
  const [photoURL, setPhotoURL] = useState("");

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
        onClick={() => router.push("/")}
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
        {/* ✅ SMALL FAVICON NEXT TO TITLE ONLY */}
        <Image
          src="/favicon-512x512.png"
          alt="MeetConnect"
          width={32}
          height={32}
        />

        <div>
          <div className={styles.title}>{title}</div>
        </div>
      </div>

      {/* ✅ RIGHT SIDE MENU */}
      <div className={styles.headerActions}>
        <button className={styles.iconBtn}>⋮</button>
      </div>
    </div>
  );
}



