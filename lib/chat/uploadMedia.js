
// /lib/chat/uploadImage.js
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a media file to Firebase Storage.
 * @param {File} file - Media file to upload (image or video)
 * @param {string} folder - Storage folder path (e.g., 'images' or 'videos')
 * @returns {Promise<string>} - Download URL of the uploaded media
 */
export async function uploadMedia(file, folder) {
  const storage = getStorage();
  const fileRef = ref(storage, `${folder}/${uuidv4()}`);
  
  // TODO: Implement client-side compression for images (e.g., using browser-image-compression)
  // For videos, consider using a library like ffmpeg.wasm if needed, but keep it simple for now
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}