// ⚠️ CRITICAL: Service workers CANNOT use ES module imports or npm packages.
// You MUST use importScripts with the compat Firebase CDN builds.
// Place this file at: /public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ⚠️ IMPORTANT: Hardcode your real config values here.
// process.env.NEXT_PUBLIC_* does NOT work inside service workers.
firebase.initializeApp({
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
});

const messaging = firebase.messaging();

// ── Background message handler ─────────────────────────────────────────────────
// Fires when a push arrives while the tab is closed / in background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || 'New Message';
  const options = {
    body: notification.body || '',
    icon: '/icons/icon-192x192.png', // use your actual PWA icon path
    badge: '/icons/badge-72x72.png',
    data: data,
    // Keep notification visible until user interacts
    requireInteraction: false,
    // Show even if a notification with the same tag is already shown
    tag: data.chatId || 'default',
    renotify: true,
  };

  self.registration.showNotification(title, options);
});

// ── Notification click handler ─────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked');
  event.notification.close();

  const data = event.notification.data || {};
  let url = 'https://www.meetconnect.co.ke/inbox'; // fallback

  if (data.action === 'open_chat' && data.chatId) {
    url = `https://www.meetconnect.co.ke/inbox/${data.chatId}`;
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if already open
        for (const client of clientList) {
          if (client.url.startsWith('https://www.meetconnect.co.ke') && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
