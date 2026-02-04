import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { AuthProvider } from '../contexts/AuthContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => {
            console.log('Service Worker registered:', reg);
            reg.update();
          })
          .catch(err => console.error('Registration failed:', err));
      });
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      setShowInstallButton(false);
    } else {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowInstallButton(true);
      });
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('PWA install outcome:', outcome);
      setDeferredPrompt(null);
      setShowInstallButton(false);
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
        {showInstallButton && (
          <button 
            onClick={handleInstallClick} 
            style={{ 
              position: 'fixed', 
              bottom: '80px', 
              right: '20px', 
              padding: '10px 15px', 
              background: '#ff69b4', 
              border: 'none', 
              cursor: 'pointer', 
              borderRadius: '25px', 
              fontSize: '16px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              color: '#fff',
              height: 'auto',
              width: 'auto'
            }}
            title="Install MeetConnect App for Notifications"
          >
            <div style={{ fontSize: '24px' }}>📱</div>
            <span style={{ fontSize: '12px', marginTop: '5px' }}>Download App</span>
          </button>
        )}
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}