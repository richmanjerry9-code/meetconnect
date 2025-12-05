// /components/chat/ImagePreview.js
"use client";

import { useEffect, useState } from "react";

export default function ImagePreview({ file, onRemove }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <img
        src={previewUrl}
        alt="Preview"
        width={100}
        height={100}
        style={{ borderRadius: 8, objectFit: "cover" }}
      />
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
