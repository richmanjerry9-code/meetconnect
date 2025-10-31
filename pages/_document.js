// pages/_document.js

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon for browsers */}
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512x512.png" />
        <link rel="shortcut icon" href="/favicon-192x192.png" />

        {/* Apple / iOS */}
        <link rel="apple-touch-icon" sizes="192x192" href="/favicon-192x192.png" />

        {/* iOS app name */}
        <meta name="apple-mobile-web-app-title" content="MeetConnect" />

        {/* Force browser to reload favicon */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />

        {/* Fix deprecated meta tag warning */}
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}



