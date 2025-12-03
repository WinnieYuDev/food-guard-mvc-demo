/**
 * FoodGuard - Server entrypoint
 *
 * Boots the Express application and wires up middleware, session store,
 * authentication, routes and starts the HTTP server once MongoDB is
 * connected. Intended as the single start point for local development
 * and simple deployments.
 *
 * High-level flow:
 *  - Load environment configuration
 *  - Initialize Express, sessions and Passport
 *  - Mount route modules: main, auth, recalls, posts
 *  - Start server after connecting to MongoDB
 */
require('dotenv').config();

const express = require('express');
// Main web framework
const session = require('express-session'); // For user sessions
const passport = require('passport'); // For authentication
const MongoStore = require('connect-mongo'); // Store sessions in MongoDB
const flash = require('express-flash'); // For temporary messages
const path = require('path'); // For working with file paths

const app = express();

// === Database Connection ===
// Establishes MongoDB connection used by the session store and application.
const connectDB = require('./config/database');

// === Authentication Initialization ===
// Configure Passport strategies and serialization logic
require('./config/passport')(passport);


// === Middleware: Body Parsing ===
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === Middleware: Static Files ===
app.use(express.static(path.join(__dirname, 'public')));

// === Middleware: Sessions ===
app.use(session({
  secret: process.env.SESSION_SECRET, // Secret key to encrypt sessions
  resave: false, // Don't save session if nothing changed
  saveUninitialized: false, // Don't create empty sessions
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI // Store sessions in MongoDB
  }),
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24 // Session lasts 1 day (in milliseconds)
  }
}));


// === Middleware: Authentication ===
app.use(passport.initialize());
app.use(passport.session());

// === Middleware: Flash messages ===
app.use(flash());

// === View Engine ===
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// === Middleware: Pass user info ===
app.use((req, res, next) => {
  res.locals.user = req.user; // Current logged in user info
  res.locals.success = req.flash('success'); // Success messages
  res.locals.error = req.flash('error'); // Error messages
  next(); // Move to next middleware
});

// === Routes ===
app.use('/', require('./routes/main')); // Homepage and dashboard
app.use('/auth', require('./routes/auth')); // Login and signup
app.use('/recalls', require('./routes/recalls')); // Food recalls
app.use('/posts', require('./routes/posts')); // Forum posts

// === 404 Not Found ===
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    user: req.user
  });
});

// === Error Handling ===
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  const statusCode = err.status || 500;
  
  res.status(statusCode).render('error', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {},
    user: req.user
  });
});

// === Start Server ===
const startServer = async () => {
  try {
    console.log('Attempting to connect to database...');
    
    await connectDB();
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`FoodGuard server running on port ${PORT}`);
      console.log(`Visit: http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: ${process.env.MONGODB_URI}`);
      console.log('='.repeat(50));
    });
    
  } catch (error) {
    console.error('='.repeat(50));
    console.error('FAILED TO START SERVER');
    process.exit(1);
  }
};

// === Scheduled Tasks ===
const cron = require('node-cron');
const { exec } = require('child_process');

// Schedule the active-update to run twice daily: at 00:00 and 12:00 server time
cron.schedule('0 0,12 * * *', () => {
  exec('node ./scripts/update_active_from_usda.js --backup', { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) console.error('Active update failed:', err);
    else console.log('Active update run:', stdout);
  });
});

startServer();
