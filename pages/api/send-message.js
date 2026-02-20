// /pages/api/send-message.js
import { getFirestore, collection, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { app } from '../../lib/firebase'; // Adjust path to your firebase config
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { senderUid, receiverUid, messageText, senderName, chatId, imageUrl, audioUrl, viewOnce, replyTo } = req.body;

  if (!senderUid || !receiverUid || !chatId || (!messageText && !imageUrl && !audioUrl)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // STEP 1: Save message to Firestore
    const db = getFirestore(app);
    const payload = {
      text: messageText || '',
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      senderId: senderUid,
      senderName: senderName || 'User',
      senderPhoto: '', // Fetch or pass from client if needed
      timestamp: serverTimestamp(),
      seenBy: [senderUid],
      replyTo: replyTo || null,
      deletedFor: [],
      viewOnce: (imageUrl && viewOnce) ? true : false,
      viewedBy: (imageUrl && viewOnce) ? [] : [],
    };

    await addDoc(collection(db, "privateChats", chatId, "messages"), payload);

    // Update chat metadata
    const chatRef = doc(db, "privateChats", chatId);
    await updateDoc(chatRef, {
      lastMessage: messageText || (audioUrl ? "Voice message" : imageUrl ? "Photo" : "Message"),
      timestamp: serverTimestamp(),
      [`unreadCounts.${receiverUid}`]: increment(1),
    });

    // STEP 2: Send OneSignal push to receiver
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_external_user_ids: [receiverUid],
        headings: { en: 'New Message 💬' },
        contents: { en: `${senderName || 'Someone'} sent you a message: "${(messageText || '').slice(0, 50)}..."` },
        data: {
          action: 'open_chat',
          chatId: chatId,
        },
        url: `https://www.meetconnect.co.ke/inbox/${chatId}`,
      }),
    });

    if (!response.ok) {
      console.error('OneSignal error:', await response.json());
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}