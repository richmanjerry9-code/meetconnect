// pages/api/upload-profile-pic.js

import multer from 'multer';
import { Sightengine } from 'sightengine'; // SDK for moderation
import admin from '../../lib/firebase-admin'; // Your Firebase Admin init
import fs from 'fs';
import path from 'path';

// Temp storage with Multer (disk storage for Sightengine compatibility)
const upload = multer({ dest: '/tmp/uploads/' }); // Use /tmp for Vercel/serverless

// Sightengine client (use env vars for security)
const sightengineClient = new Sightengine({
  apiUser: process.env.SIGHTENGINE_USER,
  apiSecret: process.env.SIGHTENGINE_SECRET,
});

// API handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Multer middleware (parse form data)
  upload.single('profilePic')(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ message: 'File upload error' });
    }

    const { userId } = req.body; // Validate user
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const imagePath = file.path;

    try {
      // Step 1: Moderate with Sightengine
      const moderationResult = await sightengineClient.check([
        'nudity',       // Detect nudity
        'wad',          // Weapons, alcohol, drugs
        'scam',         // Text-based scams
        'face-attributes', // Age/gender if needed
        'offensive',    // Hate symbols
      ]).set_file(imagePath);

      // Check results (customize thresholds based on your policy)
      const isSafe = 
        moderationResult.nudity.none > 0.9 &&  // High confidence no nudity
        !moderationResult.weapon && 
        !moderationResult.alcohol && 
        !moderationResult.drugs &&
        moderationResult.scam.probability < 0.5 &&  // Low scam probability
        moderationResult.offensive.prob < 0.5;

      if (!isSafe) {
        // Delete temp file
        fs.unlinkSync(imagePath);
        return res.status(400).json({ message: 'Image contains inappropriate content. Please upload a different one.' });
      }

      // Step 2: Upload to Firebase Storage if safe
      const bucket = admin.storage().bucket();
      const fileName = `profiles/${userId}/${Date.now()}_${file.originalname}`;
      const uploadedFile = await bucket.upload(imagePath, {
        destination: fileName,
        metadata: { contentType: file.mimetype },
      });

      // Get public URL
      const url = await uploadedFile[0].getSignedUrl({
        action: 'read',
        expires: '03-09-2491', // Long expiration
      });

      // Delete temp file
      fs.unlinkSync(imagePath);

      // Return URL to frontend
      res.status(200).json({ url: url[0] });
    } catch (error) {
      console.error('Moderation/Upload error:', error);
      // Clean up temp file on error
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      res.status(500).json({ message: 'Server error during image processing' });
    }
  });
}

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parser for Multer
  },
};