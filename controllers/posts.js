const Post = require('../models/Post');

module.exports = {
  getPosts: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const category = req.query.category;

      const query = { isActive: true };
      
      if (category && category !== 'all') {
        query.category = category;
      }

      const posts = await Post.find(query)
        .populate('author', 'username') // Get author's username
        .sort({ createdAt: 'desc' }) // Newest posts first
        .limit(limit)
        .skip((page - 1) * limit)
        .lean(); // Convert to plain JavaScript objects

      const total = await Post.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

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

  getPost: async (req, res) => {
    try {
      const post = await Post.findById(req.params.id)
        .populate('author', 'username')
        .lean(); // Convert to plain JavaScript object

      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

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

  createPost: async (req, res) => {
    try {
      console.log('📝 Creating post...');
      console.log('📁 File:', req.file ? 'Exists' : 'None');
      console.log('☁️ Cloudinary result:', req.cloudinaryResult ? 'Exists' : 'None');

      let imageData = null;
      
      if (req.cloudinaryResult) {
        imageData = {
          url: req.cloudinaryResult.imageUrl,
          cloudinaryId: req.cloudinaryResult.cloudinaryId,
          caption: req.body.imageCaption || ''
        };
        console.log('✅ Using image from Cloudinary middleware:', imageData.url);
      }

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

  likePost: async (req, res) => {
    try {
      await Post.findOneAndUpdate(
        { _id: req.params.id },
        {
          $inc: { likes: 1 }, // Increase likes by 1
        }
      );
      console.log('Likes +1');
      
      res.redirect(`/posts/${req.params.id}`);
    } catch (err) {
      console.log(err);
      res.redirect('/posts');
    }
  },

  deletePost: async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      
      if (!post) {
        console.log('Post not found');
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      if (post.author.toString() !== req.user.id) {
        req.flash('error', 'You can only delete your own posts');
        return res.redirect('/posts');
      }

      if (post.image && post.image.cloudinaryId) {
        await cloudinary.uploader.destroy(post.image.cloudinaryId);
      }

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

  addComment: async (req, res) => {
    try {
      const { content } = req.body;
      const postId = req.params.id;

      const post = await Post.findById(postId);
      
      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      post.comments.push({
        content: content,
        author: req.user.id,
        likes: 0
      });

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

  likeComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      const post = await Post.findById(postId);
      
      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      const comment = post.comments.id(commentId);
      
      if (!comment) {
        req.flash('error', 'Comment not found');
        return res.redirect(`/posts/${postId}`);
      }

      comment.likes += 1;
      
      await post.save();

      console.log('Comment liked!');
      res.redirect(`/posts/${postId}`);
    } catch (err) {
      console.log(err);
      req.flash('error', 'Failed to like comment');
      res.redirect('/posts');
    }
  },

  deleteComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      const post = await Post.findById(postId);
      
      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      const comment = post.comments.id(commentId);
      
      if (!comment) {
        req.flash('error', 'Comment not found');
        return res.redirect(`/posts/${postId}`);
      }

      if (comment.author.toString() !== req.user.id) {
        req.flash('error', 'You can only delete your own comments');
        return res.redirect(`/posts/${postId}`);
      }

      post.comments.pull(commentId);
      
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