// Updated: pages/api/moderateImage.js
// Further relaxed: Only block if genitals/sexual organs exposed (sexual_display) or activity (sexual_activity).
// Allows erotica (breasts/nipples, buttocks, pubic hair) and all suggestive content (lingerie, bikinis, poses).
// This matches "complete nude no clothes OR private parts revealed" — private parts = genitals.

import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { imageUrl } = req.body;
      if (!imageUrl) return res.status(400).json({ error: 'No image URL provided' });

      const params = new URLSearchParams({
        'models': 'nudity-2.1',
        'api_user': process.env.SIGHTENGINE_USER,
        'api_secret': process.env.SIGHTENGINE_SECRET,
        'url': imageUrl,
      });

      const response = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`, {
        method: 'GET',
      });

      const data = await response.json();
      if (data.status !== 'success') {
        throw new Error('Moderation API failed');
      }

      const nudity = data.nudity;
      // Ultra-relaxed: Block ONLY explicit genitals/sex acts. Allow everything else.
      // Permits erotica (topless, bare buttocks), lingerie/bikinis, poses, etc.
      const isSafe = nudity.sexual_activity < 0.1 &&
                     nudity.sexual_display < 0.1;

      // Optional: Log for debugging (remove in prod)
      console.log('Moderation details:', { isSafe, nudity });

      res.status(200).json({ isSafe, details: nudity });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Moderation failed' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}