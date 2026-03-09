// lib/useGoogleMaps.js
// Loads Google Maps JS API once and exposes a ready flag.
// Usage: const { ready } = useGoogleMaps();

import { useState, useEffect } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

let loadPromise = null;

function loadGoogleMapsScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.maps?.places) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
      return;
    }
    loadGoogleMapsScript()
      .then(() => setReady(true))
      .catch((err) => setError(err.message));
  }, []);

  return { ready, error };
}