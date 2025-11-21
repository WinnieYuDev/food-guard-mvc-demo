// Passport helps us handle user login securely
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

// This function sets up how Passport works
module.exports = function(passport) {
  // Tell Passport to use local strategy (email/password login)
  passport.use(new LocalStrategy(
    { 
      usernameField: 'email' // Use email as the username field
    },
    // This function checks if login credentials are correct
    async (email, password, done) => {
      try {
        // Look for user by email (convert to lowercase for consistency)
        const user = await User.findOne({ email: email.toLowerCase() });
        
        // If no user found, return error
        if (!user) {
          return done(null, false, { message: 'No user found with that email' });
        }

        // Check if password matches using our comparePassword method
        const isMatch = await user.comparePassword(password);
        
        if (isMatch) {
          // Password is correct - return the user
          return done(null, user);
        } else {
          // Password is incorrect - return error
          return done(null, false, { message: 'Password is incorrect' });
        }
      } catch (err) {
        // If something goes wrong, return the error
        return done(err);
      }
    }
  ));

  // Store only user ID in session (for security - don't store entire user)
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Get user from session using ID
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};