// middleware/multer.js
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Define allowed formats - added AVIF to existing formats
const allowed_formats = ['jpg', 'jpeg', 'png', 'avif'];

// Use disk storage to temporarily store files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            // Check file extension against allowed formats
            const fileExtension = file.originalname.toLowerCase().split('.').pop();
            if (allowed_formats.includes(fileExtension)) {
                cb(null, true);
            } else {
                cb(new Error(`Unsupported file format. Allowed formats: ${allowed_formats.join(', ')}`), false);
            }
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Middleware to handle Cloudinary upload after multer
const handleCloudinaryUpload = async (req, res, next) => {
    // If no file was uploaded, move to next middleware
    if (!req.file) {
        return next();
    }

    // Store the file path early since req.file might get modified
    const filePath = req.file.path;

    try {
        // Cloudinary upload configuration with AVIF support
        const uploadOptions = {
            folder: 'food-guard-posts',
            allowed_formats: allowed_formats, // Now includes AVIF
            transformation: [
                { width: 800, height: 600, crop: 'limit' }
            ]
        };

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(filePath, uploadOptions);
        
        // Add Cloudinary info to request object
        req.cloudinaryResult = {
            imageUrl: result.secure_url,
            cloudinaryId: result.public_id,
            format: result.format,
            bytes: result.bytes,
            originalFilename: req.file.originalname
        };

        // Log upload success with format info
        console.log(`Cloudinary upload successful: ${req.cloudinaryResult.format.toUpperCase()} | ${(req.cloudinaryResult.bytes / 1024).toFixed(2)}KB`);
        
        // Safely delete local file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Local file deleted: ${path.basename(filePath)}`);
        } else {
            console.log(`Local file already deleted or not found: ${path.basename(filePath)}`);
        }
        
        next();
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        
        // Safely delete local file on error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Local file deleted after error: ${path.basename(filePath)}`);
        }
        
        next(error);
    }
};

// Export both multer and Cloudinary middleware
module.exports = {
    upload,
    handleCloudinaryUpload,
    allowed_formats
};