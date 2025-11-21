// Import required modules
const Post = require('../models/Post');

module.exports = {
  // Get all posts for the forum page
  getPosts: async (req, res) => {
    try {
      // Get page number from URL or use page 1
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const category = req.query.category;

      // Build our query - only show active posts
      const query = { isActive: true };
      
      // Add category filter if user selected one
      if (category && category !== 'all') {
        query.category = category;
      }

      // Get posts from database with pagination
      const posts = await Post.find(query)
        .populate('author', 'username') // Get author's username
        .sort({ createdAt: 'desc' }) // Newest posts first
        .limit(limit)
        .skip((page - 1) * limit)
        .lean(); // Convert to plain JavaScript objects

      // Count total posts for pagination
      const total = await Post.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      // Render the posts page with our data
      res.render('posts', {
        title: 'Community Forum - FoodGuard',
        posts: posts,
        user: req.user,
        pagination: {
          page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        currentCategory: category
      });
    } catch (err) {
      console.log(err);
      res.status(500).render('error', {
        title: 'Server Error',
        message: 'Failed to load posts'
      });
    }
  },

  // Get a single post with its comments
  getPost: async (req, res) => {
    try {
      // Find the post by ID and populate author info
      const post = await Post.findById(req.params.id)
        .populate('author', 'username')
        .lean(); // Convert to plain JavaScript object

      // If post doesn't exist, show error
      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      // Render the single post page
      res.render('post', {
        title: `${post.title} - FoodGuard`,
        post: post,
        user: req.user
      });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Failed to load post');
      res.redirect('/posts');
    }
  },

  // Create a new post - UPDATED VERSION
  createPost: async (req, res) => {
    try {
      console.log('📝 Creating post...');
      console.log('📁 File:', req.file ? 'Exists' : 'None');
      console.log('☁️ Cloudinary result:', req.cloudinaryResult ? 'Exists' : 'None');

      let imageData = null;
      
      // Use req.cloudinaryResult from multer middleware instead of req.file
      if (req.cloudinaryResult) {
        imageData = {
          url: req.cloudinaryResult.imageUrl,
          cloudinaryId: req.cloudinaryResult.cloudinaryId,
          caption: req.body.imageCaption || ''
        };
        console.log('✅ Using image from Cloudinary middleware:', imageData.url);
      }
      // REMOVED: The req.file upload logic - it conflicts with multer middleware

      // Create the new post in database
      await Post.create({
        title: req.body.title,
        content: req.body.content,
        image: imageData,
        category: req.body.category || 'general',
        likes: 0,
        author: req.user.id,
      });

      console.log('✅ Post created successfully!');
      console.log('🖼️ Image attached:', !!imageData);
      
      req.flash('success', 'Post created successfully!' + (imageData ? ' (with image)' : ''));
      res.redirect('/posts');
    } catch (err) {
      console.error('❌ Error creating post:', err);
      req.flash('error', 'Failed to create post: ' + err.message);
      res.redirect('/posts/new');
    }
  },

  // Like a post (increase like count by 1)
  likePost: async (req, res) => {
    try {
      // Find the post and increase likes by 1
      await Post.findOneAndUpdate(
        { _id: req.params.id },
        {
          $inc: { likes: 1 }, // Increase likes by 1
        }
      );
      console.log('Likes +1');
      
      // Redirect back to the post page
      res.redirect(`/posts/${req.params.id}`);
    } catch (err) {
      console.log(err);
      res.redirect('/posts');
    }
  },

  // Delete a post
  deletePost: async (req, res) => {
    try {
      // Find post by id
      const post = await Post.findById(req.params.id);
      
      // If post doesn't exist, show error
      if (!post) {
        console.log('Post not found');
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      // Check if user is the author of the post
      if (post.author.toString() !== req.user.id) {
        req.flash('error', 'You can only delete your own posts');
        return res.redirect('/posts');
      }

      // If post has an image, delete it from Cloudinary
      if (post.image && post.image.cloudinaryId) {
        await cloudinary.uploader.destroy(post.image.cloudinaryId);
      }

      // Delete post from database using Mongoose 8 syntax
      await Post.findByIdAndDelete(req.params.id);

      console.log('Deleted Post');
      req.flash('success', 'Post deleted successfully');
      res.redirect('/posts');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Failed to delete post');
      res.redirect('/posts');
    }
  },

  // Add a comment to a post
  addComment: async (req, res) => {
    try {
      const { content } = req.body;
      const postId = req.params.id;

      // Find the post
      const post = await Post.findById(postId);
      
      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      // Add the new comment to the post
      post.comments.push({
        content: content,
        author: req.user.id,
        likes: 0
      });

      // Save the updated post
      await post.save();

      console.log('Comment added!');
      req.flash('success', 'Comment added successfully!');
      res.redirect(`/posts/${postId}`);
    } catch (err) {
      console.log(err);
      req.flash('error', 'Failed to add comment');
      res.redirect('/posts');
    }
  },

  // Like a comment
  likeComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      // Find the post
      const post = await Post.findById(postId);
      
      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      // Find the comment in the post's comments array
      const comment = post.comments.id(commentId);
      
      if (!comment) {
        req.flash('error', 'Comment not found');
        return res.redirect(`/posts/${postId}`);
      }

      // Increase comment likes by 1
      comment.likes += 1;
      
      // Save the updated post
      await post.save();

      console.log('Comment liked!');
      res.redirect(`/posts/${postId}`);
    } catch (err) {
      console.log(err);
      req.flash('error', 'Failed to like comment');
      res.redirect('/posts');
    }
  },

  // Delete a comment
  deleteComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      // Find the post
      const post = await Post.findById(postId);
      
      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      // Find the comment
      const comment = post.comments.id(commentId);
      
      if (!comment) {
        req.flash('error', 'Comment not found');
        return res.redirect(`/posts/${postId}`);
      }

      // Check if user is the author of the comment
      if (comment.author.toString() !== req.user.id) {
        req.flash('error', 'You can only delete your own comments');
        return res.redirect(`/posts/${postId}`);
      }

      // Remove the comment from the post
      post.comments.pull(commentId);
      
      // Save the updated post
      await post.save();

      console.log('Comment deleted!');
      req.flash('success', 'Comment deleted');
      res.redirect(`/posts/${postId}`);
    } catch (err) {
      console.log(err);
      req.flash('error', 'Failed to delete comment');
      res.redirect('/posts');
    }
  }
};