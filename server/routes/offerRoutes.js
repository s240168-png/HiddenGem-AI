const express = require('express');
const { getOffers, createOffer, deleteOffer } = require('../controllers/offerController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/', getOffers);
router.get('/active', getOffers);
router.post('/', authenticate, requireRole('merchant'), createOffer);
router.delete('/:id', authenticate, requireRole('merchant'), deleteOffer);

module.exports = router;
