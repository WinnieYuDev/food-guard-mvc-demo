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
  brand: {
    type: String,
    required: true
  },
  product: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['poultry', 'vegetables', 'shellfish', 'meat', 'dairy', 'grains', 'fruits', 'processed-foods', 'beverages', 'other']
  },
  retailer: {
    type: String,
    required: true,
    enum: ['trader-joes', 'whole-foods', 'kroger', 'walmart', 'target', 'costco', 'safeway', 'albertsons', 'publix', 'wegmans', 'other']
  },
  reason: {
    type: String,
    required: true
  },
  riskLevel: {
    type: String,
    required: true,
    enum: ['high', 'medium', 'low']
  },
  recallDate: {
    type: Date,
    required: true
  },
  statesAffected: [String],
  images: [{
    url: String,
    caption: String
  }],
  source: {
    type: String,
    default: 'FDA'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better search performance
recallSchema.index({ title: 'text', description: 'text', product: 'text', brand: 'text' });
recallSchema.index({ category: 1, retailer: 1, riskLevel: 1 });

module.exports = mongoose.model('Recall', recallSchema);