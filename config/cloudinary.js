/**
 * config/cloudinary.js
 *
 * Configuration for the Cloudinary client used by server-side upload
 * handlers. Reads credentials from environment variables and exports
 * the configured Cloudinary v2 client for reuse across the app.
 */
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;