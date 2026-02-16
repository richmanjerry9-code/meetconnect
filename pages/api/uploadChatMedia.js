// pages/api/uploadChatMedia.js
import formidable from 'formidable'; // For parsing multipart/form-data
import fs from 'fs/promises';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary (do this once at the top)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Disable Next.js body parser for raw file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the multipart form (file upload)
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      multiples: false,
    });

    const [fields, files] = await form.parse(req);

    const uploadedFile = files.file?.[0];
    const folder = req.query.folder || 'chatMedia'; // e.g., 'chatAudio' or 'chatImages'

    if (!uploadedFile || !uploadedFile.filepath) {
      return res.status(400).json({ error: 'No valid file provided' });
    }

    // Read the temp file into buffer
    const buffer = await fs.readFile(uploadedFile.filepath);

    // Determine resource type for Cloudinary (critical for audio!)
    const resourceType = folder.toLowerCase().includes('audio') ? 'video' : 'image';

    // Generate a unique public_id (Cloudinary will handle folder + name)
    const fileName = `${Date.now()}_${uploadedFile.originalFilename || 'upload'}`;

    // Upload to Cloudinary using stream (best for buffers)
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder, // e.g., 'chatAudio' — creates the folder automatically
          public_id: fileName, // Custom name (without extension; Cloudinary adds it)
          resource_type: resourceType, // 'video' for .webm audio, 'image' for jpg/png
          overwrite: false, // Prevent overwrites
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer); // Pipe the buffer
    });

    // Cleanup temp file
    await fs.unlink(uploadedFile.filepath);

    // Return the secure URL (HTTPS, CDN-ready)
    return res.status(200).json({ url: result.secure_url });
  } catch (error) {
    console.error('🔥 FULL UPLOAD ERROR:', error);
    return res.status(500).json({ error: `Upload failed: ${error.message}` });
  }
}