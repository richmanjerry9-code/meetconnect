
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";

export async function sendMessage(
  collectionPath,
  text,
  imageUrl,
  userId,
  username,
  replyingTo,
  audioUrl
) {
  if (!collectionPath || (!text && !imageUrl && !audioUrl) || !userId) return;

  const db = getFirestore();
  const ref = collection(db, collectionPath);

  // ✅ SAFE MESSAGE WRITE
  await addDoc(ref, {
    text: text || "",
    imageUrl: imageUrl || null,
    audioUrl: audioUrl || null,
    userId,
    username: username || "User",
    timestamp: serverTimestamp(),
    replyingTo: replyingTo || null,
    seenBy: [],
    deletedFor: [],
  });

  // ✅ ✅ ✅ SAFE PRIVATE CHAT METADATA WRITE
  if (collectionPath.startsWith("privateChats/")) {
    const parts = collectionPath.split("/");
    const chatId = parts.length > 1 ? parts[1] : null;
    if (!chatId) return;

    const chatRef = doc(db, "privateChats", chatId);

    await setDoc(
      chatRef,
      {
        lastMessage: text || (imageUrl ? "Image" : "Audio"),
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );
  }
}