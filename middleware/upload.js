const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        
        // Ensure upload directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with original extension
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    console.log(`Processing file: ${file.originalname}, mimetype: ${file.mimetype}`);
    
    // Check file types based on field name
    if (file.fieldname === 'video') {
        // Accept MP4 videos
        if (file.mimetype === 'video/mp4' || path.extname(file.originalname).toLowerCase() === '.mp4') {
            cb(null, true);
        } else {
            cb(new Error('Video file must be in MP4 format'), false);
        }
    } else if (file.fieldname === 'audio') {
        // Accept MP3 audio
        if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3' || path.extname(file.originalname).toLowerCase() === '.mp3') {
            cb(null, true);
        } else {
            cb(new Error('Audio file must be in MP3 format'), false);
        }
    } else {
        cb(new Error('Unexpected field name'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit per file
        files: 2 // Maximum 2 files (video + audio)
    }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        let message = 'File upload error';
        
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File size too large. Maximum size is 500MB per file.';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files. Maximum is 2 files (1 video + 1 audio).';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field. Use "video" for MP4 and "audio" for MP3.';
                break;
            case 'LIMIT_FIELD_KEY':
                message = 'Field name too long.';
                break;
            case 'LIMIT_FIELD_VALUE':
                message = 'Field value too long.';
                break;
            case 'LIMIT_FIELD_COUNT':
                message = 'Too many fields.';
                break;
            case 'LIMIT_PART_COUNT':
                message = 'Too many parts in multipart form.';
                break;
        }
        
        // Clean up any uploaded files
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                if (Array.isArray(fileArray)) {
                    fileArray.forEach(file => {
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path);
                        }
                    });
                }
            });
        }
        
        return res.status(400).json({
            error: 'Upload error',
            message: message,
            code: error.code
        });
    }
    
    // Handle custom file filter errors
    if (error.message.includes('format')) {
        return res.status(400).json({
            error: 'Invalid file format',
            message: error.message
        });
    }
    
    next(error);
};

// Apply error handling to upload middleware
upload.handleError = handleMulterError;

module.exports = upload;
