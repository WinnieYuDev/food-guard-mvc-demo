const mongoose = require('mongoose');

const recallSchema = new mongoose.Schema({
  recallId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  product: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  recallDate: {
    type: Date,
    required: true
  },
  agency: {
    type: String,
    enum: ['FDA', 'FSIS', 'USDA'],
    required: true
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'poultry', 
      'vegetables', 
      'shellfish', 
      'meat', 
      'dairy', 
      'fruits', 
      'eggs', 
      'grains',
      'processed-foods',
      'beverages',
      'snacks',
      'baby-food',
      'other'
    ],
    required: true
  },
  retailer: {
    type: String,
    enum: [
      'trader-joes',
      'whole-foods', 
      'kroger', 
      'walmart', 
      'costco', 
      'target', 
      'safeway', 
      'albertsons',
      'various-retailers'
    ],
    required: true
  },
  status: {
    type: String,
    enum: ['Ongoing', 'Completed', 'Pending'],
    default: 'Ongoing'
  },
  distribution: {
    type: String,
    required: true
  },
  statesAffected: [{
    type: String
  }],
  articleLink: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create text index for search
recallSchema.index({
  title: 'text',
  description: 'text', 
  product: 'text',
  brand: 'text',
  reason: 'text'
});

module.exports = mongoose.model('Recall', recallSchema);