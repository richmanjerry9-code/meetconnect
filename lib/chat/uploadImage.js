// /lib/chat/uploadImage.js
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads an image to Firebase Storage.
 * @param {File} file - Image file to upload
 * @param {string} folder - Storage folder path
 * @returns {Promise<string>} - Download URL of the uploaded image
 */
export async function uploadImage(file, folder) {
  const storage = getStorage();
  const fileRef = ref(storage, `${folder}/${uuidv4()}`);
  
  // TODO: Implement client-side compression (e.g., using browser-image-compression)
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}
