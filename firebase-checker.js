// firebase-checker.js
// Run with: node firebase-checker.js

import 'dotenv/config'; // Load .env or .env.local
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { signInWithEmailAndPassword } from 'firebase/auth';

console.log("🚀 Starting Firebase & Next.js checker...\n");

// 1️⃣ Check if firebase.js exists
const firebasePath = path.join('lib', 'firebase.js');
if (!fs.existsSync(firebasePath)) {
    console.error("❌ lib/firebase.js not found! Make sure the file exists.");
    process.exit(1);
} else {
    console.log("✅ lib/firebase.js exists.");
}

// 2️⃣ Import auth from firebase.js
(async () => {
    try {
        const module = await import(pathToFileURL(firebasePath).href);
        const { auth } = module;

        if (!auth) throw new Error("Auth object not exported from lib/firebase.js");
        console.log("✅ Firebase Auth object loaded correctly.\n");

        checkEnvVars();

        // 3️⃣ Test login credentials (update these with a valid Firebase account)
        const testEmail = process.env.TEST_FIREBASE_EMAIL || 'test@example.com';
        const testPassword = process.env.TEST_FIREBASE_PASSWORD || 'password123';

        console.log(`🔑 Testing login with email: ${testEmail}`);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
            console.log("✅ Login successful!");
            console.log("User UID:", userCredential.user.uid);
        } catch (loginErr) {
            console.error("❌ Login failed:", loginErr.message);
        }

    } catch (err) {
        console.error("❌ Error loading Firebase Auth:", err.message);
        process.exit(1);
    }
})();

// Validate environment variables
function checkEnvVars() {
    const requiredVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID'
    ];

    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.error("❌ Missing environment variables in .env or .env.local:", missing.join(', '));
    } else {
        console.log("✅ All Firebase environment variables exist.\n");
    }
}



