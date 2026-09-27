const { validateEnv } = require('../server/config/env');
validateEnv();

const { createRateLimiter } = require('../server/middleware/rateLimiter');

function createMockReqRes(ip = '127.0.0.1') {
  const req = {
    ip,
    headers: {},
    app: {
      get: (key) => key === 'trust proxy' ? false : undefined
    },
    method: 'POST',
    url: '/api/auth/login'
  };

  const res = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.headersSent = true;
      return this;
    },
    send(data) {
      this.body = data;
      this.headersSent = true;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    getHeader(key) {
      return this.headers[key.toLowerCase()];
    }
  };

  return { req, res };
}

function runLimiter(limiter, req, res) {
  return new Promise(resolve => {
    let nextCalled = false;
    limiter(req, res, () => {
      nextCalled = true;
      resolve(nextCalled);
    });
    setTimeout(() => resolve(nextCalled), 20);
  });
}

async function runRateLimitingTests() {
  console.log('=== STARTING AUTHENTICATION RATE LIMITING TESTS ===\n');
  const results = [];

  function record(name, passed, detail) {
    results.push({ name, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
  }

  // 1. Test Normal Request within Limit
  const testLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 3, message: 'Too many requests' });

  const { req: req1, res: res1 } = createMockReqRes('127.0.0.1');
  const next1Called = await runLimiter(testLimiter, req1, res1);

  const passNormal = next1Called && res1.statusCode === 200;
  record('Normal Request within Rate Limit', passNormal, `Allowed through middleware: ${next1Called}, Status: ${res1.statusCode}`);

  // 2. Test Reaching Threshold (3 requests allowed)
  const { req: req2, res: res2 } = createMockReqRes('127.0.0.1');
  const next2Called = await runLimiter(testLimiter, req2, res2);

  const { req: req3, res: res3 } = createMockReqRes('127.0.0.1');
  const next3Called = await runLimiter(testLimiter, req3, res3);

  const passThreshold = next2Called && next3Called;
  record('Requests Up To Threshold Allowed', passThreshold, `Req 2 allowed: ${next2Called}, Req 3 allowed: ${next3Called}`);

  // 3. Test 4th Request Triggers HTTP 429 Rate Limit
  const { req: req4, res: res4 } = createMockReqRes('127.0.0.1');
  const next4Called = await runLimiter(testLimiter, req4, res4);

  const pass429 = !next4Called && res4.statusCode === 429 && res4.body?.success === false;
  record('Exceeding Threshold Triggers HTTP 429', pass429, `Status: ${res4.statusCode}, Message: "${res4.body?.message}"`);

  // 4. Test Controlled Response (No Account Enumeration Leak)
  const noAccountLeak = res4.body?.message === 'Too many requests' && !res4.body?.message?.includes('user') && !res4.body?.message?.includes('password');
  record('Controlled Response Format (No Account Leakage)', noAccountLeak, `Generic error message returned: "${res4.body?.message}"`);

  // 5. Test Independent IP Tracking (Different IP is not blocked)
  const { req: reqDiff, res: resDiff } = createMockReqRes('192.168.1.99');
  const nextDiffCalled = await runLimiter(testLimiter, reqDiff, resDiff);

  const passDiffIp = nextDiffCalled && resDiff.statusCode === 200;
  record('Independent IP Rate Tracking', passDiffIp, `Different IP allowed through: ${nextDiffCalled}`);

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.filter(r => r.passed).length} / ${results.length}`);

  if (results.every(r => r.passed)) {
    console.log('\nALL AUTHENTICATION RATE LIMITING TESTS PASSED SUCCESSFULLY!');
  }

  process.exit(0);
}

runRateLimitingTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
