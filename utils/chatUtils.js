// utils/chatUtils.js (new file with Firebase utility functions)
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getStorage, ref, uploadBytes, getDownloadURL } from "firebase/firestore";
import { getApp } from "firebase/app"; // If needed for storage

// Listen to messages in real-time
export function listenMessages(path, callback) {
  const db = getFirestore();
  const messagesRef = collection(db, path);
  const q = query(messagesRef, orderBy("createdAt", "asc")); // Assuming createdAt field

  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(msgs);
  });
}

// Send a message
export async function sendMessage(path, text, imageUrl, senderId, senderName, replyingToId = null) {
  const db = getFirestore();
  const messagesRef = collection(db, path);
  await addDoc(messagesRef, {
    text,
    imageUrl,
    senderId,
    senderName,
    createdAt: serverTimestamp(),
    seenBy: [],
    replyingTo: replyingToId,
    deletedFor: [],
  });
}

// Upload image to Firebase Storage
export async function uploadImage(file, folder) {
  const storage = getStorage();
  const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}