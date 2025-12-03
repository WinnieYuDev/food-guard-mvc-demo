const User = require('../models/User');
const Recall = require('../models/Recall');
const Post = require('../models/Post');

module.exports = {
  getProfile: async (req, res) => {
    try {
      if (!req.user) return res.redirect('/auth/login');

      // Populate pinned recalls
      const user = await User.findById(req.user.id).populate({ path: 'pinnedRecalls' }).lean();

      // Find comments authored by the user across posts
      const postsWithComments = await Post.find({ 'comments.author': req.user.id })
        .select('title comments')
        .lean();

      const userComments = [];
      for (const p of postsWithComments) {
        for (const c of p.comments) {
          if (c.author && c.author.toString() === req.user.id) {
            userComments.push({
              postId: p._id,
              postTitle: p.title,
              commentId: c._id,
              content: c.content,
              createdAt: c.createdAt
            });
          }
        }
      }

      res.render('profile', { title: `${user.username} - Profile`, user: req.user, pinnedRecalls: user.pinnedRecalls || [], comments: userComments });
    } catch (err) {
      console.error('Profile error:', err && err.message);
      req.flash('error', 'Failed to load profile');
      res.redirect('/');
    }
  },

  pinRecall: async (req, res) => {
    try {
      if (!req.user) return res.status(401).send('Unauthorized');
      const recallId = req.params.id;
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).send('User not found');

      if (!user.pinnedRecalls) user.pinnedRecalls = [];
      if (!user.pinnedRecalls.includes(recallId)) {
        user.pinnedRecalls.push(recallId);
        await user.save();
      }

      req.flash('success', 'Recall pinned');
      res.redirect('back');
    } catch (err) {
      console.error('Pin recall error:', err && err.message);
      req.flash('error', 'Failed to pin recall');
      res.redirect('back');
    }
  },

  unpinRecall: async (req, res) => {
    try {
      if (!req.user) return res.status(401).send('Unauthorized');
      const recallId = req.params.id;
      await User.findByIdAndUpdate(req.user.id, { $pull: { pinnedRecalls: recallId } });
      req.flash('success', 'Recall unpinned');
      res.redirect('back');
    } catch (err) {
      console.error('Unpin recall error:', err && err.message);
      req.flash('error', 'Failed to unpin recall');
      res.redirect('back');
    }
  }
};
