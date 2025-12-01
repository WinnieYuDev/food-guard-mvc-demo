/**
 * middleware/cloudinary.js
 *
 * Thin wrapper that configures and exports the Cloudinary v2 client used
 * by upload middleware and other parts of the application to send images
 * to the Cloudinary service. Configuration is read from environment
 * variables for secure deployment.
 */
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;