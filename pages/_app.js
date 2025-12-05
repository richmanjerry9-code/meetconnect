// /pages/_app.js
import Head from 'next/head';
import Script from 'next/script';
import { AuthProvider } from '../contexts/AuthContext'; // ✅ FIXED PATH
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
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
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}
