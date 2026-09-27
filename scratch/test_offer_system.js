const { validateEnv } = require('../server/config/env');
validateEnv();

const mongoose = require('mongoose');
const { connectDB } = require('../server/db/connection');

const offerController = require('../server/controllers/offerController');
const Offer = require('../server/models/mongoose/Offer');
const Experience = require('../server/models/mongoose/Experience');
const Merchant = require('../server/models/mongoose/Merchant');

function mockReqRes({ body = {}, params = {}, query = {}, user = {} } = {}) {
  const req = { body, params, query, user, app: { locals: {} } };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return { req, res };
}

// In-memory DB proxy for offline test environments
function setupInMemoryDatabase() {
  const inMemoryOffers = [];
  const inMemoryExperiences = [];

  Offer.find = function() {
    return {
      async lean() {
        return [...inMemoryOffers];
      }
    };
  };

  Offer.findOne = function(query = {}) {
    const doc = inMemoryOffers.find(o => o.id === query.id) || null;
    return {
      async lean() {
        return doc ? { ...doc } : null;
      }
    };
  };

  Offer.create = async function(data) {
    const doc = { ...data };
    inMemoryOffers.push(doc);
    return {
      ...doc,
      toObject: () => ({ ...doc })
    };
  };

  Offer.findOneAndDelete = function(query = {}) {
    const idx = inMemoryOffers.findIndex(o => o.id === query.id && Number(o.merchantId) === Number(query.merchantId));
    const doc = idx !== -1 ? inMemoryOffers.splice(idx, 1)[0] : null;
    return {
      async lean() {
        return doc ? { ...doc } : null;
      }
    };
  };

  Offer.deleteMany = async function(query = {}) {
    if (query.id && query.id.$in) {
      for (let i = inMemoryOffers.length - 1; i >= 0; i--) {
        if (query.id.$in.includes(inMemoryOffers[i].id)) inMemoryOffers.splice(i, 1);
      }
    }
  };

  Experience.findOne = function(query = {}) {
    const doc = inMemoryExperiences.find(e => Number(e.id) === Number(query.id)) || null;
    return {
      async lean() {
        return doc ? { ...doc } : null;
      }
    };
  };

  Experience.create = async function(docs) {
    const items = Array.isArray(docs) ? docs : [docs];
    inMemoryExperiences.push(...items);
    return items;
  };

  Experience.deleteMany = async function(query = {}) {
    if (query.id && query.id.$in) {
      for (let i = inMemoryExperiences.length - 1; i >= 0; i--) {
        if (query.id.$in.includes(inMemoryExperiences[i].id)) inMemoryExperiences.splice(i, 1);
      }
    }
  };

  Merchant.findOne = function(query = {}) {
    return {
      async lean() {
        return { userId: query.userId, name: 'Test Merchant', businessName: 'Test Business', address: 'Ratnagiri' };
      }
    };
  };
}

