const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendChatNotification = functions.firestore
  .document('inbox/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    const chatId = context.params.chatId;

    // Get the chat doc to find participants and avoid sending to sender
    const chatRef = admin.firestore().doc(`privateChats/${chatId}`);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) return;

    const chat = chatSnap.data();
    const senderId = messageData.senderId;
    const recipientId = chat.participants.find(id => id !== senderId);
    if (!recipientId) return; // No recipient (e.g., self-chat)

    // Get recipient's profile for FCM tokens
    const recipientRef = admin.firestore().doc(`profiles/${recipientId}`);
    const recipientSnap = await recipientRef.get();
    if (!recipientSnap.exists) return;

    const recipient = recipientSnap.data();
    const tokens = recipient.fcmTokens || [recipient.fcmToken]; // Support multi-device
    if (!tokens.length) return; // No tokens

    // Get sender's name for notification body
    const senderRef = admin.firestore().doc(`profiles/${senderId}`);
    const senderSnap = await senderRef.get();
    const senderName = senderSnap.exists ? senderSnap.data().name || 'Someone' : 'Someone';

    // Build FCM payload (notification for background display + data for handling)
    const payload = {
      notification: {
        title: `New Message from ${senderName}`,
        body: messageData.text || 'You have a new message!',
      },
      data: {
        chatId: chatId,
        // Add more data if needed, like messageId
      },
    };

    // Send to all tokens (multi-device support)
    try {
      await admin.messaging().sendToDevice(tokens, payload);
      console.log('Notification sent successfully');
    } catch (err) {
      console.error('Error sending notification:', err);
    }

    // Optional: Clean up invalid tokens (if send fails)
    // You can expand this to handle failed tokens by removing them from the user's profile
  });