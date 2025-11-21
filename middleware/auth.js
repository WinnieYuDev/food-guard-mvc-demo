// Middleware functions - these run before our route handlers
// They can check things and decide whether to continue or redirect

// Check if user is logged in
module.exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    // User is logged in - allow them to continue to the route
    return next();
  }
  // User not logged in - show error and redirect to login page
  req.flash('error', 'Please log in to view this page');
  res.redirect('/auth/login');
};

// Check if user is NOT logged in (guest)
module.exports.isGuest = (req, res, next) => {
  if (!req.isAuthenticated()) {
    // User is not logged in - allow them to continue
    return next();
  }
  // User is already logged in - redirect to homepage
  res.redirect('/');
};