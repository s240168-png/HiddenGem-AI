const express = require('express');
const { getRecommendations } = require('../controllers/recommendationController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { recommendationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.post('/', authenticate, requireRole('traveler'), recommendationLimiter, getRecommendations);

module.exports = router;
