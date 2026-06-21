import mongoose, { Schema } from 'mongoose';

const SettingsSchema = new Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true, 
    default: 'global' 
  },
  timeOfDay: { 
    type: Number, 
    default: 8.0 
  },
  timeSpeed: { 
    type: Number, 
    default: 0.00833 // 1 in-game day = 8 real hours: 24 / (8*3600*0.1)
  },
  isPlaying: { 
    type: Boolean, 
    default: true 
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
