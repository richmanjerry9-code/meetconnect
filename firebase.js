import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDT7G125cf8awQeCgojWcdixzOkubgLwmE",
  authDomain: "meetconnect-bb820.firebaseapp.com",
  projectId: "meetconnect-bb820",
  storageBucket: "meetconnect-bb820.firebasestorage.app",
  messagingSenderId: "967540022685",
  appId: "1:967540022685:web:6cdf7249b32bd2149ee374",
  measurementId: "G-TBN1ZJECDJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);