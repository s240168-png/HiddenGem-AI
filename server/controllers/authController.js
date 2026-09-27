const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const emailService = require('../services/emailService');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET environment variable is missing.');
  }
  return secret;
}

const COOKIE_NAME = 'hgai_token';

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax'
  });
}

async function register(req, res) {
  try {
    const { name, email, password, role, businessName, phone, address, latitude, longitude } = req.body;

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters long.' });
    }
    if (!role || !['traveler', 'merchant'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be either "traveler" or "merchant".' });
    }
    if (role === 'traveler' && (!name || typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide your full name.' });
    }
    if (role === 'merchant') {
      const bName = businessName || name;
      if (!bName || typeof bName !== 'string' || !bName.trim()) {
        return res.status(400).json({ success: false, message: 'Please provide a business or studio name.' });
      }
    }

    const { user, verificationToken } = await userModel.createUser({
      name,
      email,
      password,
      role,
      businessName,
      phone,
      address,
      latitude,
      longitude
    });

    // Send verification email via abstract email service
    await emailService.sendVerificationEmail({
      email: user.email,
      name: user.name,
      token: verificationToken
    });

    return res.status(201).json({
      success: true,
      data: {
        user,
        message: 'Account created! A verification email has been sent. Please check your inbox to verify your account.'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Registration failed.' });
  }
}

async function verifyEmail(req, res) {
  try {
    const { token, email } = req.body;
    const tokenToUse = token || req.query.token || req.query.verifyToken;
    const emailToUse = email || req.query.email;

    if (!tokenToUse || !String(tokenToUse).trim()) {
      return res.status(400).json({ success: false, message: 'Verification token is required.' });
    }

    const user = await userModel.verifyUserEmail(tokenToUse, emailToUse);

    const authToken = createToken(user);
    setAuthCookie(res, authToken);

    return res.json({
      success: true,
      data: {
        user,
        token: authToken,
        message: 'Email successfully verified! You are now logged in.'
      }
    });
  } catch (error) {
    console.error('Verification error:', error.message);
    const statusCode = error.code === 'ALREADY_VERIFIED' ? 400 : 400;
    return res.status(statusCode).json({
      success: false,
      alreadyVerified: error.code === 'ALREADY_VERIFIED',
      expired: error.code === 'EXPIRED_TOKEN',
      message: error.message || 'Verification failed.'
    });
  }
}

async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const { user, rawToken, alreadyVerified } = await userModel.createResendVerificationToken(email);

    if (alreadyVerified) {
      return res.status(400).json({
        success: false,
        alreadyVerified: true,
        message: 'This account is already verified. Please log in.'
      });
    }

    if (user && rawToken) {
      await emailService.sendVerificationEmail({
        email: user.email,
        name: user.name,
        token: rawToken
      });
    }

    return res.json({
      success: true,
      data: {
        message: 'If an account exists with this email address, a verification link has been sent.'
      }
    });
  } catch (error) {
    const status = error.code === 'TOO_MANY_REQUESTS' ? 429 : 400;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to resend verification email.'
    });
  }
}

async function login(req, res) {
  try {
    const { email, password, role } = req.body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await userModel.verifyPassword(user, password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Role check: prevent traveler logging in via merchant or vice versa if role specified
    if (role && user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `This account is registered as a ${user.role}. Please use the ${user.role} portal.`
      });
    }

    // Check verification status
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        unverified: true,
        message: 'Your email address is not verified yet. Please verify before logging in.',
        data: { email: user.email }
      });
    }

    const token = createToken(user);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      data: {
        user: userModel.toSafeUser(user),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected server error occurred during login.' });
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  return res.json({
    success: true,
    data: { message: 'Logged out successfully.' }
  });
}

async function getMe(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  const user = await userModel.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  return res.json({
    success: true,
    data: { user: userModel.toSafeUser(user) }
  });
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  getMe,
  COOKIE_NAME,
  getJwtSecret
};
