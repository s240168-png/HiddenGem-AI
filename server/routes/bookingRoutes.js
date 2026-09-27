const express = require('express');
const {
  createBooking,
  getMyBookings,
  getMerchantBookings,
  getBookingById,
  cancelBooking
} = require('../controllers/bookingController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/my', authenticate, requireRole('traveler'), getMyBookings);
router.get('/merchant', authenticate, requireRole('merchant'), getMerchantBookings);
router.post('/', authenticate, requireRole('traveler'), createBooking);
router.get('/:bookingId', authenticate, getBookingById);
router.post('/:bookingId/cancel', authenticate, cancelBooking);
router.delete('/:bookingId', authenticate, cancelBooking);

module.exports = router;
