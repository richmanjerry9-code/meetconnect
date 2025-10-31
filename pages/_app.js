import { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Global viewport for mobile scaling */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no"
        />
        {/* Optional: Prevent zoom on inputs (iOS) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </Head>

      {/* ✅ Google Analytics */}
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

      {/* Your actual pages */}
      <Component {...pageProps} />
    </>
  );
}

