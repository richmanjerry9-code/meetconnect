// pages/api/uploadProfilePic.js
import multiparty from 'multiparty';
import cloudinary from '../../lib/cloudinary';

export const config = {
  api: {
    bodyParser: false,  // Disable default body parser for file uploads
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const form = new multiparty.Form();
      const data = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          resolve({ fields, files });
        });
      });

      const imageFile = data.files.image?.[0];  // 'image' is the FormData key
      if (!imageFile) return res.status(400).json({ error: 'No image provided' });

      const uploadResponse = await cloudinary.uploader.upload(imageFile.path, {
        folder: 'profiles',
        transformation: [{ width: 500, height: 500, crop: 'limit' }],
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