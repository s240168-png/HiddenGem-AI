const rateLimit = require('express-rate-limit');

function createRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs: Number(windowMs) || 15 * 60 * 1000,
    max: Number(max) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({
        success: false,
        message: message || 'Too many requests. Please try again later.'
      });
    }
  });
}

const loginLimiter = createRateLimiter({
  windowMs: process.env.RATE_LIMIT_LOGIN_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_LOGIN_MAX || 10,
  message: 'Too many login attempts. Please try again later.'
});

const registerLimiter = createRateLimiter({
  windowMs: process.env.RATE_LIMIT_REGISTER_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_REGISTER_MAX || 15,
  message: 'Too many account creation attempts. Please try again later.'
});

const resendVerificationLimiter = createRateLimiter({
  windowMs: process.env.RATE_LIMIT_VERIFY_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_VERIFY_MAX || 5,
  message: 'Too many verification email requests. Please try again later.'
});

const recommendationLimiter = createRateLimiter({
  windowMs: process.env.RATE_LIMIT_RECOMMENDATION_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_RECOMMENDATION_MAX || 30,
  message: 'Too many recommendation requests. Please wait before generating another route.'
});

const weatherMutationLimiter = createRateLimiter({
  windowMs: process.env.RATE_LIMIT_WEATHER_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_WEATHER_MAX || 30,
  message: 'Too many weather simulation requests. Please wait before trying again.'
});

module.exports = {
  loginLimiter,
  registerLimiter,
  resendVerificationLimiter,
  recommendationLimiter,
  weatherMutationLimiter,
  createRateLimiter
};
