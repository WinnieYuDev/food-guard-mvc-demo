// Load environment variables from .env file
// This lets us use process.env.PORT, process.env.MONGODB_URI, etc.
require('dotenv').config();

// Import all the packages we need
const express = require('express'); // Main web framework
const session = require('express-session'); // For user sessions
const passport = require('passport'); // For authentication
const MongoStore = require('connect-mongo'); // Store sessions in MongoDB
const flash = require('express-flash'); // For temporary messages
const path = require('path'); // For working with file paths

// Create our Express application
const app = express();

// Import database connection function
const connectDB = require('./config/database');

// Set up Passport for authentication (login system)
require('./config/passport')(passport);

// ===== MIDDLEWARE SETUP =====
// Middleware are functions that run on every request

// This lets us read form data and JSON from requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (CSS, images, JavaScript) from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Set up sessions to remember logged in users
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

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// Set up flash messages for user feedback (success/error messages)
app.use(flash());

// ===== VIEW ENGINE SETUP =====

// Use EJS as our template engine (for dynamic HTML)
app.set('view engine', 'ejs');
// Tell Express where to find our view files
app.set('views', path.join(__dirname, 'views'));

// ===== GLOBAL VARIABLES =====
// Make these available in all our EJS templates

app.use((req, res, next) => {
  res.locals.user = req.user; // Current logged in user info
  res.locals.success = req.flash('success'); // Success messages
  res.locals.error = req.flash('error'); // Error messages
  next(); // Move to next middleware
});

// ===== ROUTES =====
// Import our route files - these handle different URLs

app.use('/', require('./routes/main')); // Homepage and dashboard
app.use('/auth', require('./routes/auth')); // Login and signup
app.use('/recalls', require('./routes/recalls')); // Food recalls
app.use('/posts', require('./routes/posts')); // Forum posts

// ===== ERROR HANDLING MIDDLEWARE =====

// 404 - Page not found
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    user: req.user
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  // Set error status
  const statusCode = err.status || 500;
  
  res.status(statusCode).render('error', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {},
    user: req.user
  });
});

// ===== START SERVER AFTER DB CONNECTION =====

const startServer = async () => {
  try {
    console.log('🔌 Attempting to connect to database...');
    
    // Wait for database connection first
    await connectDB();
    
    // Then start the server
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
    console.error('='.repeat(50));
    console.error('Error:', error.message);
    console.log('\nTROUBLESHOOTING STEPS:');
    console.log('1. Check if MongoDB is running');
    console.log('2. Verify MONGODB_URI in .env file');
    console.log('3. Check your internet connection (if using MongoDB Atlas)');
    console.log('4. Make sure MongoDB service is started');
    console.log('='.repeat(50));
    
    process.exit(1);
  }
};

// Start the application
startServer();
