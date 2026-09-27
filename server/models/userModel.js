const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('./mongoose/User');
const Merchant = require('./mongoose/Merchant');

function toSafeUser(user) {
  if (!user) return null;
  const values = typeof user.toObject === 'function' ? user.toObject() : user;
  const safe = { ...values };
  delete safe._id;
  delete safe.__v;
  delete safe.passwordHash;
  delete safe.verificationToken;
  delete safe.verificationTokenHash;
  delete safe.verificationTokenExpires;
  delete safe.lastVerificationSentAt;
  return safe;
}

function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

function generateVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

function findByEmail(email) {
  if (!email) return Promise.resolve(null);
  const normalized = email.trim().toLowerCase();
  return User.findOne({ email: normalized });
}

function findById(id) {
  if (!id) return null;
  return User.findOne({ id: Number(id) });
}

function findByVerificationToken(token) {
  if (!token) return null;
  const trimmed = token.trim();
  const tokenHash = hashToken(trimmed);
  return User.findOne({
    $or: [{ verificationTokenHash: tokenHash }, { verificationToken: trimmed }]
  });
}

async function createUser({ name, email, password, role, businessName = '', phone, address, latitude, longitude }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findByEmail(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  if (!['traveler', 'merchant'].includes(role)) {
    throw new Error('Role must be either "traveler" or "merchant".');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  const { rawToken, tokenHash } = generateVerificationToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  const now = new Date().toISOString();

  const latestUser = await User.findOne().sort({ id: -1 }).select({ id: 1 }).lean();
  const newId = (latestUser?.id || 0) + 1;

  const newUser = await User.create({
    id: newId,
    name: (name || (role === 'merchant' ? businessName : 'Explorer')).trim(),
    businessName: role === 'merchant' ? (businessName || name || '').trim() : undefined,
    email: normalizedEmail,
    passwordHash,
    role,
    emailVerified: false,
    verificationTokenHash: tokenHash,
    verificationTokenExpires: expires,
    lastVerificationSentAt: now,
    createdAt: now,
    updatedAt: now
  });

  if (role === 'merchant') {
    await Merchant.create({ 
      userId: newId, 
      name: newUser.name, 
      businessName: newUser.businessName, 
      email: newUser.email, 
      phone, 
      address, 
      latitude: Number(latitude) || null, 
      longitude: Number(longitude) || null,
      createdAt: now 
    });
  }

  return {
    user: toSafeUser(newUser),
    verificationToken: rawToken
  };
}

async function verifyPassword(user, password) {
  if (!user || !user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

async function verifyUserEmail(token, email) {
  if (!token || !String(token).trim()) {
    throw new Error('Verification token is required.');
  }

  const trimmedToken = String(token).trim();
  const tokenHash = hashToken(trimmedToken);

  let user = await User.findOne({
    $or: [{ verificationTokenHash: tokenHash }, { verificationToken: trimmedToken }]
  });

  if (!user && email) {
    const userByEmail = await findByEmail(email);
    if (userByEmail && userByEmail.emailVerified) {
      const err = new Error('This account is already verified. Please log in.');
      err.code = 'ALREADY_VERIFIED';
      throw err;
    }
  }

  if (!user) {
    throw new Error('Invalid or expired verification token.');
  }

  if (user.emailVerified) {
    const err = new Error('This account is already verified. Please log in.');
    err.code = 'ALREADY_VERIFIED';
    throw err;
  }

  if (user.verificationTokenExpires && new Date(user.verificationTokenExpires) < new Date()) {
    const err = new Error('Verification token has expired. Please request a new one.');
    err.code = 'EXPIRED_TOKEN';
    throw err;
  }

  user.emailVerified = true;
  user.verificationToken = null;
  user.verificationTokenHash = null;
  user.verificationTokenExpires = null;
  user.updatedAt = new Date().toISOString();
  await user.save();

  return toSafeUser(user);
}

async function createResendVerificationToken(email) {
  if (!email || !email.trim()) {
    throw new Error('Email address is required.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await findByEmail(normalizedEmail);

  if (!user) {
    return { user: null, resendAllowed: true };
  }

  if (user.emailVerified) {
    return { user: toSafeUser(user), alreadyVerified: true };
  }

  // Cooldown rate-limit: 60 seconds
  if (user.lastVerificationSentAt) {
    const elapsed = Date.now() - new Date(user.lastVerificationSentAt).getTime();
    if (elapsed < 60 * 1000) {
      const remainingSecs = Math.ceil((60 * 1000 - elapsed) / 1000);
      const err = new Error(`Please wait ${remainingSecs} seconds before requesting another verification email.`);
      err.code = 'TOO_MANY_REQUESTS';
      err.remainingSecs = remainingSecs;
      throw err;
    }
  }

  const { rawToken, tokenHash } = generateVerificationToken();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  user.verificationTokenHash = tokenHash;
  user.verificationTokenExpires = expires;
  user.lastVerificationSentAt = now;
  user.updatedAt = now;
  await user.save();

  return {
    user: toSafeUser(user),
    rawToken,
    resendAllowed: true
  };
}

module.exports = {
  findByEmail,
  findById,
  findByVerificationToken,
  createUser,
  verifyPassword,
  verifyUserEmail,
  createResendVerificationToken,
  toSafeUser,
  hashToken
};
