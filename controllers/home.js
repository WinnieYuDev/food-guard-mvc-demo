// Import our database models
const Recall = require('../models/Recall');
const Post = require('../models/Post');

// Show homepage/dashboard
exports.getHome = async (req, res) => {
  try {
    let activeRecalls = [];
    let recentPosts = [];

    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      try {
        // Get active recalls from database (newest first, limit to 6)
        activeRecalls = await Recall.find({ status: 'Active' })
          .sort({ createdAt: -1 })
          .limit(6);

        // Get recent forum posts
        recentPosts = await Post.find({ isActive: true })
          .populate('author', 'username')
          .sort({ createdAt: -1 })
          .limit(3);
      } catch (dbError) {
        console.log('Database query failed:', dbError.message);
        // Continue with empty arrays
      }
    } else {
      console.log('MongoDB not connected, using empty data');
    }

    // Render the homepage with our data
    // Try different view names - use whichever exists in your views folder
    const viewName = getAvailableView(['index', 'home', 'dashboard']);
    res.render(viewName, {
      title: 'Dashboard - FoodGuard',
      recalls: activeRecalls,
      posts: recentPosts,
      dbConnected: isDbConnected
    });

  } catch (error) {
    console.error('Home controller error:', error);
    
    // Safe error handling - never try to render 'error' if it might not exist
    const viewName = getAvailableView(['home', 'index', 'dashboard']);
    res.render(viewName, {
      title: 'FoodGuard - Home',
      recalls: [],
      posts: [],
      error: 'Unable to load data at the moment'
    });
  }
};

// Helper function to find which view exists
function getAvailableView(preferredViews) {
  const fs = require('fs');
  const path = require('path');
  
  for (const view of preferredViews) {
    const viewPath = path.join(__dirname, '../views', view + '.ejs');
    if (fs.existsSync(viewPath)) {
      return view;
    }
  }
  // Fallback to first preferred view
  return preferredViews[0];
}