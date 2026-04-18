const express = require('express');
const { initPayment, paymentSuccess, paymentFail, paymentCancel, paymentIPN } = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/init', protect, initPayment);
router.post('/success', paymentSuccess);
router.post('/fail', paymentFail);
router.post('/cancel', paymentCancel);
router.post('/ipn', paymentIPN);

module.exports = router;
