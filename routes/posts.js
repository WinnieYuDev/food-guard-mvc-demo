/**
 * routes/posts.js
 *
 * Router for community forum post actions (create, view, like, comment).
 * Routes are protected with authentication middleware where appropriate
 * and delegate business logic to `controllers/posts`.
 */
const express = require('express');
const router = express.Router();
const postsController = require('../controllers/posts');
const { isLoggedIn } = require('../middleware/auth');
const { upload, handleCloudinaryUpload } = require('../middleware/multer');
// List all posts
router.get('/', isLoggedIn, postsController.getPosts);

router.get('/:id', isLoggedIn, postsController.getPost);

router.post('/', isLoggedIn, upload.single('image'), handleCloudinaryUpload, postsController.createPost);

router.post('/:id/like', isLoggedIn, postsController.likePost);

router.post('/:id/delete', isLoggedIn, postsController.deletePost);

router.post('/:id/comments', isLoggedIn, postsController.addComment);

router.post('/:postId/comments/:commentId/like', isLoggedIn, postsController.likeComment);

router.post('/:postId/comments/:commentId/delete', isLoggedIn, postsController.deleteComment);

module.exports = router;