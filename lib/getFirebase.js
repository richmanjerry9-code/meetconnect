// lib/getFirebase.js
import app from './firebase';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
