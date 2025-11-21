// routes/posts.js
const express = require('express');
const router = express.Router();
const postsController = require('../controllers/posts');
const { isLoggedIn } = require('../middleware/auth');
const { upload, handleCloudinaryUpload } = require('../middleware/multer');

// Forum posts page (must be logged in)
router.get('/', isLoggedIn, postsController.getPosts);

// Single post page (must be logged in)
router.get('/:id', isLoggedIn, postsController.getPost);

// Create new post (must be logged in, can upload image)
router.post('/', isLoggedIn, upload.single('image'), handleCloudinaryUpload, postsController.createPost);

// Like a post (must be logged in)
router.post('/:id/like', isLoggedIn, postsController.likePost);

// Delete a post (must be logged in)
router.post('/:id/delete', isLoggedIn, postsController.deletePost);

// Add comment to post (must be logged in)
router.post('/:id/comments', isLoggedIn, postsController.addComment);

// Like a comment (must be logged in)
router.post('/:postId/comments/:commentId/like', isLoggedIn, postsController.likeComment);

// Delete a comment (must be logged in)
router.post('/:postId/comments/:commentId/delete', isLoggedIn, postsController.deleteComment);

module.exports = router;