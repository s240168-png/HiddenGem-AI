const express = require('express');
const { register, verifyEmail, resendVerification, login, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { loginLimiter, registerLimiter, resendVerificationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', registerLimiter, register);
router.post('/verify', verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, resendVerification);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

module.exports = router;
