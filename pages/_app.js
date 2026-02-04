import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { AuthProvider } from '../contexts/AuthContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(reg => {
          reg.update();
        })
        .catch(err => console.error('SW registration failed:', err));

      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('Service Worker registered:', reg))
          .catch(err => console.error('Registration failed:', err));
      });
    }

    // 2. Check if device is iOS
    const isDeviceIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isDeviceIOS);

    // 3. Handle Android PWA Install Prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    // 4. Force show button for iOS users (since the event won't fire)
    if (isDeviceIOS) {
      setShowInstallButton(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // Logic for Android
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('PWA install outcome:', outcome);
      setDeferredPrompt(null);
      setShowInstallButton(false);
    } 
    // Logic for iOS
    else if (isIOS) {
      setShowIOSInstructions(true);
    }
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
        <meta name="theme-color" content="#FFC0CB" />
      </Head>

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
        {/* Floating Install Button */}
        {showInstallButton && (
          <button
            onClick={handleInstallClick}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 9998,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              backgroundColor: '#ff69b4',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              cursor: 'pointer',
              fontWeight: '600',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <span style={{ fontSize: '20px' }}>📱</span>
            <span>Download App</span>
          </button>
        )}

        {/* iOS Instruction Modal */}
        {showIOSInstructions && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end', // Aligns directly pointing to the bottom share bar
              paddingBottom: '20px'
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

              {/* Little arrow pointing down to the browser bar */}
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