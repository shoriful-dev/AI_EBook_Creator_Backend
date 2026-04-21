const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use absolute path for upload directory. On Vercel, use /tmp as it is the only writable directory.
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const uploadDir = isVercel ? '/tmp' : path.resolve(process.cwd(), 'uploads');

// Ensure directory exists (only works if parent is writable)
try {
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (err) {
    console.error('Directory creation failed:', err.message);
}

// Set up storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, `cover-${Date.now()}${path.extname(file.originalname)}`);
    }
});

// check file type
const checkFileType = (file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('coverImage');

module.exports = upload; 
