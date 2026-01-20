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
      });

      res.status(200).json({ url: uploadResponse.secure_url });
    } catch (cloudinaryErr) {
      console.error('Cloudinary error:', cloudinaryErr);
      res.status(500).json({ error: cloudinaryErr.message || 'Cloudinary upload failed' });
    }
  });
}

// Important: disable Next.js default body parser so multer can handle it
export const config = {
  api: {
    bodyParser: false,
  },
};