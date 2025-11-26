// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    // add others similarly
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // allow all external hosts (optional)
      },
    ],
  },
  api: {
    bodyParser: {
      sizeLimit: '25mb',  // Increased limit for larger payloads (fallback if needed)
    },
  },
};

module.exports = nextConfig;
