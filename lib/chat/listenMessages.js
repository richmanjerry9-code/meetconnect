import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export function listenMessages(collectionPath, callback) {
  const db = getFirestore();
  const ref = collection(db, collectionPath);
  const q = query(ref, orderBy("timestamp", "asc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    try {
      if (!snapshot || !snapshot.docs) {
        callback([]); // ✅ NEVER return null
        return;
      }

      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      callback(Array.isArray(messages) ? messages : []); // ✅ HARD SAFETY
    } catch (err) {
      console.error("listenMessages crash:", err);
      callback([]); // ✅ NEVER allow undefined to escape
    }
  });

  return unsubscribe;
}

