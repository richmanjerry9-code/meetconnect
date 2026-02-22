import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
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
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;

    console.log('Is app in standalone mode?', isStandalone); // Debug log

    if (isStandalone) {
      setShowInstallButton(false); // Explicitly ensure banner is hidden
      // Auto-subscribe or prompt for notifications if installed + logged in
      if (user && 'Notification' in window) {
        setTimeout(() => {
          if (Notification.permission === 'granted') {
            // Auto-subscribe if permission already granted in settings
            if (window.OneSignal) {
              window.OneSignalDeferred = window.OneSignalDeferred || [];
              window.OneSignalDeferred.push(async function(OneSignal) {
                await OneSignal.registerForPushNotifications();
                await OneSignal.login(user.uid); // Ensure linked to user
                console.log('Auto-subscribed to notifications (permission already granted)');
              });
            }
          } else if (Notification.permission === 'default') {
            setShowNotificationPrompt(true); // Show banner to prompt
          }
          // If 'denied', do nothing—respect user choice
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
  // ONESIGNAL USER LINKING (with guard)
  // -------------------------------
  useEffect(() => {
    if (user && window.OneSignal && !window.OneSignal.initialized) { // Guard against multiple inits
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.login(user.uid);
      });
    }
  }, [user]);

  // -------------------------------
  // NOTIFICATION CLICK HANDLER
  // -------------------------------
  useEffect(() => {
    if (window.OneSignal) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        OneSignal.Notifications.addEventListener('click', (event) => {
          const data = event.notification.data;
          if (data && data.action === 'open_chat' && data.chatId) {
            router.push(`/inbox/${data.chatId}`);
          } else {
            router.push('/inbox');
          }
        });
      });
    }
  }, [router]);

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

    if (window.OneSignal) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.showSlidedownPrompt();
      });
    }

    setShowNotificationPrompt(false);
  };

  // -------------------------------
  // AUTO-UNREGISTER FIREBASE SW
  // -------------------------------
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          if (reg.active && reg.active.scriptURL.includes('firebase-messaging-sw.js')) { // More precise check
            reg.unregister().then(() => {
              console.log('Firebase SW unregistered successfully');
            }).catch(err => console.error('Unregister error:', err));
          }
        });
      }).catch(err => console.error('Get registrations error:', err));
    }
  }, []);

  // Extra log for banner visibility (temporary debug)
  useEffect(() => {
    console.log('Install banner visible?', showInstallButton);
  }, [showInstallButton]);

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

      {/* OneSignal SDK */}
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />

      {/* OneSignal Init (Deferred) */}
      <Script id="onesignal-init" strategy="afterInteractive">
        {`
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          OneSignalDeferred.push(async function(OneSignal) {
            try {
              await OneSignal.init({
                appId: "afbf7304-c2f1-4750-ba3b-7dbd707926a7", // Verify in your OneSignal dashboard
                safari_web_id: null, // Add if supporting Safari
                notifyButton: { enable: true },
                allowLocalhostAsSecureOrigin: true, // For dev testing
                serviceWorkerPath: "OneSignalSDKWorker.js",
                serviceWorkerParam: { scope: "/" }
              });
              console.log('OneSignal initialized successfully');
            } catch (error) {
              console.error('OneSignal init error:', error);
            }
          });
        `}
      </Script>

      <AppContent Component={Component} pageProps={pageProps} />
    </AuthProvider>
  );
}