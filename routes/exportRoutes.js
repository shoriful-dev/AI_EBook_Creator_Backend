const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { exportAsPDF, exportAsDocument } = require('../controllers/exportController');
const router = express.Router();

router.get('/:id/pdf', protect, exportAsPDF);
router.get('/:id/doc', protect, exportAsDocument);

module.exports = router;
