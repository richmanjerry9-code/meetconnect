// pages/api/uploadPost.js
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config for memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },  // e.g., 50MB limit
});

export const config = {
  api: {
    bodyParser: false,  // Disable default bodyParser
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse form data
  const multerUpload = upload.single('media');  // 'media' is the field name from frontend FormData
  multerUpload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
      return res.status(500).json({ error: 'Upload error' });
    }

    const { userId, isExclusive: isExclusiveStr } = req.body;  // Still get these from form
    const isExclusive = isExclusiveStr === 'true';  // Parse to boolean
    if (!req.file || !userId) {
      return res.status(400).json({ error: 'Missing media file or userId' });
    }

    try {
      // Detect type from buffer/mimetype
      const resource_type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      if (!req.file.mimetype.startsWith('image/') && !req.file.mimetype.startsWith('video/')) {
        return res.status(400).json({ error: 'Unsupported media type' });
      }

      // Upload buffer directly to Cloudinary
      const uploadResponse = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `meetconnect/posts/${userId}`,
            quality: 'auto:best',
            fetch_format: 'auto',
            resource_type,
            ...(resource_type === 'image' && { width: 1080, crop: 'limit' }),
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      const finalUrl = uploadResponse.secure_url;

      // Moderate only public posts (non-exclusive)
      if (!isExclusive) {
        let modEndpoint = resource_type === 'video' ? 'moderateVideo' : 'moderateImage';
        console.log(`Moderating at: /api/${modEndpoint}`);  // Debug log (relative)

        const modRes = await fetch(`/api/${modEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [resource_type === 'image' ? 'imageUrl' : 'videoUrl']: finalUrl }),
        });

        if (!modRes.ok) {
          const errorText = await modRes.text();  // Safe: get as text
          console.error(`Moderation failed: ${modRes.status} - ${errorText}`);
          await cloudinary.uploader.destroy(uploadResponse.public_id, { resource_type });
          return res.status(modRes.status).json({ error: 'Moderation failed', details: errorText });
        }

        const modData = await modRes.json();  // Now safe to parse
        if (!modData.isSafe) {
          await cloudinary.uploader.destroy(uploadResponse.public_id, { resource_type });
          return res.status(400).json({ error: 'Inappropriate content detected' });
        }
      }

      return res.status(200).json({ url: finalUrl });

    } catch (error) {
      console.error('UploadPost error:', error);
      return res.status(500).json({ error: 'Upload failed', details: error.message });
    }
  });
}
