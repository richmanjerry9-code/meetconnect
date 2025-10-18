import { AppProps } from 'next/app'; // Optional: Keep for reference, but remove if error persists
import Head from 'next/head';
import '../styles/globals.css'; // Import your global CSS if you have one (optional)

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Global viewport for mobile scaling - forces phone width */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no"
        />
        {/* Optional: Prevent zoom on inputs (iOS) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
