const express = require('express');
const { getWeather, simulateWeather, restoreWeather } = require('../controllers/weatherController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { weatherMutationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.get('/', authenticate, requireRole('traveler'), getWeather);
router.post('/simulate', authenticate, requireRole('traveler'), weatherMutationLimiter, simulateWeather);
router.post('/restore', authenticate, requireRole('traveler'), weatherMutationLimiter, restoreWeather);

module.exports = router;
