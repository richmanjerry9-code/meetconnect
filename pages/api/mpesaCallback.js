// pages/api/mpesaCallback.js
import { db } from "../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const callback = req.body.Body.stkCallback;
    const { ResultCode, CheckoutRequestID } = callback;

    if (ResultCode === 0) {
      const meta = callback.CallbackMetadata.Item;
      const amount = meta.find((i) => i.Name === "Amount")?.Value;
      const phone = meta.find((i) => i.Name === "PhoneNumber")?.Value;

      // Look up pending upgrade
      const snapshot = await getDoc(doc(db, "pendingUpgrades", phone.toString()));
      if (snapshot.exists()) {
        const pending = snapshot.data();
        await setDoc(
          doc(db, "profiles", pending.userId),
          {
            membership: pending.level,
            membershipExpiry: calcExpiry(pending.duration),
            walletBalance: 0, // optional deduction handling
          },
          { merge: true }
        );
        await setDoc(doc(db, "pendingUpgrades", pending.userId), { status: "success" }, { merge: true });
      } else {
        // Otherwise treat as wallet top-up
        const userRef = doc(db, "profiles", phone.toString());
        const userDoc = await getDoc(userRef);
        const balance = (userDoc.data()?.walletBalance || 0) + amount;
        await setDoc(userRef, { walletBalance: balance }, { merge: true });
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
}

// helper
function calcExpiry(duration) {
  const now = new Date();
  const map = { "3 Days": 3, "7 Days": 7, "15 Days": 15, "30 Days": 30 };
  now.setDate(now.getDate() + (map[duration] || 0));
  return now.toISOString();
}
