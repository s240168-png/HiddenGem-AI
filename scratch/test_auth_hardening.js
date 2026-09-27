process.env.DISABLE_PYTHON_SPAWN = 'true';
const { validateEnv } = require('../server/config/env');
validateEnv();

const jwt = require('jsonwebtoken');
const authController = require('../server/controllers/authController');
const authMiddleware = require('../server/middleware/authMiddleware');
const offerController = require('../server/controllers/offerController');
const userModel = require('../server/models/userModel');

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
    cookie(name, val, opts) {
      this.cookies[name] = val;
    },
    clearCookie(name) {
      delete this.cookies[name];
    }
  };
  return res;
}

async function runTests() {
  console.log('=== AUTHENTICATION & AUTHORIZATION HARDENING VERIFICATION ===\n');
  const results = [];

  function record(name, passed, detail) {
    results.push({ name, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
  }

  // 1. Traveler Registration Input Validation Test
  const travelerValidReq = {
    body: { name: 'Test Traveler', email: 'traveler@example.com', password: 'password123', role: 'traveler' }
  };
  const travelerInvalidEmailReq = {
    body: { name: 'Test Traveler', email: 'invalid-email-format', password: 'password123', role: 'traveler' }
  };
  const travelerInvalidRes = mockRes();
  await authController.register(travelerInvalidEmailReq, travelerInvalidRes);
  const travelerRegPassed = travelerInvalidRes.statusCode === 400 && travelerInvalidRes.body?.message === 'Please provide a valid email address.';
  record('Traveler Registration Validation', travelerRegPassed, `Status: ${travelerInvalidRes.statusCode}, Reject Invalid Email: "${travelerInvalidRes.body?.message}"`);

  // 2. Traveler Login Validation & Generic Response Test
  const travelerLoginReq = {
    body: { email: 'nonexistent@example.com', password: 'password123', role: 'traveler' }
  };
  const travelerLoginRes = mockRes();
  // Mock findByEmail to return null for non-existent user
  const origFindByEmail = userModel.findByEmail;
  userModel.findByEmail = async () => null;
  await authController.login(travelerLoginReq, travelerLoginRes);
  userModel.findByEmail = origFindByEmail;
  const travelerLoginPassed = travelerLoginRes.statusCode === 401 && travelerLoginRes.body?.message === 'Invalid email or password.';
  record('Traveler Login (Generic 401 Rejection)', travelerLoginPassed, `Status: ${travelerLoginRes.statusCode}, Message: "${travelerLoginRes.body?.message}"`);

  // 3. Merchant Registration Validation Test
  const merchantInvalidReq = {
    body: { email: 'merchant@example.com', password: 'short', role: 'merchant' } // password < 6 chars
  };
  const merchantInvalidRes = mockRes();
  await authController.register(merchantInvalidReq, merchantInvalidRes);
  const merchantRegPassed = merchantInvalidRes.statusCode === 400 && merchantInvalidRes.body?.message?.includes('Password must be between 6 and 128 characters');
  record('Merchant Registration Validation', merchantRegPassed, `Status: ${merchantInvalidRes.statusCode}, Reject Short Password: "${merchantInvalidRes.body?.message}"`);

  // 4. Merchant Login Logic & Token Issuance Test
  const mockMerchantUser = {
    id: 42,
    email: 'merchant@example.com',
    passwordHash: '$2b$10$JaL00foSD3q.rZ3puCOs.etIrchzjnx5mTz91UNGOLxlli0teQso2',
    role: 'merchant',
    name: 'Ratnagiri Crafts',
    businessName: 'Ratnagiri Crafts Studio',
    emailVerified: true
  };
  userModel.findByEmail = async () => mockMerchantUser;
  userModel.verifyPassword = async () => true;
  userModel.toSafeUser = userModel.toSafeUser;

  const merchantLoginReq = { body: { email: 'merchant@example.com', password: 'password123', role: 'merchant' } };
  const merchantLoginRes = mockRes();
  await authController.login(merchantLoginReq, merchantLoginRes);
  userModel.findByEmail = origFindByEmail;

  const merchantLoginPassed = merchantLoginRes.statusCode === 200 && !!merchantLoginRes.body?.data?.token && merchantLoginRes.body?.data?.user?.role === 'merchant';
  record('Merchant Login & Token Issuance', merchantLoginPassed, `Status: ${merchantLoginRes.statusCode}, Role: ${merchantLoginRes.body?.data?.user?.role}, Token issued: ${!!merchantLoginRes.body?.data?.token}`);

  // 5. Invalid Password Test
  userModel.findByEmail = async () => mockMerchantUser;
  userModel.verifyPassword = async () => false; // Password match failed
  const invalidPasswordReq = { body: { email: 'merchant@example.com', password: 'wrongpassword', role: 'merchant' } };
  const invalidPasswordRes = mockRes();
  await authController.login(invalidPasswordReq, invalidPasswordRes);
  userModel.findByEmail = origFindByEmail;

  const invalidPasswordPassed = invalidPasswordRes.statusCode === 401 && invalidPasswordRes.body?.message === 'Invalid email or password.';
  record('Invalid Password Rejection', invalidPasswordPassed, `Status: ${invalidPasswordRes.statusCode}, Message: "${invalidPasswordRes.body?.message}"`);

  // 6. Invalid JWT Token Test
  const invalidTokenReq = { headers: { authorization: 'Bearer invalid.jwt.token' } };
  const invalidTokenRes = mockRes();
  let invalidTokenNext = false;
  authMiddleware.authenticate(invalidTokenReq, invalidTokenRes, () => { invalidTokenNext = true; });
  const invalidTokenPassed = invalidTokenRes.statusCode === 401 && !invalidTokenNext;
  record('Invalid Token Rejection', invalidTokenPassed, `Status: ${invalidTokenRes.statusCode}, Message: "${invalidTokenRes.body?.message}"`);

  // 7. Missing JWT Token Test
  const missingTokenReq = { headers: {} };
  const missingTokenRes = mockRes();
  let missingTokenNext = false;
  authMiddleware.authenticate(missingTokenReq, missingTokenRes, () => { missingTokenNext = true; });
  const missingTokenPassed = missingTokenRes.statusCode === 401 && !missingTokenNext;
  record('Missing Token Rejection', missingTokenPassed, `Status: ${missingTokenRes.statusCode}, Message: "${missingTokenRes.body?.message}"`);

  // 8. Traveler Accessing Merchant Endpoint Test
  const travelerReq = { user: { id: 10, role: 'traveler' } };
  const travelerAccessRes = mockRes();
  let travelerNextCalled = false;
  authMiddleware.requireRole('merchant')(travelerReq, travelerAccessRes, () => { travelerNextCalled = true; });
  const travelerAccessPassed = travelerAccessRes.statusCode === 403 && !travelerNextCalled;
  record('Traveler Accessing Merchant Endpoint Blocked', travelerAccessPassed, `Status: ${travelerAccessRes.statusCode}, Message: "${travelerAccessRes.body?.message}"`);

  // 9. Merchant Accessing Another Merchant's Resource Test
  const Experience = require('../server/models/mongoose/Experience');
  const origFindOne = Experience.findOne;
  // Mock experience owned by merchant ID 100
  Experience.findOne = () => ({
    lean: async () => ({ id: 5, merchantId: '100', name: 'Other Merchant Experience' })
  });
  const rogueMerchantReq = {
    user: { id: 200, role: 'merchant' }, // Merchant ID 200 trying to create offer for Experience owned by Merchant ID 100
    body: { discount: 25, duration: '2 hours', targetVibe: 'Solo & Quiet', experienceId: 5 }
  };
  const rogueMerchantRes = mockRes();
  await offerController.createOffer(rogueMerchantReq, rogueMerchantRes);
  Experience.findOne = origFindOne;

  const merchantResourcePassed = rogueMerchantRes.statusCode === 403 && rogueMerchantRes.body?.message === 'You do not own this experience.';
  record('Merchant Accessing Another Merchant Resource Blocked', merchantResourcePassed, `Status: ${rogueMerchantRes.statusCode}, Message: "${rogueMerchantRes.body?.message}"`);

  // 10. API Authentication Hardening Tests for Protected Endpoints
  const recommendationRoutes = require('../server/routes/recommendationRoutes');
  const itineraryRoutes = require('../server/routes/itineraryRoutes');
  const weatherRoutes = require('../server/routes/weatherRoutes');

  function testRouteAuth(router, method, path, name) {
    const secret = process.env.JWT_SECRET || 'fallback_secret';

    // 1. Unauthenticated -> 401
    const unauthReq = { method, url: path, headers: {}, cookies: {} };
    const unauthRes = mockRes();
    router.handle(unauthReq, unauthRes, () => {});
    const passUnauth = unauthRes.statusCode === 401;

    // 2. Non-traveler (merchant) -> 403
    const merchantToken = jwt.sign({ id: 99, role: 'merchant' }, secret);
    const merchantReq = { method, url: path, headers: { authorization: `Bearer ${merchantToken}` }, cookies: {} };
    const merchantRes = mockRes();
    router.handle(merchantReq, merchantRes, () => {});
    const passMerchant = merchantRes.statusCode === 403;

    // 3. Traveler -> allowed (user set with role 'traveler')
    const travelerToken = jwt.sign({ id: 10, role: 'traveler' }, secret);
    const travelerReq = { method, url: path, headers: { authorization: `Bearer ${travelerToken}` }, cookies: {}, body: {} };
    const travelerRes = mockRes();
    router.handle(travelerReq, travelerRes, () => {});
    const passTraveler = travelerReq.user && travelerReq.user.role === 'traveler';

    const passed = passUnauth && passMerchant && passTraveler;
    record(
      `API Protection: ${method} ${name}`,
      passed,
      `Unauth: ${unauthRes.statusCode} (exp 401), Merchant: ${merchantRes.statusCode} (exp 403), Traveler: ${travelerReq.user?.role}`
    );
  }

  testRouteAuth(recommendationRoutes, 'POST', '/', '/api/recommendations');
  testRouteAuth(itineraryRoutes, 'POST', '/generate', '/api/itinerary/generate');
  testRouteAuth(itineraryRoutes, 'POST', '/generate', '/api/itineraries/generate');
  testRouteAuth(weatherRoutes, 'GET', '/', '/api/weather');
  testRouteAuth(weatherRoutes, 'POST', '/simulate', '/api/weather/simulate');
  testRouteAuth(weatherRoutes, 'POST', '/restore', '/api/weather/restore');

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.filter(r => r.passed).length} / ${results.length}`);
  if (results.every(r => r.passed)) {
    console.log(`\nALL ${results.length} AUTHENTICATION & AUTHORIZATION HARDENING TESTS PASSED SUCCESSFULLY!`);
  }

  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
