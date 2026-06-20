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
    default: 0.5 
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
