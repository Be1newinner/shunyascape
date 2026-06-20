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
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  x: { 
    type: Number, 
    default: 0 
  },
  z: { 
    type: Number, 
    default: 0 
  },
  lastX: { 
    type: Number, 
    default: 0 
  },
  lastZ: { 
    type: Number, 
    default: 0 
  },
  clothingColor: { 
    type: Number, 
    default: () => [0x4287f5, 0xeb4034, 0x228b22, 0xe0c012, 0x8a2be2, 0xff69b4][Math.floor(Math.random() * 6)]
  },
  currentRefreshToken: {
    type: String,
    default: null
  },
  currentSessionId: {
    type: String,
    default: null
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
