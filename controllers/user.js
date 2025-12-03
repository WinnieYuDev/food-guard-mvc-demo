const User = require('../models/User');
const Recall = require('../models/Recall');
const Post = require('../models/Post');
const recallApi = require('../services/recallAPI');
const recallsController = require('./recalls');

module.exports = {
  getProfile: async (req, res) => {
    try {
      if (!req.user) return res.redirect('/auth/login');

      // Populate pinned recalls
      const user = await User.findById(req.user.id)
        .populate({ path: 'pinnedRecalls' })
        .lean();

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

      // Verify the recall exists
      const recall = await Recall.findById(recallId).select('_id isActive status title');
      if (!recall) {
        req.flash('error', 'Recall not found');
        return res.redirect('back');
      }

      if (!user.pinnedRecalls) user.pinnedRecalls = [];

      // Normalize existing IDs to strings for comparison
      const pinnedIds = user.pinnedRecalls.map(id => id.toString());
      if (!pinnedIds.includes(recallId.toString())) {
        // Push the ObjectId to keep types consistent
        user.pinnedRecalls.push(recall._id);
        await user.save();
      }

      req.flash('success', recall.isActive === false ? 'Recall pinned (currently not active)' : 'Recall pinned');
        res.redirect(req.get('Referrer') || '/');
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
      // Ensure recall exists (optional, but helpful for feedback)
      const recall = await Recall.findById(recallId).select('_id title');
      if (!recall) {
        req.flash('error', 'Recall not found');
        return res.redirect(req.get('Referrer') || '/');
      }

      await User.findByIdAndUpdate(req.user.id, { $pull: { pinnedRecalls: recall._id } });
      req.flash('success', 'Recall unpinned');
        res.redirect(req.get('Referrer') || '/');
    } catch (err) {
      console.error('Unpin recall error:', err && err.message);
      req.flash('error', 'Failed to unpin recall');
      res.redirect(req.get('Referrer') || '/');
    }
  },

  // Pin by provider recallId (creates/updates the recall in DB if needed)
  pinRecallByRecallId: async (req, res) => {
    try {
      if (!req.user) return res.status(401).send('Unauthorized');
      const providerRecallId = req.params.recallId;
      if (!providerRecallId) {
        req.flash('error', 'Recall identifier missing');
          return res.redirect(req.get('Referrer') || '/');
      }

      // Try find in DB first
      let recallDoc = await Recall.findOne({ recallId: providerRecallId });

      if (!recallDoc) {
        // Attempt to fetch from provider APIs via recallAPI.searchRecalls
        const matches = await recallApi.searchRecalls(providerRecallId, 10);
        if (!matches || matches.length === 0) {
          req.flash('error', 'Recall not found in external providers');
          return res.redirect('back');
        }

        // Prefer exact recallId match from provider results
        let candidate = matches.find(m => (m.recallId && String(m.recallId) === String(providerRecallId))) || matches[0];

        // Persist candidate to DB (upsert)
        await recallsController.saveApiResultsToDB([candidate]);

        // Reload from DB
        recallDoc = await Recall.findOne({ recallId: candidate.recallId });
        if (!recallDoc) {
          req.flash('error', 'Failed to save recall to database');
          return res.redirect('back');
        }
      }

      console.log(`Pinning recall to user ${req.user.id}: recallId=${recallDoc.recallId} _id=${recallDoc._id}`);

      // Pin the recall for the user
      const user = await User.findById(req.user.id);
      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('back');
      }

      if (!user.pinnedRecalls) user.pinnedRecalls = [];
      const pinnedIds = user.pinnedRecalls.map(id => id.toString());
      if (!pinnedIds.includes(String(recallDoc._id))) {
        user.pinnedRecalls.push(recallDoc._id);
        await user.save();
      }

      req.flash('success', recallDoc.isActive === false ? 'Recall pinned (currently not active)' : 'Recall pinned');
      return res.redirect(req.get('Referrer') || '/');
    } catch (err) {
      console.error('Pin by recallId error:', err && err.message);
      req.flash('error', 'Failed to pin recall');
      return res.redirect(req.get('Referrer') || '/');
    }
  }
};
