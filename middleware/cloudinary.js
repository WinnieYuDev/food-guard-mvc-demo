// Cloudinary helps us store and manage images in the cloud
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with our account details from .env file
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Export configured Cloudinary so other files can use it
module.exports = cloudinary;