// /pages/api/send-message.js (Modified to use FCM via Firebase Admin instead of OneSignal)
import { getFirestore, collection, addDoc, doc, updateDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { app } from '../../lib/firebase'; // Adjust path to your firebase config
import { adminApp } from '../../lib/firebaseAdmin'; // New import for admin

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { senderUid, receiverUid, messageText, senderName, chatId, imageUrl, audioUrl, viewOnce, replyTo } = req.body;

  if (!senderUid || !receiverUid || !chatId || (!messageText && !imageUrl && !audioUrl)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // STEP 1: Save message to Firestore (unchanged)
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

    // Update chat metadata (unchanged)
    const chatRef = doc(db, "privateChats", chatId);
    await updateDoc(chatRef, {
      lastMessage: messageText || (audioUrl ? "Voice message" : imageUrl ? "Photo" : "Message"),
      timestamp: serverTimestamp(),
      [`unreadCounts.${receiverUid}`]: increment(1),
    });

    // STEP 2: Send FCM push to receiver (replaces OneSignal)
    const receiverSnap = await getDoc(doc(db, 'profiles', receiverUid));
    const token = receiverSnap.data()?.fcmToken;

    if (token) {
      const messaging = adminApp.messaging();
      await messaging.send({
        token: token,
        notification: {
          title: 'New Message 💬',
          body: `${senderName || 'Someone'} sent you a message: "${(messageText || '').slice(0, 50)}..."`
        },
        data: {
          action: 'open_chat',
          chatId: chatId
        },
        webpush: {
          fcm_options: {
            link: `https://www.meetconnect.co.ke/inbox/${chatId}`
          }
        }
      });
    } else {
      console.log('No FCM token for receiver');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}