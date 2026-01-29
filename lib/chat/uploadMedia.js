// /lib/chat/uploadMedia.js
export async function uploadMedia(file, folder) {
  if (!file) throw new Error('No file provided');

  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/uploadChatImage', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }

  return data.url;
}