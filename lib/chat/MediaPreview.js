// /lib/chat/MediaPreview.js
"use client";

import { useEffect, useState } from "react";
import Image from 'next/image';

export default function MediaPreview({ file, onRemove }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isImage, setIsImage] = useState(true);

  useEffect(() => {
    if (!file) return;

    setIsImage(file.type.startsWith('image/'));

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) return null;

  return (
    <div style={{ marginTop: 10 }}>
      {isImage ? (
        <Image
          src={previewUrl}
          alt="Preview"
          width={100}
          height={100}
          style={{ borderRadius: 8, objectFit: "cover" }}
        />
      ) : (
        <video
          src={previewUrl}
          width={100}
          height={100}
          style={{ borderRadius: 8, objectFit: "cover" }}
          muted
          loop
          autoPlay
        />
      )}
      <div>
        <button
          type="button"
          onClick={onRemove}
          style={{
            marginTop: 5,
            background: "#f50057",
            color: "white",
            border: "none",
            padding: "4px 10px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}