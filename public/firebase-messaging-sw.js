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

// Basic offline caching
const CACHE_NAME = 'meetconnect-cache-v1';
const urlsToCache = [
  '/',
  '/inbox',
  '/styles/chat.module.css',
  // Add more as needed
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

console.log('SW: Loaded successfully');