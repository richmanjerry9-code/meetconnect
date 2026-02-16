"use client"; // Ensure this is a client component (required for hooks like useEffect)

import { useState, useRef, useEffect } from "react"; // ← Added useEffect import
import Image from "next/image";
import styles from "../../styles/chat.module.css";

export default function MessageItem({
  message,
  isOwn,
  quotedMessage,
  isPinned,
  onDelete,
  onReply,
  onPin,
  onImageClick,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs for touch and audio
  const touchTimeout = useRef(null);
  const touchStartX = useRef(0);
  const audioRef = useRef(null);

  const handleTouchStart = () => {
    touchTimeout.current = setTimeout(() => setShowMenu(true), 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    clearTimeout(touchTimeout.current);
  };

  const handleTouchMove = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    // Cancel long press if moved significantly
    if (Math.abs(diff) > 20) {
      clearTimeout(touchTimeout.current);
    }

    if (diff > 50) { // Swipe left > 50px
      setHighlight(true);
      if (onReply) onReply(message.id); // Trigger reply
      setTimeout(() => setHighlight(false), 1000); // Reset highlight after 1s
    }
  };

  const handleTouchStartCoord = (e) => {
    touchStartX.current = e.touches[0].clientX;
    handleTouchStart();
  };

  // Toggle audio play/pause
  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  // Sync play/pause state and progress
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

  // Handle seeking via drag on the slider
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Format time (mm:ss)
  const formatTime = (time) => {
    if (isNaN(time) || time === Infinity) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`${styles.messageRow} ${
        isOwn ? styles.ownRow : styles.otherRow
      } ${highlight ? styles.highlighted : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      onTouchStart={handleTouchStartCoord}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* MESSAGE BUBBLE */}
      <div
        className={`${styles.bubble} ${
          isOwn ? styles.ownBubble : styles.otherBubble
        }`}
        style={{ maxWidth: "80%" }}
      >
        {/* PINNED INDICATOR */}
        {isPinned && <span className={styles.pinned}>📌</span>}

        {/* QUOTED MESSAGE */}
        {quotedMessage && (
          <div className={styles.quoted}>
            <p>
              {quotedMessage.text ||
                (quotedMessage.imageUrl
                  ? "(Image)"
                  : quotedMessage.audioUrl
                  ? "(Audio)"
                  : "")}
            </p>
          </div>
        )}

        {message.imageUrl && (
          <Image
            src={message.imageUrl}
            alt="Chat"
            width={220}
            height={220}
            className={styles.chatImage}
            onClick={() => onImageClick && onImageClick(message.imageUrl)}
            style={{ cursor: "pointer" }}
          />
        )}

        {/* WHATSAPP-STYLE AUDIO PLAYER */}
        {message.audioUrl && (
          <div className={styles.audioWrapper}>
            <audio ref={audioRef} src={message.audioUrl} preload="metadata" />
            <button onClick={toggleAudio} className={styles.audioPlayButton}>
              {isPlaying ? "⏸" : "▶"}
            </button>

            <input
              type="range"
              className={styles.audioSeekBar}
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
            />

            <span className={styles.audioTimeDisplay}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}

        {message.text && <p className={styles.messageText}>{message.text}</p>}

        {/* MESSAGE TIME */}
        <div className={styles.messageTime}>
          {message.timestamp?.toDate?.().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }) || ""}
        </div>

        {/* TICKS */}
        {isOwn && (
          <span className={styles.tick}>
            {message.seenBy?.includes(message.recipientId) ? "✅✅" : "✅"}
          </span>
        )}
      </div>

      {/* CONTEXT MENU */}
      {showMenu && (
        <div className={styles.messageMenu}>
          <button
            onClick={() => {
              if (onReply) onReply(message.id);
              setShowMenu(false);
            }}
          >
            Reply to this message
          </button>
          <button
            onClick={() => {
              if (onDelete) onDelete(message.id, false);
              setShowMenu(false);
            }}
          >
            Delete for me
          </button>
          <button
            onClick={() => {
              if (onDelete) onDelete(message.id, true);
              setShowMenu(false);
            }}
          >
            Delete for everyone
          </button>
          <button
            onClick={() => {
              if (onPin) onPin(message.id);
              setShowMenu(false);
            }}
          >
            Pin message
          </button>
          <button onClick={() => setShowMenu(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}