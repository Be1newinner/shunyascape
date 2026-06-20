import mongoose, { Schema } from 'mongoose';

const NpcSchema = new Schema({
  npcId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  x: { 
    type: Number, 
    required: true 
  },
  z: { 
    type: Number, 
    required: true 
  },
  targetX: { 
    type: Number, 
    required: true 
  },
  targetZ: { 
    type: Number, 
    required: true 
  },
  state: { 
    type: String, 
    required: true, 
    default: 'idle' 
  },
  clothingColor: { 
    type: Number, 
    required: true 
  }
});

export default mongoose.models.Npc || mongoose.model('Npc', NpcSchema);
