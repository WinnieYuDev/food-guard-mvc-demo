// controllers/home.js
const Post = require('../models/Post');
const Recall = require('../models/Recall');

// ======================
// 1. CATEGORY IMAGE MAPPING
// ======================
const categoryImageMap = {
    'poultry': 'https://images.unsplash.com/photo-1587590227264-0ac64ce63ce8?w=800&h=600&fit=crop',
    'beef': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&h=600&fit=crop',
    'pork': 'https://images.unsplash.com/photo-1551028136-8e4ee2c1f9c9?w=800&h=600&fit=crop',
    'seafood': 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&h=600&fit=crop',
    'vegetables': 'https://images.unsplash.com/photo-1515772319939-5c8cdccdb696?w=800&h=600&fit=crop',
    'fruits': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=600&fit=crop',
    'dairy': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop',
    'eggs': 'https://images.unsplash.com/photo-1604979645580-227a6bcaf5c6?w=800&h=600&fit=crop',
    'nuts': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop',
    'grains': 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&h=600&fit=crop',
    'snacks': 'https://images.unsplash.com/photo-1582169296194-e3d8ebf6c4cb?w=800&h=600&fit=crop',
    'baby-food': 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=600&fit=crop',
    'other': '../imgs/placeholder-food.png' // Local fallback
};

// Helper function to get the correct image URL
const getCategoryImage = (category) => {
    if (!category) return categoryImageMap.other;
    const normalizedCategory = category.toLowerCase().trim();
    return categoryImageMap[normalizedCategory] || categoryImageMap.other;
};

// ======================
// 2. MAIN CONTROLLER
// ======================
exports.getHome = async (req, res) => {
    try {
        console.log('🏠 Home controller called!');

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

                console.log(`📊 Found ${activeRecalls.length} active recalls`);

                // CRITICAL: Enhance each recall with a category image
                activeRecalls = activeRecalls.map(recall => {
                    const category = recall.category || 'other';
                    const categoryImage = getCategoryImage(category);

                    return {
                        ...recall, // Keep all original properties
                        // Add the new image property for the template
                        categoryImage: categoryImage,
                        // Also update the main 'image' property as a reliable fallback
                        image: categoryImage
                    };
                });

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
        console.log('📤 Rendering index.ejs');
        res.render('index', {
            title: 'FoodGuard - Home',
            recalls: activeRecalls, // This now contains the 'categoryImage' property
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