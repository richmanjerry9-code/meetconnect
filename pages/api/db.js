// pages/api/db.js
import mongoose from 'mongoose';

const MONGODB_URI =
  'mongodb+srv://meetconnect_admin:Qwa$$07420@cluster0.zq7skuu.mongodb.net/meetconnect?retryWrites=true&w=majority&appName=Cluster0';

let isConnected = false;

export default async function dbConnect() {
  if (isConnected) return;

  try {
    const db = await mongoose.connect(MONGODB_URI);
    isConnected = db.connections[0].readyState;
    console.log('✅ MongoDB Connected Successfully');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
  }
}
