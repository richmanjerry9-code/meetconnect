const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendMessageNotification = functions.https.onCall(async (data, context) => {
  const { recipientId, senderName, messageText, chatId } = data;
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Unauthorized');

  const db = admin.firestore();
  const recipientSnap = await db.collection('profiles').doc(recipientId).get(); // Assuming token in profiles
  const token = recipientSnap.data()?.fcmToken;

  if (!token) return { success: false };

  const payload = {
    notification: {
      title: `New Message from ${senderName}`,
      body: messageText || 'You have a new image!',
      icon: '/favicon-192x192.png',
    },
    data: { chatId },
  };

  try {
    await admin.messaging().sendToDevice(token, payload);
    return { success: true };
  } catch (err) {
    console.error(err);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});