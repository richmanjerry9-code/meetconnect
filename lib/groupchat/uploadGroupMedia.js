// lib/groupchat/uploadGroupMedia.js
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

/**
 * Uploads image, video, or voice note for group chat
 * Uses your existing Firebase Storage — guaranteed to work
 */
export async function uploadGroupMedia(file) {
  if (!file) throw new Error("No file provided");

  // Validate file type
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");

  if (!isImage && !isVideo && !isAudio) {
    throw new Error("Only images, videos, and audio files are allowed");
  }

  const storage = getStorage();

  // Smart folder routing
  const folder = isAudio
    ? "group-chat/audio"
    : isVideo
    ? "group-chat/video"
    : "group-chat/images";

  const fileExtension = file.name?.split(".").pop() || (isAudio ? "webm" : isVideo ? "mp4" : "jpg");
  const fileName = `${uuidv4()}.${fileExtension}`;

  const storageRef = ref(storage, `${folder}/${fileName}`);

  try {
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error("Upload failed:", error);
    throw new Error("Failed to upload media");
  }
}