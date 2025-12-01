// controllers/home.js
const Post = require('../models/Post');
const Recall = require('../models/Recall');

exports.getHome = async (req, res) => {
  try {
    console.log('🏠 Home controller called!'); // Debug log
    
    let activeRecalls = [];
    let recentPosts = [];

    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      try {
        // Get active recalls
        activeRecalls = await Recall.find({ isActive: true })
          .sort({ recallDate: -1 })
          .limit(6)
          .lean();

        // Get recent posts
        recentPosts = await Post.find({ isActive: true })
          .populate('author', 'username')
          .sort({ createdAt: -1 })
          .limit(3)
          .lean();
          
        console.log(`✅ Homepage data loaded: ${recentPosts.length} posts, ${activeRecalls.length} recalls`);
      } catch (dbError) {
        console.log('Database query failed:', dbError.message);
      }
    } else {
      console.log('MongoDB not connected, using empty data');
    }

    // Render the homepage
    console.log('📤 Rendering index.ejs with posts:', recentPosts.length); // Debug log
    res.render('index', {
      title: 'FoodGuard - Home',
      recalls: activeRecalls,
      posts: recentPosts,
      user: req.user
    });

  } catch (error) {
    console.error('❌ Home controller error:', error);
    
    // Safe fallback
    res.render('index', {
      title: 'FoodGuard - Home',
      recalls: [],
      posts: [],
      user: req.user
    });
  }
};