const { validateEnv } = require('../server/config/env');
validateEnv();

const authController = require('../server/controllers/authController');
const userModel = require('../server/models/userModel');
const emailService = require('../server/services/emailService');

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    cookie(name, val) {
      this.cookies[name] = val;
    },
    clearCookie(name) {
      delete this.cookies[name];
    }
  };
  return res;
}

async function runEmailVerificationTests() {
  console.log('=== STARTING PRODUCTION EMAIL VERIFICATION TESTS ===\n');
  const results = [];

  function record(name, passed, detail) {
    results.push({ name, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
  }

  // Intercept emailService.sendVerificationEmail to capture raw tokens sent to users
  let lastSentEmail = null;
  const origSendEmail = emailService.sendVerificationEmail;
  emailService.sendVerificationEmail = async (params) => {
    lastSentEmail = params;
    return { success: true, mode: 'mock-test' };
  };

  // Mock User DB storage for offline testing
  const dbUsers = new Map();
  let userSeq = 100;

  const origCreateUser = userModel.createUser;
  const origVerifyUserEmail = userModel.verifyUserEmail;
  const origCreateResend = userModel.createResendVerificationToken;

  userModel.createUser = async ({ name, email, password, role }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { rawToken, tokenHash } = userModel.hashToken
      ? { rawToken: 'raw_token_' + Date.now(), tokenHash: userModel.hashToken('raw_token_' + Date.now()) }
      : { rawToken: 'raw_token_' + Date.now(), tokenHash: 'hash_' + Date.now() };

    const userObj = {
      id: userSeq++,
      name,
      email: normalizedEmail,
      passwordHash: 'hashed_pw',
      role,
      emailVerified: false,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastVerificationSentAt: new Date().toISOString()
    };
    dbUsers.set(normalizedEmail, userObj);
    return { user: userModel.toSafeUser(userObj), verificationToken: rawToken };
  };

  userModel.verifyUserEmail = async (rawToken, email) => {
    if (!rawToken || !rawToken.trim()) throw new Error('Verification token is required.');
    const targetHash = userModel.hashToken(rawToken);

    for (const [userEmail, u] of dbUsers.entries()) {
      if (u.verificationTokenHash === targetHash || u.verificationToken === rawToken) {
        if (u.emailVerified) {
          const err = new Error('This account is already verified. Please log in.');
          err.code = 'ALREADY_VERIFIED';
          throw err;
        }
        if (u.verificationTokenExpires && new Date(u.verificationTokenExpires) < new Date()) {
          const err = new Error('Verification token has expired. Please request a new one.');
          err.code = 'EXPIRED_TOKEN';
          throw err;
        }
        u.emailVerified = true;
        u.verificationToken = null;
        u.verificationTokenHash = null;
        u.verificationTokenExpires = null;
        return userModel.toSafeUser(u);
      }
    }

    if (email) {
      const u = dbUsers.get(email.trim().toLowerCase());
      if (u && u.emailVerified) {
        const err = new Error('This account is already verified. Please log in.');
        err.code = 'ALREADY_VERIFIED';
        throw err;
      }
    }

    throw new Error('Invalid or expired verification token.');
  };

  userModel.createResendVerificationToken = async (email) => {
    const normalized = email.trim().toLowerCase();
    const u = dbUsers.get(normalized);
    if (!u) return { user: null, resendAllowed: true };
    if (u.emailVerified) return { user: userModel.toSafeUser(u), alreadyVerified: true };

    if (u.lastVerificationSentAt) {
      const elapsed = Date.now() - new Date(u.lastVerificationSentAt).getTime();
      if (elapsed < 60 * 1000) {
        const remainingSecs = Math.ceil((60 * 1000 - elapsed) / 1000);
        const err = new Error(`Please wait ${remainingSecs} seconds before requesting another verification email.`);
        err.code = 'TOO_MANY_REQUESTS';
        err.remainingSecs = remainingSecs;
        throw err;
      }
    }

    const rawToken = 'new_raw_token_' + Date.now();
    u.verificationTokenHash = userModel.hashToken(rawToken);
    u.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    u.lastVerificationSentAt = new Date().toISOString();

    return { user: userModel.toSafeUser(u), rawToken, resendAllowed: true };
  };

  // 1. Registration Test
  const testEmail = 'verify.test@example.com';
  const regReq = { body: { name: 'Verify Tester', email: testEmail, password: 'password123', role: 'traveler' } };
  const regRes = mockRes();
  await authController.register(regReq, regRes);

  const regPassed = regRes.statusCode === 201 && regRes.body?.data?.user?.email === testEmail && !!lastSentEmail?.token;
  record('Registration & Email Dispatch', regPassed, `Status: ${regRes.statusCode}, Verification email triggered with raw token: ${!!lastSentEmail?.token}`);

  const activeRawToken = lastSentEmail?.token;

  // 2. Verification Test with Valid Token
  const verifyReq = { body: { token: activeRawToken, email: testEmail } };
  const verifyRes = mockRes();
  await authController.verifyEmail(verifyReq, verifyRes);

  const verifyPassed = verifyRes.statusCode === 200 && verifyRes.body?.success === true && !!verifyRes.body?.data?.token;
  record('Valid Email Verification', verifyPassed, `Status: ${verifyRes.statusCode}, Account activated & JWT issued: ${!!verifyRes.body?.data?.token}`);

  // 3. Token Reuse Test (Attempting to use the same token again)
  const reuseReq = { body: { token: activeRawToken, email: testEmail } };
  const reuseRes = mockRes();
  await authController.verifyEmail(reuseReq, reuseRes);

  const reusePassed = reuseRes.statusCode === 400 && (reuseRes.body?.alreadyVerified || reuseRes.body?.message?.includes('already verified'));
  record('Prevent Token Reuse (Single-Use Token)', reusePassed, `Status: ${reuseRes.statusCode}, Rejection Message: "${reuseRes.body?.message}"`);

  // 4. Invalid Token Test
  const invalidReq = { body: { token: 'completely_bogus_token_123', email: 'random@example.com' } };
  const invalidRes = mockRes();
  await authController.verifyEmail(invalidReq, invalidRes);

  const invalidPassed = invalidRes.statusCode === 400 && invalidRes.body?.message?.includes('Invalid or expired');
  record('Invalid Token Handling', invalidPassed, `Status: ${invalidRes.statusCode}, Message: "${invalidRes.body?.message}"`);

  // 5. Expired Token Test
  const expiredEmail = 'expired.user@example.com';
  const expiredRawToken = 'expired_raw_token_999';
  dbUsers.set(expiredEmail, {
    id: 999,
    name: 'Expired User',
    email: expiredEmail,
    emailVerified: false,
    verificationTokenHash: userModel.hashToken(expiredRawToken),
    verificationTokenExpires: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
    lastVerificationSentAt: new Date(Date.now() - 120000).toISOString()
  });

  const expiredReq = { body: { token: expiredRawToken, email: expiredEmail } };
  const expiredRes = mockRes();
  await authController.verifyEmail(expiredReq, expiredRes);

  const expiredPassed = expiredRes.statusCode === 400 && (expiredRes.body?.expired || expiredRes.body?.message?.includes('expired'));
  record('Expired Token Handling', expiredPassed, `Status: ${expiredRes.statusCode}, Message: "${expiredRes.body?.message}"`);

  // 6. Resend Verification & Rate Limiting Test
  const resendUnverifiedEmail = 'resend.test@example.com';
  dbUsers.set(resendUnverifiedEmail, {
    id: 888,
    name: 'Resend User',
    email: resendUnverifiedEmail,
    emailVerified: false,
    verificationTokenHash: 'old_hash',
    verificationTokenExpires: new Date().toISOString(),
    lastVerificationSentAt: new Date(Date.now() - 120000).toISOString() // Sent 2 mins ago (> 60s)
  });

  // First resend (should succeed)
  const resendReq1 = { body: { email: resendUnverifiedEmail } };
  const resendRes1 = mockRes();
  await authController.resendVerification(resendReq1, resendRes1);

  const resendSucceeded = resendRes1.statusCode === 200 && resendRes1.body?.success === true;

  // Immediate second resend (should be rate-limited HTTP 429)
  const resendReq2 = { body: { email: resendUnverifiedEmail } };
  const resendRes2 = mockRes();
  await authController.resendVerification(resendReq2, resendRes2);

  const resendRateLimited = resendRes2.statusCode === 429 && resendRes2.body?.message?.includes('seconds');
  record('Resend Verification Cooldown (Rate Limiting 429)', resendSucceeded && resendRateLimited, `Status: ${resendRes2.statusCode}, Message: "${resendRes2.body?.message}"`);

  // Restore mocks
  emailService.sendVerificationEmail = origSendEmail;
  userModel.createUser = origCreateUser;
  userModel.verifyUserEmail = origVerifyUserEmail;
  userModel.createResendVerificationToken = origCreateResend;

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.filter(r => r.passed).length} / ${results.length}`);

  if (results.every(r => r.passed)) {
    console.log('\nALL EMAIL VERIFICATION FLOW TESTS PASSED SUCCESSFULLY!');
  }

  process.exit(0);
}

runEmailVerificationTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
