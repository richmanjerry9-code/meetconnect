// /pages/_app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getFirestore, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { app } from '../lib/firebase';
import '../styles/globals.css';

// --- SUB-COMPONENT (inside Auth context) ---
const AppContent = ({ Component, pageProps }) => {
  const { user } = useAuth();
  const router = useRouter();

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // -------------------------------
  // SERVICE WORKER + INSTALL LOGIC
  // -------------------------------
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(() => console.log('SW Registered'))
        .catch(err => console.error('SW registration failed:', err));
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;

    if (isStandalone) {
      // Ask for notifications only if installed + logged in
      if (user && 'Notification' in window && Notification.permission === 'default') {
        setTimeout(() => setShowNotificationPrompt(true), 2000);
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

  // -------------------------------
  // FOREGROUND PUSH NOTIFICATIONS
  // -------------------------------
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          console.log('Foreground message:', payload);
          const title = payload.notification?.title || 'New message';
          const options = {
            body: payload.notification?.body || 'You have a new message',
            icon: '/favicon-192x192.png',
            data: payload.data,
          };
          new Notification(title, options);
        });
      } catch (err) {
        console.error('Foreground messaging error:', err);
      }
    }
  }, []);

  // -------------------------------
  // GOOGLE ANALYTICS SPA TRACKING
  // -------------------------------
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (window.gtag) {
        window.gtag('config', 'G-TBN1ZJECDJ', {
          page_path: url,
        });
      }
    };

    handleRouteChange(window.location.pathname);
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  // -------------------------------
  // INSTALL BUTTON HANDLER
  // -------------------------------
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

  // -------------------------------
  // ENABLE NOTIFICATIONS HANDLER
  // -------------------------------
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;

    const permission = await Notification.requestPermission();
    setShowNotificationPrompt(false);

    if (permission === 'granted' && user) {
      try {
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        });

        if (token) {
          const db = getFirestore(app);
          const userRef = doc(db, 'profiles', user.uid);
          await setDoc(
            userRef,
            {
              fcmToken: token,
              fcmTokens: arrayUnion(token),
            },
            { merge: true }
          );
          console.log('FCM token saved');
        }
      } catch (err) {
        console.error('Failed to get FCM token:', err);
      }
    }
  };

  return (
    <>
      {/* INSTALL BANNER */}
      {showInstallButton && !showNotificationPrompt && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: '90%',
          maxWidth: '420px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          gap: '15px',
          backgroundColor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#f2f2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              📱
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '15px' }}>Install App</span>
              <span style={{ fontSize: '12px', color: '#666' }}>Faster & better experience</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleInstallClick}
              style={{
                background: 'linear-gradient(45deg, #ff4785, #9b5de5)',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                padding: '10px 20px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Get App
            </button>
            <button
              onClick={() => setShowInstallButton(false)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                color: '#999',
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATION BANNER */}
      {showNotificationPrompt && (
        <Banner
          icon="🔔"
          title="Enable Inbox Alerts"
          subtitle="Get notified for new messages"
          btnText="Enable"
          btnColor="linear-gradient(45deg, #4785ff, #5de59b)"
          onAction={handleEnableNotifications}
          onDismiss={() => setShowNotificationPrompt(false)}
        />
      )}

      {/* IOS INSTALL INSTRUCTIONS */}
      {showIOSInstructions && <IOSPopup onClose={() => setShowIOSInstructions(false)} />}

      <Component {...pageProps} />
    </>
  );
};

// -------------------------------
// UI COMPONENTS
// -------------------------------
const Banner = ({ icon, title, subtitle, btnText, btnColor, onAction, onDismiss }) => (
  <div style={{
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    width: '90%',
    maxWidth: '420px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    gap: '15px',
    backgroundColor: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
    borderRadius: '20px',
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
      <div style={{ fontSize: '24px', background: '#f0f2f5', padding: '10px', borderRadius: '12px' }}>{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 800, fontSize: '15px' }}>{title}</span>
        <span style={{ fontSize: '12px', color: '#666' }}>{subtitle}</span>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button onClick={onAction} style={{
        background: btnColor,
        color: 'white',
        border: 'none',
        borderRadius: '30px',
        padding: '10px 20px',
        fontWeight: 700,
        fontSize: '13px',
        cursor: 'pointer',
      }}>
        {btnText}
      </button>
      <button onClick={onDismiss} style={{
        background: 'transparent',
        border: 'none',
        fontSize: '20px',
        cursor: 'pointer',
        color: '#999',
      }}>
        &times;
      </button>
    </div>
  </div>
);

const IOSPopup = ({ onClose }) => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: '20px',
    }}
    onClick={onClose}
  >
    <div
      style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '20px',
        width: '90%',
        maxWidth: '400px',
        textAlign: 'center',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3>Install App</h3>
      <p>
        1. Tap <strong>Share</strong> ⍐
        <br />
        2. Tap <strong>Add to Home Screen</strong> ⊞
      </p>
      <button
        onClick={onClose}
        style={{
          marginTop: '10px',
          padding: '10px 20px',
          border: 'none',
          background: '#eee',
          borderRadius: '10px',
        }}
      >
        Close
      </button>
    </div>
  </div>
);

// -------------------------------
// ROOT APP
// -------------------------------
export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-TBN1ZJECDJ"
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', 'G-TBN1ZJECDJ', {
            send_page_view: false
          });
        `}
      </Script>

      <AppContent Component={Component} pageProps={pageProps} />
    </AuthProvider>
  );
}
