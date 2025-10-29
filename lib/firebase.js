// lib/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Pull from env (fallback to hardcoded for safety—remove in prod)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate config (log error if missing)
if (!firebaseConfig.apiKey) {
  console.error('🚨 Firebase config missing—check .env.local');
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// App Check: FULLY browser-only (no server execution)
if (typeof window !== 'undefined') {
  // Dev debug token (safe: only in browser)
  if (process.env.NODE_ENV === 'development') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    console.log('⚡ App Check debug mode enabled (browser only)');
  }

  // TODO: Enable prod init with real reCAPTCHA v3 key
  // Add NEXT_PUBLIC_RECAPTCHA_SITE_KEY to .env.local
  // const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || 'YOUR_RECAPTCHA_SITE_KEY';
  // initializeAppCheck(app, {
  //   provider: new ReCaptchaV3Provider(siteKey),
  //   isTokenAutoRefreshEnabled: true,
  // });
}