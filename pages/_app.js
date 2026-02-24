// _app.js (Modified: Removed OneSignal, added FCM)
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import '../styles/globals.css';
import { initializeApp } from 'firebase/app'; // If not already in lib/firebase
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '../lib/firebase'; // Your Firebase app init
import Script from 'next/script';

const VAPID_KEY = '2ObcUFEGxTlsOF09cuuTveFaBaGYuzEkGzEHLH1piiY'; // From Firebase Console

// --- SUB-COMPONENT (inside Auth context) ---
const AppContent = ({ Component, pageProps }) => {
  const { user } = useAuth();
  const router = useRouter();

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // -------------------------------
  // SERVICE WORKER + INSTALL LOGIC (unchanged, but removed Firebase SW unregister)
  // -------------------------------
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;

    console.log('Is app in standalone mode?', isStandalone); // Debug log

    if (isStandalone) {
      setShowInstallButton(false); // Explicitly ensure banner is hidden
      // Auto-subscribe or prompt for notifications if installed + logged in
      if (user && 'Notification' in window) {
        setTimeout(() => {
          handleEnableNotifications(); // Updated to FCM version
        }, 2000);
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
  // GOOGLE ANALYTICS SPA TRACKING (unchanged)
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
  // FCM FOREGROUND MESSAGE HANDLER (new: replaces OneSignal click handler)
  // -------------------------------
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        const data = payload.data || {};
        if (data.action === 'open_chat' && data.chatId) {
          router.push(`/inbox/${data.chatId}`);
        }
        // Optionally show an in-app toast here instead of system notification
      });
    }
  }, [router]);

  // -------------------------------
  // INSTALL BUTTON HANDLER (unchanged)
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
  // ENABLE NOTIFICATIONS HANDLER (updated to FCM)
  // -------------------------------
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const messaging = getMessaging(app);
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          await fetch('/api/save-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, uid: user.uid })
          });
          console.log('FCM token saved');
        }
      }
    } catch (error) {
      console.error('Notification permission error:', error);
    }
  };

  // Extra log for banner visibility (temporary debug)
  useEffect(() => {
    console.log('Install banner visible?', showInstallButton);
  }, [showInstallButton]);

  return (
    <>
      {/* INSTALL BANNER (unchanged) */}
      {showInstallButton && (
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

      {/* IOS INSTALL INSTRUCTIONS (unchanged) */}
      {showIOSInstructions && <IOSPopup onClose={() => setShowIOSInstructions(false)} />}

      <Component {...pageProps} />
    </>
  );
};

// -------------------------------
// UI COMPONENTS (unchanged)
// -------------------------------
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
// ROOT APP (Modified: Removed OneSignal scripts)
// -------------------------------
export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      {/* Google Analytics (unchanged) */}
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


