// /lib/chat/uploadMedia.js
export async function uploadMedia(file, folder) {
  if (!file) throw new Error('No file provided');

  const formData = new FormData();
  const filename = file.name || `upload.${folder === 'chatAudio' ? 'webm' : 'jpg'}`; // Default filename based on folder
  formData.append('file', file, filename); // Add filename for Blobs

  const res = await fetch(`/api/uploadChatMedia?folder=${folder}`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }

  return data.url;
}