import { useEffect, useState } from 'react';
import Head from 'next/head'; // <--- This was missing
import Script from 'next/script';
import { AuthProvider } from '../contexts/AuthContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // --- TRACKING: Check if App is Installed (Running in Standalone Mode) ---
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    if (isStandalone) {
      const hasLoggedInstall = localStorage.getItem('pwa_install_logged');
      if (!hasLoggedInstall) {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'pwa_install_success', {
            event_category: 'engagement',
            event_label: 'User opened installed app for first time'
          });
        }
        localStorage.setItem('pwa_install_logged', 'true');
      }
    }

    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(reg => reg.update())
        .catch(err => console.error('SW registration failed:', err));

      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .catch(err => console.error('Registration failed:', err));
      });
    }

    // 2. Check Device
    const isDeviceIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isDeviceIOS);

    // 3. Handle Android Prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandalone) setShowInstallButton(true);
    };

    // 4. Force show for iOS (if not standalone)
    if (isDeviceIOS && !isStandalone) {
      setShowInstallButton(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'pwa_install_click', {
        event_category: 'engagement',
        event_label: 'User clicked Download App button'
      });
    }

    // ANDROID LOGIC
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('PWA install outcome:', outcome);
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'pwa_android_prompt_response', {
          event_category: 'engagement',
          event_label: outcome
        });
      }

      setDeferredPrompt(null);
      setShowInstallButton(false);
    } 
    // IOS LOGIC
    else if (isIOS) {
      setShowIOSInstructions(true);
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'pwa_ios_instructions_view', {
          event_category: 'engagement',
          event_label: 'Instructions Opened'
        });
      }
    }
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
  };

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ff4785" />
      </Head>

      <style jsx global>{`
        @keyframes slideUpBanner {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>

      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-TBN1ZJECDJ"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-TBN1ZJECDJ');
        `}
      </Script>

      <AuthProvider>
        {/* --- MODERN INSTALL BANNER --- */}
        {showInstallButton && (
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
              animation: 'slideUpBanner 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
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
                onClick={handleDismiss}
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

        {/* --- IOS INSTRUCTIONS --- */}
        {showIOSInstructions && (
          <div 
            style={{
              position: 'fixed',
              top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: 'rgba(45, 52, 54, 0.7)',
              backdropFilter: 'blur(5px)',
              zIndex: 9999,
              display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: '20px'
            }}
            onClick={() => setShowIOSInstructions(false)}
          >
            <div 
              style={{
                backgroundColor: 'white',
                padding: '25px',
                borderRadius: '20px',
                width: '90%',
                maxWidth: '400px',
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                marginBottom: '20px',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowIOSInstructions(false)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '15px',
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ✕
              </button>
              
              <h3 style={{ marginTop: 0, color: '#333' }}>Install MeetConnect</h3>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                Install this app on your iPhone for the best experience.
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', textAlign: 'left' }}>
                <span style={{ fontSize: '24px' }}>1️⃣</span>
                <div>
                  Tap the <strong>Share</strong> button <br/>
                  <span style={{ fontSize: '12px', color: '#888' }}>(Look for square with arrow at bottom)</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', textAlign: 'left' }}>
                <span style={{ fontSize: '24px' }}>2️⃣</span>
                <div>
                  Scroll down & tap <br/>
                  <strong>Add to Home Screen</strong> 
                  <span style={{ display: 'inline-block', marginLeft: '5px', border: '1px solid #ccc', borderRadius: '4px', padding: '2px 4px', fontSize: '10px', background: '#f5f5f5' }}>+</span>
                </div>
              </div>
               <div style={{
                position: 'absolute',
                bottom: '-10px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
              }}></div>
            </div>
          </div>
        )}

        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}