// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

console.log('SW: Loading...');

firebase.initializeApp({
  apiKey: "YOUR_PUBLIC_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('SW: Background message received', payload);
  const title = payload.notification?.title || payload.data?.title || 'New Message on MeetConnect';
  const body = payload.notification?.body || payload.data?.body || 'You have a new message!';
  const options = {
    body: body,
    icon: '/favicon-192x192.png',
    badge: '/favicon-512x512.png',
    data: { chatId: payload.data?.chatId || '/' }
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification clicked', event.notification.data);
  event.notification.close();
  const chatId = event.notification.data.chatId;
  event.waitUntil(clients.openWindow(`/inbox/${chatId}`));
});

// Basic offline caching with per-URL diagnostics
const CACHE_NAME = 'meetconnect-cache-v3'; // Bump version for updates
const urlsToCache = [
  '/', // Root (usually caches index.html)
  '/manifest.json', // PWA manifest (in /public)
  '/favicon-192x192.png', // Icon (adjust if path differs)
  '/favicon-512x512.png', // Badge (adjust if path differs)
  // '/inbox', // Uncomment if static; dynamic SSR pages may fail
  // '/styles/chat.module.css', // Uncomment ONLY if exact path exists (check Network tab); Next.js hashes CSS as /_next/static/css/[hash].css
  // Add more static assets (e.g., '/_next/static/js/[hash].js' from build)
];

self.addEventListener('install', (event) => {
  console.log('SW: Installing with caching...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of urlsToCache) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }
          await cache.put(url, response);
          console.log(`SW: Successfully cached ${url}`);
        } catch (error) {
          console.error(`SW: Failed to cache ${url}:`, error);
          // Continue to next URL without breaking install
        }
      }
      console.log('SW: Caching complete (with possible skips)');
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activating and cleaning old caches...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`SW: Deleting old cache ${name}`);
            return caches.delete(name);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        console.log(`SW: Cache hit for ${event.request.url}`);
        return response;
      }
      console.log(`SW: Cache miss, fetching ${event.request.url}`);
      return fetch(event.request);
    })
  );
});

console.log('SW: Loaded successfully');