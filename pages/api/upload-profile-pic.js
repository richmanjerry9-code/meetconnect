// pages/api/upload-profile-pic.js
import { createRouter, expressWrapper } from 'next-connect';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import sightengine from 'sightengine';

// Configure Sightengine
const sightengineClient = sightengine(
  process.env.SIGHTENGINE_USER,
  process.env.SIGHTENGINE_SECRET
);

// Multer config (temp storage)
const upload = multer({
  storage: multer.diskStorage({
    destination: './public/uploads', // Temp folder
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Create NextConnect router
const router = createRouter();

// Apply Multer middleware with expressWrapper
router.use(expressWrapper(upload.single('profilePic')));

// POST upload route
router.post(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fullPath = path.resolve(req.file.path);
  const filename = req.file.filename;
  const permanentDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
  const permanentPath = path.join(permanentDir, filename);

  // Ensure permanent dir exists
  if (!fs.existsSync(permanentDir)) {
    fs.mkdirSync(permanentDir, { recursive: true });
  }

  try {
    // Moderate image with multiple models
    const moderation = await sightengineClient.check(['nudity-2.1', 'wad', 'scam', 'offensive']).set_file(fullPath);
    console.log('Full moderation response:', moderation);

    // Handle invalid API credentials or errors
    if (moderation.status !== 'success') {
      throw new Error(`Sightengine API error: ${moderation.error?.message || JSON.stringify(moderation)}`);
    }

    let errorMessage = null;

    // Check for nudity (using advanced model)
    const nudity = moderation.nudity || {};
    if (nudity.sexual_activity > 0.5 || nudity.sexual_display > 0.5 || nudity.erotica > 0.5) {
      errorMessage = 'Nudity or pornographic content is prohibited. Please choose another picture.';
    } else if (nudity.suggestive > 0.5) {
      errorMessage = 'Suggestive content is not allowed. Please choose another picture.';
    }

    // Check for WAD (Weapons, Alcohol, Drugs)
    if (!errorMessage && (moderation.weapon > 0.5 || moderation.alcohol > 0.5 || moderation.drugs > 0.5)) {
      errorMessage = 'Images containing weapons, alcohol, or drugs are not allowed. Please choose another picture.';
    }

    // Check for scam
    if (!errorMessage && moderation.scam?.probability > 0.5) {
      errorMessage = 'Image may contain scam-related content. Please choose another picture.';
    }

    // Check for offensive content
    if (!errorMessage && moderation.offensive?.prob > 0.5) {
      errorMessage = 'Image contains offensive content. Please choose another picture.';
    }

    if (errorMessage) {
      fs.unlinkSync(fullPath);
      return res.status(400).json({ error: errorMessage });
    }

    // Move to permanent storage if safe
    fs.renameSync(fullPath, permanentPath);
    const imageUrl = `/uploads/profiles/${filename}`;

    res.status(200).json({
      message: 'Upload successful',
      url: imageUrl,
      moderation: moderation,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
});

export default router.handler({
  onError(err, req, res) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  },
  onNoMatch(req, res) {
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  },
});

// Disable bodyParser for Multer
export const config = {
  api: { bodyParser: false },
};
