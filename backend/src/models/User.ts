import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  // Null for accounts created with Google sign-in until a password is set
  password: { 
    type: String, 
    default: null 
  },
  // Google account id ("sub") for Sign in with Google
  googleId: {
    type: String,
    default: undefined,
    index: { unique: true, sparse: true }
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  currentRefreshToken: {
    type: String,
    default: null
  },
  currentSessionId: {
    type: String,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'skip'],
    default: 'skip'
  },
  dob: {
    type: String,
    default: null
  },
  // Battleground profile: chosen outfit and lifetime stats
  outfit: {
    type: String,
    default: 'classic'
  },
  stats: {
    matches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    damage: { type: Number, default: 0 },
    top10: { type: Number, default: 0 },
    bestPlacement: { type: Number, default: null },
    timePlayed: { type: Number, default: 0 },
    xp: { type: Number, default: 0 }
  },
  lastMatchAt: {
    type: Date,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
