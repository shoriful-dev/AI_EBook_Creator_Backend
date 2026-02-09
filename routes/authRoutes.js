const express = require('express');
const { registerUser, loginUser, getProfile, updateUserProfile, updateUserAvatar } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/profile/avatar', protect, upload, updateUserAvatar);

module.exports = router;
