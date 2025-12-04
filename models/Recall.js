const mongoose = require('mongoose');

// models/Recall.js
// This file defines the MongoDB schema for a food recall record.
// Each field below has a type and optional validation rules.
// Recall schema is a blueprint for what data each recall must contain.

const recallSchema = new mongoose.Schema({
  // Unique identifier for the recall (comes from the source feed)
  recallId: {
    type: String,
    required: true,
    unique: true
  },
  // The title is the short headline for the recall (shown on the homepage)
  title: {
    type: String,
    required: true
  },
  // Full description from the source (may include ingredients, manufacturer details)
  description: {
    type: String,
    required: true
  },
  // Product name (if available)
  product: {
    type: String,
    required: true
  },
  // Brand/manufacturer name
  brand: {
    type: String,
    required: true
  },
  // Reason the product was recalled (e.g. "undeclared egg")
  reason: {
    type: String,
    required: true
  },
  // The official recall date
  recallDate: {
    type: Date,
    required: true
  },
  // Issuing agency (FDA, FSIS, USDA)
  agency: {
    type: String,
    enum: ['FDA', 'FSIS', 'USDA'],
    required: true
  },
  // Risk level helps users quickly assess severity
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  // Category is used to pick an image and group recalls visually
  category: {
    type: String,
    enum: [
      'poultry',
      'beef',
      'pork',
      'seafood',
      'shellfish',
      'meat',
      'dairy',
      'fruits',
      'eggs',
      'nuts',
      'grains',
      'processed-foods',
      'beverages',
      'snacks',
      'breakfast',
      'baby-food',
      'other'
    ],
    required: true
  },
  // categories: allow multiple inferred categories/tags (max 3 in normalization)
  categories: [{
    type: String
  }],
  // Tags: array of short keywords inferred from product/title/description
  tags: [{
    type: String
  }],
  // Retailer where product was sold (if known)
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
  // Recall workflow status
  status: {
    type: String,
    enum: ['Ongoing', 'Completed', 'Pending'],
    default: 'Ongoing'
  },
  // Raw distribution text (e.g. "CT, FL, IL") used when statesAffected is not present
  distribution: {
    type: String,
    required: true
  },
  // Optional array of affected state codes (easier to render cleanly)
  statesAffected: [{
    type: String
  }],
  // Optional link to a news article or full recall notice
  articleLink: {
    type: String
  },
  // Whether the recall is currently active
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// === Indexes ===
// Text index to support full-text search across common fields
recallSchema.index({
  title: 'text',
  description: 'text', 
  product: 'text',
  brand: 'text',
  reason: 'text'
});

// === Model Export ===
module.exports = mongoose.model('Recall', recallSchema);