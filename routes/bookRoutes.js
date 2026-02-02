const express = require('express');
const router = express.Router();
const { createBook, getBooks, getBookById, updateBook, deleteBook, updateBookCover } = require('../controllers/bookController');
const upload = require('../middlewares/uploadMiddleware');
const { protect } = require('../middlewares/authMiddleware');

// apply protect middleware to all routes
router.use(protect); 

router.route('/').post(createBook).get(getBooks);
router.route('/:id').get(getBookById).put(updateBook).delete(deleteBook);
router.route('/cover/:id').put(upload, updateBookCover);

module.exports = router;
