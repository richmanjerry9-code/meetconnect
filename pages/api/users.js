// pages/api/users.js
import db from './db';
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, sparse: true }, // allow optional email
  password: String,
  role: { type: String, default: 'user' }, // can be 'user' or 'admin'
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
  await db;

  if (req.method === 'POST') {
    try {
      const { name, email, password, role } = req.body;

      // simple validation
      if (!name || !password)
        return res.status(400).json({ message: 'Name and password are required' });

      // check if user exists (by email if provided)
      if (email) {
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: 'Email already registered' });
      }

      const user = new User({ name, email, password, role });
      await user.save();

      return res.status(201).json({ message: 'User created successfully', user });
    } catch (err) {
      console.error('User creation error:', err);
      return res.status(500).json({ message: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const users = await User.find();
      return res.status(200).json(users);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
