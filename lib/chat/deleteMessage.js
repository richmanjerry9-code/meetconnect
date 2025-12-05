// Assuming you have separate files for each function, add this new file: /lib/chat/deleteMessage.js
import { getFirestore, doc, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore";

export async function deleteMessage(path, msgId, userId, forEveryone = false) {
  const db = getFirestore();
  const msgRef = doc(db, path, msgId);

  if (forEveryone) {
    // ✅ Delete for everyone (remove document)
    await deleteDoc(msgRef);
  } else {
    // ✅ Delete for me (add to deletedBy)
    await updateDoc(msgRef, {
      deletedBy: arrayUnion(userId),
    });
  }

  // ✅ Optional: If last message deleted, update chat lastMessage to "" or handle empty chats (implement if needed)
}