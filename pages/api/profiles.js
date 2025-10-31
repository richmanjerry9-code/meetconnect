// pages/api/profiles.js
import db from './db';
import mongoose from 'mongoose';

// Define the schema
const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },
    profilePic: { type: String, default: '' },
    county: { type: String, default: '' },
    ward: { type: String, default: '' }, // Added this for ward support
    area: { type: String, default: '' },
    services: { type: [String], default: [] },
    nearby: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'profiles' }
);

// Prevent model re-compilation during hot reloads
const Profile = mongoose.models.Profile || mongoose.model('Profile', ProfileSchema);

export default async function handler(req, res) {
  try {
    await db;

    // ✅ Create a new profile
    if (req.method === 'POST') {
      const { email, name } = req.body;

      if (!email || !name) {
        return res.status(400).json({ message: 'Name and email are required' });
      }

      // Check if profile already exists
      const existing = await Profile.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: 'Profile already exists for this email' });
      }

      const profile = new Profile(req.body);
      await profile.save();

      return res.status(201).json({ message: 'Profile created successfully', profile });
    }

    // ✅ Fetch all profiles
    if (req.method === 'GET') {
      const profiles = await Profile.find().sort({ createdAt: -1 });
      return res.status(200).json(profiles);
    }

    // ✅ Update an existing profile (optional, future use)
    if (req.method === 'PUT') {
      const { email, updates } = req.body;
      const updatedProfile = await Profile.findOneAndUpdate(
        { email },
        { $set: updates },
        { new: true }
      );

      if (!updatedProfile) return res.status(404).json({ message: 'Profile not found' });

      return res.status(200).json({ message: 'Profile updated successfully', updatedProfile });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err) {
    console.error('Profile API error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}