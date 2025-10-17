import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

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

// App Check initialization
if (typeof window !== 'undefined') {
  if (process.env.NODE_ENV === 'development') {
    // Local development debug mode
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    console.log('⚡ App Check debug mode enabled for localhost');
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
    isTokenAutoRefreshEnabled: true
  });
}









