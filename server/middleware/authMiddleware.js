const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET environment variable is missing.');
  }
  return secret;
}

const COOKIE_NAME = 'hgai_token';

function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

function verifyTokenPayload(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    return null;
  }
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  const decoded = verifyTokenPayload(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
  }

  req.user = decoded;
  next();
}

function optionalAuthenticate(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const decoded = verifyTokenPayload(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: This resource requires one of the following roles: [${roles.join(', ')}]. You are logged in as "${req.user.role}".`
      });
    }
    next();
  };
}

function requirePageAuth(requiredRole) {
  return (req, res, next) => {
    const token = extractToken(req);
    const decoded = verifyTokenPayload(token);

    if (!decoded) {
      return res.redirect(`/login.html?redirect=${encodeURIComponent(req.originalUrl)}&role=${requiredRole}`);
    }

    if (requiredRole && decoded.role !== requiredRole) {
      // Role mismatch: redirect user to their appropriate destination
      if (decoded.role === 'traveler') {
        return res.redirect('/customer.html');
      } else if (decoded.role === 'merchant') {
        return res.redirect('/merchant.html');
      }
      return res.redirect('/login.html');
    }

    req.user = decoded;
    next();
  };
}

module.exports = {
  extractToken,
  verifyTokenPayload,
  authenticate,
  optionalAuthenticate,
  requireRole,
  requirePageAuth,
  COOKIE_NAME,
  getJwtSecret
};
