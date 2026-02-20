// lib/groupchat/GroupMessageItem.js
"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import styles from "../../styles/groupchat.module.css";

export default function GroupMessageItem({
  message,
  profile = {},
  isOwn,
  onProfileClick,
  quotedMessage,
  isPinned,
  onDelete,
  onReply,
  onPin,
  onImageClick,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs for gestures and audio
  const touchTimeout = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const audioRef = useRef(null);
  const isSwipingRef = useRef(false); // Prevents long press during scroll/swipe

  // === TOUCH GESTURES: Scroll-Safe + Swipe-to-Reply + Long Press ===
  const handleTouchStartInternal = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isSwipingRef.current = false;

    // Long press timer (cancels on swipe/scroll)
    touchTimeout.current = setTimeout(() => {
      if (!isSwipingRef.current) {
        setShowMenu(true);
        if (navigator.vibrate) navigator.vibrate(50); // Premium haptic
      }
    }, 420); // Snappy for premium feel
  };

  const handleTouchMoveInternal = (e) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Vertical scroll = ignore gestures (smooth scrolling)
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.8) {
      clearTimeout(touchTimeout.current);
      return;
    }

    // Horizontal swipe detected
    if (Math.abs(deltaX) > 25) {
      isSwipingRef.current = true;
      clearTimeout(touchTimeout.current);

      // Swipe LEFT for reply (60px threshold)
      if (deltaX < -60) {
        setHighlight(true);
        if (onReply) onReply(message);
        setTimeout(() => setHighlight(false), 750); // Quick premium fade
      }
    }
  };

  const handleTouchEndInternal = () => {
    clearTimeout(touchTimeout.current);
    touchStartRef.current = { x: 0, y: 0 };
    isSwipingRef.current = false;
  };

  // === AUDIO PLAYER (Premium WhatsApp-style) ===
  const toggleAudio = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => setCurrentTime(audio.currentTime);
    const setAudioDuration = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", setAudioDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", setAudioDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time) || time === Infinity) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const senderName = profile.name || message.senderName || "User";
  const senderPic = profile.profilePic || "/default-profile.png";
  const time = message.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";

  return (
    <div
      className={`${styles.messageRow} ${
        isOwn ? styles.ownRow : styles.otherRow
      } ${highlight ? styles.highlighted : ""}`}
      // Mobile smoothness: No text select, iOS callout, vertical pan only
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "pan-y",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      onTouchStart={onTouchStart || handleTouchStartInternal}
      onTouchEnd={onTouchEnd || handleTouchEndInternal}
      onTouchMove={onTouchMove || handleTouchMoveInternal}
    >
      {!isOwn && (
        <button onClick={onProfileClick} className={styles.profileBtn}>
          <Image src={senderPic} width={40} height={40} alt="" className={styles.avatar} />
        </button>
      )}

      {/* BUBBLE */}
      <div
        className={`${styles.bubble} ${
          isOwn ? styles.ownBubble : styles.otherBubble
        }`}
      >
        {/* PINNED */}
        {isPinned && <span className={styles.pinned}>📌</span>}

        {/* QUOTED */}
        {message.replyTo && (
          <div className={styles.quoted}>
            <div style={{ fontSize: "12px", opacity: 0.8, fontWeight: "600" }}>
              {message.replyTo.senderName || "Someone"}
            </div>
            <div style={{ fontSize: "13px", opacity: 0.7 }}>
              {message.replyTo.text || "Photo/Voice"}
            </div>
          </div>
        )}

        {/* Sender Name for Others */}
        {!isOwn && (
          <div style={{ fontSize: 13, fontWeight: 700, color: "#D81B60" }}>{senderName}</div>
        )}

        {/* IMAGE */}
        {message.imageUrl && (
          <Image
            src={message.imageUrl}
            alt="Chat"
            width={220}
            height={220}
            className={styles.chatImage}
            onClick={() => onImageClick?.(message.imageUrl)}
            style={{ cursor: "pointer" }}
          />
        )}

        {/* AUDIO (Glassmorphic Premium) */}
        {message.audioUrl && (
          <div className={styles.audioWrapper}>
            <audio ref={audioRef} src={message.audioUrl} preload="metadata" />
            <button
              onClick={toggleAudio}
              className={styles.audioButton} // Updated class
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <div className={styles.audioTrack}>
              <div
                className={styles.audioProgress}
                style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
              />
            </div>

            <span className={styles.audioDuration}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}

        {/* TEXT */}
        {message.text && <p className={styles.messageText}>{message.text}</p>}

        {/* META: Time + Ticks */}
        <div className={styles.messageTime}>
          {time}
          {isOwn && (
            <span className={styles.tick}>
              {message.seenBy?.length > 1 ? "✅✅" : "✅"}
            </span>
          )}
        </div>
      </div>

      {isOwn && (
        <button onClick={onProfileClick} className={styles.profileBtn}>
          <Image src={senderPic} width={36} height={36} alt="" className={styles.avatar} />
        </button>
      )}

      {/* LONG PRESS MENU (Premium Glass) */}
      {showMenu && (
        <div className={styles.messageMenu}>
          <button
            onClick={() => {
              onReply?.(message);
              setShowMenu(false);
            }}
          >
            Reply
          </button>
          <button
            onClick={() => {
              onDelete?.(message.id, false);
              setShowMenu(false);
            }}
          >
            Delete for me
          </button>
          <button
            onClick={() => {
              onDelete?.(message.id, true);
              setShowMenu(false);
            }}
          >
            Delete for everyone
          </button>
          <button
            onClick={() => {
              onPin?.(message.id);
              setShowMenu(false);
            }}
          >
            {isPinned ? "Unpin" : "Pin"}
          </button>
          <button onClick={() => setShowMenu(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}