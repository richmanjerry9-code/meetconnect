// backfill-all.js  (new file — forces legacy on EVERY profile)
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');  // Your key file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function forceLegacyAll() {
  console.log('Starting FORCE legacy backfill on ALL profiles...');

  const snapshot = await db.collection('profiles').get();
  let count = 0;

  const batch = db.batch();

  snapshot.forEach((doc) => {
    batch.update(doc.ref, {
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2025-12-31T00:00:00Z'))  // Legacy date
    });
    count++;
  });

  if (count === 0) {
    console.log('No profiles found.');
    return;
  }

  await batch.commit();
  console.log(`FORCE complete! Updated ALL ${count} profiles to legacy createdAt.`);
}

forceLegacyAll().catch((error) => {
  console.error('Error:', error);
});