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
  // Game Economics - Coin Drain Rates
  hungerDecayRate: {
    type: Number,
    default: 1.0 // percentage points per in-game hour
  },
  housingRentRate: {
    type: Number,
    default: 10 // SC deducted per in-game midnight
  },
  utilityBillRate: {
    type: Number,
    default: 5 // SC deducted per in-game noon
  },
  energyDrainRate: {
    type: Number,
    default: 1.5 // speed multiplier for energy reduction during sprint
  },
  transactionTaxRate: {
    type: Number,
    default: 10 // percentage tax on commercial transactions
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
