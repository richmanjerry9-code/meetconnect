import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

export async function createOrGetChat(userA, userB) {
  if (!userA || !userB) {
    throw new Error("Both user IDs are required to create a chat");
  }

  const db = getFirestore();

  // ✅ Only find chats that INCLUDE userA safely
  const q = query(
    collection(db, "privateChats"),
    where("participants", "array-contains", userA)
  );

  const existing = await getDocs(q);

  // ✅ FULL SAFETY AGAINST NULL / BROKEN DOCUMENTS
  const found = existing.docs.find((docSnap) => {
    const data = docSnap.data() || {};
    const participants = Array.isArray(data.participants)
      ? data.participants
      : [];

    return participants.includes(userB);
  });

  // ✅ Reuse existing chat
  if (found) {
    return found.id;
  }

  // ✅ Create NEW chat safely
  const docRef = await addDoc(collection(db, "privateChats"), {
    participants: [userA, userB],
    createdAt: serverTimestamp(),
    lastMessage: "",
    lastUpdated: serverTimestamp(),
    unreadCounts: {
      [userA]: 0,
      [userB]: 0,
    },
  });

  return docRef.id;
}

