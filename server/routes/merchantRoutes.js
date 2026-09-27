const express = require('express');
const { getAnalytics, getMerchantExperiences } = require('../controllers/merchantController');
const {
  createMerchantExperience,
  updateMerchantExperience,
  deleteMerchantExperience
} = require('../controllers/experienceController');
const { getMerchantBookings } = require('../controllers/bookingController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/analytics', authenticate, requireRole('merchant'), getAnalytics);
router.get('/experiences', authenticate, requireRole('merchant'), getMerchantExperiences);
router.post('/experiences', authenticate, requireRole('merchant'), createMerchantExperience);
router.patch('/experiences/:id', authenticate, requireRole('merchant'), updateMerchantExperience);
router.delete('/experiences/:id', authenticate, requireRole('merchant'), deleteMerchantExperience);
router.get('/bookings', authenticate, requireRole('merchant'), getMerchantBookings);

module.exports = router;
