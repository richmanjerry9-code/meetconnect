

// lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app"; // Merged import
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/", // Replace YOUR_PROJECT_ID with your actual Firebase project ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

let db;
if (typeof window !== 'undefined') {
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
} else {
  db = getFirestore(app);
}
export { db };

export const storage = getStorage(app);

export const database = getDatabase(app); // For online/offline presence

export { app };