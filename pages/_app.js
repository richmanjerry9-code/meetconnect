// _app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import '../styles/globals.css';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getAuth } from 'firebase/auth';
import { app } from '../lib/firebase';
import Script from 'next/script';

const VAPID_KEY = 'YOUR_FULL_VAPID_KEY_FROM_FIREBASE_CONSOLE';

// ── Register SW → get FCM token → save with auth header ───────────────────────
async function registerSWAndGetToken(uid) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push not supported in this browser');
    return;
  }

  try {
    // 1. Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('SW registered:', registration.scope);

    // 2. Wait until SW is active
    await navigator.serviceWorker.ready;
    console.log('SW ready');

    // 3. Get FCM token
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('No FCM token — check VAPID key and notification permission.');
      return;
    }
    console.log('FCM token:', token);

    // 4. Get Firebase ID token for server-side verification
    const auth = getAuth(app);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn('No authenticated user — cannot save FCM token.');
      return;
    }
    const idToken = await currentUser.getIdToken();

    // 5. POST to /api/save-token with Bearer header
    const response = await fetch('/api/save-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Failed to save FCM token:', err);
      return;
    }
    console.log('FCM token saved for uid:', uid);
  } catch (err) {
    console.error('FCM setup error:', err);
  }
}

// ── Sub-component (inside Auth context) ───────────────────────────────────────
const AppContent = ({ Component, pageProps }) => {
  const { user } = useAuth();
  const router = useRouter();

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // ── PWA install prompt + auto-subscribe on standalone ─────────────────────
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;

    if (isStandalone) {
      setShowInstallButton(false);
      if (user?.uid && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          registerSWAndGetToken(user.uid);
        } else if (Notification.permission === 'default') {
          setTimeout(() => handleEnableNotifications(), 2000);
        }
      }
    } else {
      const isDeviceIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      setIsIOS(isDeviceIOS);
      if (isDeviceIOS) setShowInstallButton(true);

      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowInstallButton(true);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, [user]);

  // ── Google Analytics SPA tracking ─────────────────────────────────────────
  // FIX: Wait for gtag to be available before firing page_view events.
  // Previously gtag was called before the afterInteractive script had loaded,
  // meaning no hits were sent and GA4 showed 0 active users.
  useEffect(() => {
    const sendPageView = (url) => {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
          page_path: url,
          send_to: 'G-TBN1ZJECDJ',
        });
      }
    };

    // Fire for the initial page load
    sendPageView(window.location.pathname + window.location.search);

    router.events.on('routeChangeComplete', sendPageView);
    return () => router.events.off('routeChangeComplete', sendPageView);
  }, [router.events]);

  // ── FCM foreground handler ─────────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let unsubscribe;
    try {
      const messaging = getMessaging(app);
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[_app] Foreground message:', payload);
        const data = payload.data || {};
        const notification = payload.notification || {};

        if (data.action === 'open_chat' && data.chatId) {
          if (!router.pathname.includes(data.chatId)) {
            const go = window.confirm(
              ` ${notification.title || 'New message'}\n${notification.body || ''}\n\nOpen chat?`
            );
            if (go) router.push(`/inbox/${data.chatId}`);
          }
        }
      });
    } catch (err) {
      console.error('onMessage setup error:', err);
    }

    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [router]);

  // ── Request permission then register ──────────────────────────────────────
  const handleEnableNotifications = async () => {
    if (!('Notification' in window) || !user?.uid) return;
    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      if (permission === 'granted') {
        await registerSWAndGetToken(user.uid);
      }
    } catch (err) {
      console.error('Notification permission error:', err);
    }
  };

  // ── PWA install handler ────────────────────────────────────────────────────
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setShowInstallButton(false);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  return (
    <>
      {showInstallButton && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, width: '90%', maxWidth: '420px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', gap: '15px',
          backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)',
          borderRadius: '20px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f2f2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Install App</span>
              <span style={{ fontSize: 12, color: '#666' }}>Faster &amp; better experience</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={handleInstallClick} style={{ background: 'linear-gradient(45deg, #ff4785, #9b5de5)', color: 'white', border: 'none', borderRadius: 30, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Get App
            </button>
            <button onClick={() => setShowInstallButton(false)} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999' }}>
              &times;
            </button>
          </div>
        </div>
      )}

      {showIOSInstructions && <IOSPopup onClose={() => setShowIOSInstructions(false)} />}
      <Component {...pageProps} />
    </>
  );
};

const IOSPopup = ({ onClose }) => (
  <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 20 }} onClick={onClose}>
    <div style={{ backgroundColor: 'white', padding: 25, borderRadius: 20, width: '90%', maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
      <h3>Install App</h3>
      <p>1. Tap <strong>Share</strong> ⍐<br />2. Tap <strong>Add to Home Screen</strong> ⊞</p>
      <button onClick={onClose} style={{ marginTop: 10, padding: '10px 20px', border: 'none', background: '#eee', borderRadius: 10 }}>Close</button>
    </div>
  </div>
);

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      {/* FIX 1: Load the gtag.js library first */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-TBN1ZJECDJ"
        strategy="afterInteractive"
      />

      {/* FIX 2: Use a proper template literal string (backticks inside {}) so the
               script body is actually rendered. The previous version used bare {}
               object syntax which silently produced no output, so gtag was never
               defined and zero hits were sent to GA4. */}
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){ dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', 'G-TBN1ZJECDJ', {
          send_page_view: false
        });
      `}</Script>

      <AppContent Component={Component} pageProps={pageProps} />
    </AuthProvider>
  );
}