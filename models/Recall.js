const mongoose = require('mongoose');

// Define what a Food Recall looks like in our database
const recallSchema = new mongoose.Schema({
  recallId: {
    type: String,
    required: true,
    unique: true // Each recall has unique ID
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true // Why was this product recalled?
  },
  riskLevel: {
    type: String,
    enum: ['High', 'Medium', 'Low'], // Only these values allowed
    default: 'Medium'
  },
  date: {
    type: Date,
    required: true // When was recall announced?
  },
  products: [{
    name: String,
    barcode: String,
    brand: String,
    image: String, // Product photo
    allergens: [String], // List of allergens
    ingredients: String, // Product ingredients
    nutritionFacts: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number
    }
  }],
  source: {
    type: String,
    enum: ['FSIS', 'FDA', 'Manual'], // Where recall info came from
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Resolved'],
    default: 'Active'
  },
  images: [{
    url: String,
    cloudinaryId: String, // For image deletion
    caption: String
  }]
}, { 
  // Automatically add createdAt and updatedAt fields
  timestamps: true 
});

// Create indexes for faster searches
recallSchema.index({ status: 1, date: -1 }); // Active recalls, newest first
recallSchema.index({ riskLevel: 1 }); // Search by risk level

// Create Recall model from schema
// This creates a "recalls" collection in MongoDB
module.exports = mongoose.model('Recall', recallSchema);