/**
 * config/passport.js
 *
 * Passport local strategy configuration. Defines how users are
 * authenticated (email + password) and how user objects are
 * serialized/deserialized into the session store.
 */
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(new LocalStrategy(
    { 
      usernameField: 'email' // Use email as the username field
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
          return done(null, false, { message: 'No user found with that email' });
        }

        const isMatch = await user.comparePassword(password);
        
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, { message: 'Password is incorrect' });
        }
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};