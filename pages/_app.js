// _app.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script'; // For GA
import { useRouter } from 'next/router'; // For route tracking
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore, doc, setDoc, arrayUnion } from "firebase/firestore";
import { app } from "../lib/firebase";
import '../styles/globals.css';

// --- SUB-COMPONENT: HANDLES LOGIC INSIDE AUTH CONTEXT ---
const AppContent = ({ Component, pageProps }) => {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(reg => console.log("SW Registered"))
        .catch(err => console.error('SW registration failed:', err));
    }

    // 2. Check Standalone (Installed) Status
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone) {
      // --- INSTALLED LOGIC ---
      
      // A. Check if we need to ask for Notifications
      // Only ask if permission is 'default' (not granted/denied) AND we have a user logged in
      if (user && 'Notification' in window && Notification.permission === 'default') {
        setTimeout(() => setShowNotificationPrompt(true), 2000); // Delay for effect
      }

    } else {
      // --- BROWSER LOGIC (SHOW INSTALL PROMPTS) ---
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

  // Add foreground message handler
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          console.log('Foreground message received:', payload);
          // Customize notification display for foreground
          const notificationTitle = payload.notification?.title || 'New Message';
          const notificationOptions = {
            body: payload.notification?.body || 'You have a new message',
            icon: '/icon.png', // Replace with your app icon path
          };
          new Notification(notificationTitle, notificationOptions);
        });
      } catch (err) {
        console.error('Error setting up foreground messaging:', err);
      }
    }
  }, []);

  // --- GA ROUTE TRACKING ---
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (window.gtag) {
        window.gtag('config', 'G-XXXXXXXXXX', {
          page_path: url,
        });
      }
    };

    handleRouteChange(window.location.pathname);

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
      setShowInstallButton(false);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  // --- NOTIFICATION HANDLER ---
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;

    // 1. Request Browser Permission
    const permission = await Notification.requestPermission();
    setShowNotificationPrompt(false);

    if (permission === 'granted' && user) {
      try {
        const messaging = getMessaging(app);
        // REPLACE 'YOUR_VAPID_KEY' WITH YOUR ACTUAL KEY FROM FIREBASE CONSOLE -> PROJECT SETTINGS -> CLOUD MESSAGING
        const currentToken = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });

        if (currentToken) {
           const db = getFirestore(app);
           // Save token to user profile so we know who to send to
           const userRef = doc(db, "profiles", user.uid); // or "users" depending on your db
           await setDoc(userRef, { 
             fcmToken: currentToken,
             fcmTokens: arrayUnion(currentToken) // Optional: support multiple devices
           }, { merge: true });
           
           console.log("Notification Token Saved!");
        }
      } catch (err) {
        console.error('An error occurred while retrieving token. ', err);
      }
    }
  };

  return (
    <>
      {/* INSTALL BANNER */}
      {showInstallButton && !showNotificationPrompt && (
        <div
          style={{
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
            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            borderRadius: '20px',
            boxShadow: '0 20px 40px -10px rgba(255, 71, 133, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards', // Renamed to match Banner's keyframes
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #fff0f3, #ffe3e3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}>
              📱
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '800', fontSize: '15px', color: '#2d3436', letterSpacing: '-0.5px' }}>
                Install App
              </span>
              <span style={{ fontSize: '12px', color: '#636e72', fontWeight: '500' }}>
                Faster & better experience
              </span>
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
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255, 71, 133, 0.4)',
                whiteSpace: 'nowrap'
              }}
            >
              Get App
            </button>
            
            <button
              onClick={() => setShowInstallButton(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#b2bec3',
                fontSize: '22px',
                lineHeight: '1',
                cursor: 'pointer',
                padding: '5px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATION BANNER (Only shows if installed) */}
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

      {/* IOS INSTRUCTIONS */}
      {showIOSInstructions && (
        <IOSPopup onClose={() => setShowIOSInstructions(false)} />
      )}

      <Component {...pageProps} />
    </>
  );
};

// --- REUSABLE UI COMPONENTS ---
const Banner = ({ icon, title, subtitle, btnText, btnColor, onAction, onDismiss }) => (
  <div style={{
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 9999, width: '90%', maxWidth: '420px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '16px 20px', gap: '15px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.6)', borderRadius: '20px',
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', animation: 'slideUp 0.5s ease'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
      <div style={{ fontSize: '24px', background: '#f0f2f5', padding: '10px', borderRadius: '12px' }}>{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: '800', fontSize: '15px', color: '#333' }}>{title}</span>
        <span style={{ fontSize: '12px', color: '#666' }}>{subtitle}</span>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button onClick={onAction} style={{
        background: btnColor, color: 'white', border: 'none', borderRadius: '30px',
        padding: '10px 20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
      }}>{btnText}</button>
      <button onClick={onDismiss} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>&times;</button>
    </div>
    <style jsx global>{`@keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
  </div>
);

const IOSPopup = ({ onClose }) => (
  <div style={{
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: '20px'
  }} onClick={onClose}>
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
      <h3>Install App</h3>
      <p>1. Tap <strong>Share</strong> ⍐<br/>2. Tap <strong>Add to Home Screen</strong> ⊞</p>
      <button onClick={onClose} style={{ marginTop: '10px', padding: '10px 20px', border: 'none', background: '#eee', borderRadius: '10px' }}>Close</button>
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

      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', 'G-XXXXXXXXXX', {
            send_page_view: false
          });
        `}
      </Script>

      <AppContent Component={Component} pageProps={pageProps} />
    </AuthProvider>
  );
}