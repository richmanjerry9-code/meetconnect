import multer from 'multer';
import cloudinary from '../../lib/cloudinary';

const upload = multer({ storage: multer.memoryStorage() }); // Store in memory

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Use multer to parse the form data
  upload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({ error: 'File upload error' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    try {
      // Convert buffer to base64 string that Cloudinary accepts
      const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

      const uploadResponse = await cloudinary.uploader.upload(base64, {
        folder: 'profiles',
        transformation: [{ width: 500, height: 500, crop: 'limit' }],
        resource_type: 'image', // Explicitly set for consistency
      });

      // Moderate the image (always, since profile pics are public)
      const modEndpoint = 'moderateImage';
      const port = process.env.PORT || '3000';
      const modUrl = `http://127.0.0.1:${port}/api/${modEndpoint}`;
      console.log(`Moderating at: ${modUrl}`); // Debug log

      const modRes = await fetch(modUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: uploadResponse.secure_url }),
      });

      if (!modRes.ok) {
        const errorText = await modRes.text();
        console.error(`Moderation failed: ${modRes.status} - ${errorText}`);
        await cloudinary.uploader.destroy(uploadResponse.public_id, { resource_type: 'image' });
        return res.status(modRes.status).json({ error: 'Moderation failed', details: errorText });
      }

      const modData = await modRes.json();
      if (!modData.isSafe) {
        await cloudinary.uploader.destroy(uploadResponse.public_id, { resource_type: 'image' });
        return res.status(400).json({ error: 'Inappropriate content detected' });
      }

      // If safe, return the URL
      res.status(200).json({ url: uploadResponse.secure_url });
    } catch (error) {
      console.error('UploadProfilePic error:', error);
      if (uploadResponse && uploadResponse.public_id) {
        await cloudinary.uploader.destroy(uploadResponse.public_id, { resource_type: 'image' }).catch(console.error);
      }
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  });
}

// Important: disable Next.js default body parser so multer can handle it
export const config = {
  api: {
    bodyParser: false,
  },
};