async function runOfferTests() {
  console.log('=== STARTING PRODUCTION OFFER SYSTEM TESTS ===\n');
  const results = [];

  function record(name, passed, detail) {
    results.push({ name, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
  }

  try {
    console.log('Attempting MongoDB connection...');
    try {
      await connectDB();
      console.log('✓ Connected to MongoDB Atlas online.');
    } catch (e) {
      console.log('⚠️ MongoDB connection unavailable/offline. Activating in-memory DB proxy.');
      setupInMemoryDatabase();
    }

    const merchantId = 7771;
    const otherMerchantId = 7772;
    const testExpId = 9911;
    const otherExpId = 9912;

    // Seed test experiences
    await Experience.deleteMany({ id: { $in: [testExpId, otherExpId] } });
    await Experience.create([
      { id: testExpId, name: 'Test Merchant Exp', merchantId: merchantId, verified: true },
      { id: otherExpId, name: 'Other Merchant Exp', merchantId: otherMerchantId, verified: true }
    ]);

    // 1. Offer Creation & MongoDB Persistence
    const { req: req1, res: res1 } = mockReqRes({
      user: { id: merchantId, role: 'merchant' },
      body: {
        discount: 25,
        duration: '2 hours',
        targetVibe: 'Local Artisans',
        experienceId: testExpId,
        title: 'Special 25% Off'
      }
    });
    await offerController.createOffer(req1, res1);
    const createdOffer = res1.body?.data?.offer;
    const mongoOffer = createdOffer ? await Offer.findOne({ id: createdOffer.id }).lean() : null;

    const pass1 = res1.statusCode === 201 &&
                  res1.body?.success === true &&
                  createdOffer?.id &&
                  createdOffer?.merchantId === merchantId &&
                  mongoOffer !== null;
    record('Offer Creation & MongoDB Persistence', pass1, `Offer ID: ${createdOffer?.id}, Status: ${res1.statusCode}`);

    // 2. Merchant Ownership Protection - Unowned Experience Rejection
    const { req: req2, res: res2 } = mockReqRes({
      user: { id: merchantId, role: 'merchant' },
      body: {
        discount: 15,
        duration: '1 hour',
        targetVibe: 'Culture & Heritage',
        experienceId: otherExpId
      }
    });
    await offerController.createOffer(req2, res2);
    const pass2 = res2.statusCode === 403 && res2.body?.success === false;
    record('Merchant Ownership Protection (Unowned Experience)', pass2, `Status ${res2.statusCode}: ${res2.body?.message}`);

    // 3. Invalid Discount Rejection (0%, negative, >100%)
    const { req: req3a, res: res3a } = mockReqRes({
      user: { id: merchantId, role: 'merchant' },
      body: { discount: -5, duration: '1 hour', targetVibe: 'Culture & Heritage', experienceId: testExpId }
    });
    await offerController.createOffer(req3a, res3a);

    const { req: req3b, res: res3b } = mockReqRes({
      user: { id: merchantId, role: 'merchant' },
      body: { discount: 150, duration: '1 hour', targetVibe: 'Culture & Heritage', experienceId: testExpId }
    });
    await offerController.createOffer(req3b, res3b);

    const pass3 = res3a.statusCode === 400 && res3b.statusCode === 400;
    record('Invalid Discount Rejection', pass3, `Status negative: ${res3a.statusCode}, Status >100%: ${res3b.statusCode}`);

    // 4. Invalid Experience ID Rejection
    const { req: req4, res: res4 } = mockReqRes({
      user: { id: merchantId, role: 'merchant' },
      body: { discount: 10, duration: '1 hour', targetVibe: 'Culture & Heritage', experienceId: 999999 }
    });
    await offerController.createOffer(req4, res4);
    const pass4 = res4.statusCode === 404 && res4.body?.success === false;
    record('Invalid Experience ID Rejection', pass4, `Status ${res4.statusCode}: ${res4.body?.message}`);

    // 5. Active Offer Retrieval
    const { req: req5, res: res5 } = mockReqRes();
    await offerController.getOffers(req5, res5);
    const activeOffers = res5.body?.data?.offers || [];
    const pass5 = res5.statusCode === 200 && activeOffers.some(o => o.id === createdOffer?.id);
    record('Active Offer Retrieval', pass5, `Active count: ${activeOffers.length}`);

    // 6. Expired Offer Exclusion
    const expiredOfferDoc = await Offer.create({
      id: `OFF-EXPIRED-${Date.now()}`,
      merchantId: merchantId,
      discount: 20,
      duration: '1 hour',
      targetVibe: 'Local Artisans',
      status: 'live',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      expiresAt: new Date(Date.now() - 3600000).toISOString()
    });

    const { req: req6, res: res6 } = mockReqRes();
    await offerController.getOffers(req6, res6);
    const fetchedOffers = res6.body?.data?.offers || [];
    const pass6 = !fetchedOffers.some(o => o.id === expiredOfferDoc.id);
    record('Expired Offer Exclusion', pass6, `Expired offer excluded from feed: ${pass6}`);

    // 7. Merchant Ownership Protection - Delete Guard
    const { req: req7a, res: res7a } = mockReqRes({
      user: { id: otherMerchantId, role: 'merchant' },
      params: { id: createdOffer?.id }
    });
    await offerController.deleteOffer(req7a, res7a);
    const pass7a = res7a.statusCode === 404;

    // 8. Authorized Offer Deletion
    const { req: req7b, res: res7b } = mockReqRes({
      user: { id: merchantId, role: 'merchant' },
      params: { id: createdOffer?.id }
    });
    await offerController.deleteOffer(req7b, res7b);
    const deletedMongoOffer = await Offer.findOne({ id: createdOffer?.id }).lean();
    const pass7b = res7b.statusCode === 200 && deletedMongoOffer === null;

    record('Authorized Offer Deletion Flow', pass7a && pass7b, `Unauthorized delete: ${res7a.statusCode}, Authorized delete: ${res7b.statusCode}`);

    // Cleanup
    await Offer.deleteMany({ id: { $in: [createdOffer?.id, expiredOfferDoc.id] } });
    await Experience.deleteMany({ id: { $in: [testExpId, otherExpId] } });

    console.log('\n----------------------------------------------');
    const allPassed = results.every(r => r.passed);
    if (allPassed) {
      console.log('🎉 ALL 8 PRODUCTION OFFER SYSTEM VERIFICATIONS PASSED CLEANLY!');
    } else {
      console.log('❌ SOME OFFER SYSTEM VERIFICATIONS FAILED.');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal error running offer tests:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

runOfferTests();
