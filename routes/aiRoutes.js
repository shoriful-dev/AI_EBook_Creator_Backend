const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { generateOutline, generateChapterContent } = require('../controllers/aiController');
const router = express.Router();

router.use(protect);

router.post('/generate-outline', generateOutline);
router.post('/generate-chapter-content', generateChapterContent);

module.exports = router;
