/**
 * middleware/multer.js
 *
 * Multer configuration and helper middleware for handling image uploads.
 * - `upload`: multer middleware that stores files temporarily on disk
 * - `handleCloudinaryUpload`: uploads the file to Cloudinary and
 *    attaches `req.cloudinaryResult` with metadata for downstream handlers
 * - `allowed_formats`: list of accepted image file extensions
 */
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

const allowed_formats = ['jpg', 'jpeg', 'png', 'avif'];

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

const handleCloudinaryUpload = async (req, res, next) => {
    if (!req.file) {
        return next();
    }

    const filePath = req.file.path;

    try {
        const uploadOptions = {
            folder: 'food-guard-posts',
            allowed_formats: allowed_formats, // Now includes AVIF
            transformation: [
                { width: 800, height: 600, crop: 'limit' }
            ]
        };

        const result = await cloudinary.uploader.upload(filePath, uploadOptions);
        
        req.cloudinaryResult = {
            imageUrl: result.secure_url,
            cloudinaryId: result.public_id,
            format: result.format,
            bytes: result.bytes,
            originalFilename: req.file.originalname
        };

        console.log(`Cloudinary upload successful: ${req.cloudinaryResult.format.toUpperCase()} | ${(req.cloudinaryResult.bytes / 1024).toFixed(2)}KB`);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Local file deleted: ${path.basename(filePath)}`);
        } else {
            console.log(`Local file already deleted or not found: ${path.basename(filePath)}`);
        }
        
        next();
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Local file deleted after error: ${path.basename(filePath)}`);
        }
        
        next(error);
    }
};

module.exports = {
    upload,
    handleCloudinaryUpload,
    allowed_formats
};