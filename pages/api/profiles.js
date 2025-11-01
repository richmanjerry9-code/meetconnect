// pages/api/profiles.js
import { db } from '../../lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

export default async function handler(req, res) {
  try {
    // ✅ Create a new profile
    if (req.method === 'POST') {
      const { id, name } = req.body;  // Use 'id' (user id from login) instead of email

      if (!id || !name) {
        return res.status(400).json({ message: 'User ID and name are required' });
      }

      // Check if profile already exists
      const profileRef = doc(db, 'profiles', id);
      const existingDoc = await getDoc(profileRef);
      if (existingDoc.exists()) {
        return res.status(400).json({ message: 'Profile already exists for this user' });
      }

      // Add createdAt if not there
      const profileData = {
        ...req.body,
        createdAt: req.body.createdAt || new Date().toISOString(),
      };

      await setDoc(profileRef, profileData);

      return res.status(201).json({ message: 'Profile created successfully', profile: profileData });
    }

    // ✅ Fetch all profiles with profilePic
    if (req.method === 'GET') {
      const profilesQuery = query(
        collection(db, 'profiles'),
        where('profilePic', '!=', ''),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(profilesQuery);
      const profiles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      return res.status(200).json(profiles);
    }

    // ✅ Update an existing profile
    if (req.method === 'PUT') {
      const { id, updates } = req.body;  // Use 'id' instead of email
      const profileRef = doc(db, 'profiles', id);

      const existingDoc = await getDoc(profileRef);
      if (!existingDoc.exists()) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      await setDoc(profileRef, updates, { merge: true });

      return res.status(200).json({ message: 'Profile updated successfully', updatedProfile: { id, ...updates } });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err) {
    console.error('Profile API error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}