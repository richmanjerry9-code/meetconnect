// Updated: pages/api/uploadProfilePic.js
// Return specific error message from Cloudinary

import cloudinary from '../../lib/cloudinary';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

      const uploadResponse = await cloudinary.uploader.upload(imageBase64, {
        folder: 'profiles',          // Optional: store all images in a folder
        transformation: [{ width: 500, height: 500, crop: 'limit' }] // resize
      });

      res.status(200).json({ url: uploadResponse.secure_url });
    } catch (err) {
      console.error('Cloudinary error:', err);
      res.status(500).json({ error: err.message || 'Cloudinary upload failed' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
