
/**
 * middleware/auth.js
 *
 * Simple authentication helpers used by routes to guard access.
 * - `isLoggedIn`: allow access only for authenticated users
 * - `isGuest`: allow access only for non-authenticated users
 */
module.exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to view this page');
  res.redirect('/auth/login');
};

module.exports.isGuest = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
};