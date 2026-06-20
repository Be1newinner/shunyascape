import mongoose, { Schema } from 'mongoose';

const GridCellSchema = new Schema({
  x: { 
    type: Number, 
    required: true 
  },
  z: { 
    type: Number, 
    required: true 
  },
  type: { 
    type: String, 
    required: true, 
    default: 'empty' 
  },
  targetType: { 
    type: String, 
    default: 'empty' 
  },
  constructionProgress: { 
    type: Number, 
    default: 0 
  },
  height: { 
    type: Number, 
    default: 0 
  }
});

// Compound index to ensure uniqueness for each (x, z) coordinate cell
GridCellSchema.index({ x: 1, z: 1 }, { unique: true });

export default mongoose.models.GridCell || mongoose.model('GridCell', GridCellSchema);
