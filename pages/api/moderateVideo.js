// pages/api/moderateVideo.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoUrl } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ error: 'No video URL provided' });
    }

    const params = new URLSearchParams({
      models: 'nudity-2.1',
      api_user: process.env.SIGHTENGINE_USER,
      api_secret: process.env.SIGHTENGINE_SECRET,
      stream_url: videoUrl
    });

    const response = await fetch(
      `https://api.sightengine.com/1.0/video/check-sync.json?${params.toString()}`,
      { method: 'GET' }
    );

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('Moderation API failed');
    }

    // Aggregate max nudity scores across all frames
    const frames = data.data.frames || [];
    const maxNudity = {
      sexual_activity: 0,
      sexual_display: 0,
      erotica: 0,
      // Add other fields if needed from docs (e.g., sextoy, suggestive)
    };

    frames.forEach(frame => {
      const nudity = frame.nudity || {};
      maxNudity.sexual_activity = Math.max(maxNudity.sexual_activity, nudity.sexual_activity || 0);
      maxNudity.sexual_display = Math.max(maxNudity.sexual_display, nudity.sexual_display || 0);
      maxNudity.erotica = Math.max(maxNudity.erotica, nudity.erotica || 0);
      // Extend for other scores if your logic needs them
    });

    /**
     * Moderation logic (applied to max scores):
     * - Block sexual activity immediately
     * - Block strong sexual display
     * - Allow mild erotica but NOT explicit
     */

    const BLOCK_SEXUAL_ACTIVITY = maxNudity.sexual_activity > 0.2;
    const BLOCK_SEXUAL_DISPLAY = maxNudity.sexual_display > 0.5;
    const ALLOW_MILD_EROTICA = maxNudity.erotica <= 0.6;

    const isSafe =
      !BLOCK_SEXUAL_ACTIVITY &&
      !BLOCK_SEXUAL_DISPLAY &&
      ALLOW_MILD_EROTICA;

    console.log("Moderation Max Scores:", maxNudity);
    console.log("Decision:", { isSafe });

    res.status(200).json({
      isSafe,
      scores: maxNudity,
      blocked: {
        sexual_activity: BLOCK_SEXUAL_ACTIVITY,
        sexual_display: BLOCK_SEXUAL_DISPLAY,
        erotica: !ALLOW_MILD_EROTICA
      }
    });

  } catch (err) {
    console.error("Moderation error:", err);
    res.status(500).json({ error: 'Moderation failed' });
  }
}
