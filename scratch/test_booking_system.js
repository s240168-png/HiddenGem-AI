const { validateEnv } = require('../server/config/env');
validateEnv();

const mongoose = require('mongoose');
const { connectDB } = require('../server/db/connection');

const bookingController = require('../server/controllers/bookingController');
const itineraryController = require('../server/controllers/itineraryController');
const experienceController = require('../server/controllers/experienceController');

const Booking = require('../server/models/mongoose/Booking');
const Experience = require('../server/models/mongoose/Experience');

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

// In-memory fallbacks for offline testing
function setupInMemoryDatabase() {
  const inMemoryBookings = [];
  const inMemoryExperiences = [];

  Booking.find = function(query = {}) {
    return {
      sort(sortObj) {
        return {
          async lean() {
            let res = [...inMemoryBookings];
            if (query.userId != null) res = res.filter(b => Number(b.userId) === Number(query.userId));
            if (query.$or) {
              res = res.filter(b => query.$or.some(clause => {
                if (clause.merchantId != null && (Number(b.merchantId) === Number(clause.merchantId) || (b.merchantIds && b.merchantIds.includes(Number(clause.merchantId))))) return true;
                return false;
              }));
            }
            return res;
          }
        };
      }
    };
  };

  Booking.findOne = function(query = {}) {
    function findDoc() {
      return inMemoryBookings.find(b => {
        if (query.bookingId && b.bookingId === query.bookingId) return true;
        if (query.userId != null && Number(b.userId) === Number(query.userId) && query.date === b.date && query.time === b.time && b.status === 'confirmed') {
          return true;
        }
        if (query.$or) {
          return query.$or.some(clause => clause.bookingId && clause.bookingId === b.bookingId);
        }
        return false;
      }) || null;
    }

    const doc = findDoc();
    const queryObj = {
      async lean() {
        return doc ? { ...doc } : null;
      },
      then(resolve, reject) {
        if (!doc) return Promise.resolve(null).then(resolve);
        const wrappedDoc = {
          ...doc,
          toObject() {
            return { ...this };
          },
          save: async function() {
            const idx = inMemoryBookings.findIndex(item => item.bookingId === this.bookingId);
            if (idx !== -1) {
              inMemoryBookings[idx].status = this.status;
              inMemoryBookings[idx].updatedAt = this.updatedAt;
            }
            return this;
          }
        };
        return Promise.resolve(wrappedDoc).then(resolve, reject);
      }
    };
    return queryObj;
  };

  Booking.create = async function(data) {
    const doc = { ...data };
    inMemoryBookings.push(doc);
    return {
      ...doc,
      toObject: () => ({ ...doc })
    };
  };

  Booking.deleteMany = async function(query = {}) {
    if (query.bookingId && query.bookingId.$in) {
      for (let i = inMemoryBookings.length - 1; i >= 0; i--) {
        if (query.bookingId.$in.includes(inMemoryBookings[i].bookingId)) inMemoryBookings.splice(i, 1);
      }
    }
  };

  Experience.find = function(query = {}) {
    return {
      async lean() {
        if (query.id && query.id.$in) {
          return inMemoryExperiences.filter(e => query.id.$in.includes(Number(e.id)));
        }
        return [...inMemoryExperiences];
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
}

async function runBookingTests() {
  console.log('=== STARTING PRODUCTION BOOKING SYSTEM TESTS ===\n');
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

    const travelerId = 8881;
    const otherTravelerId = 8882;
    const merchantId = 7771;
    const otherMerchantId = 7772;

    // Seed test experiences
    await Experience.deleteMany({ id: { $in: [9901, 9902] } });
    await Experience.create([
      {
        id: 9901,
        name: 'Test Heritage Walk',
        merchantId: merchantId,
        duration: '120 mins',
        travel: '15 mins',
        cost: 250,
        verified: true,
        location: 'Ratnagiri'
      },
      {
        id: 9902,
        name: 'Test Coastal Kayaking',
        merchantId: merchantId,
        duration: '60 mins',
        travel: '15 mins',
        cost: 500,
        verified: true,
        location: 'Ratnagiri'
      }
    ]);

    // 1. Validation checks
    const { req: req1, res: res1 } = mockReqRes({
      user: { id: travelerId, role: 'traveler' },
      body: { experiences: [999999], numberOfPeople: 2, date: '2026-10-01', time: '10:00' }
    });
    await bookingController.createBooking(req1, res1);
    const pass1 = res1.statusCode === 400 && res1.body.success === false;
    record('Validation Check - Invalid Experience ID', pass1, `Status ${res1.statusCode}: ${res1.body?.message}`);

    const { req: req2, res: res2 } = mockReqRes({
      user: { id: travelerId, role: 'traveler' },
      body: { experiences: [9901], numberOfPeople: 100, date: '2026-10-01', time: '10:00' }
    });
    await bookingController.createBooking(req2, res2);
    const pass2 = res2.statusCode === 400 && res2.body.success === false;
    record('Validation Check - Invalid Group Size (>50)', pass2, `Status ${res2.statusCode}: ${res2.body?.message}`);

    // 2. Successful Booking Creation & MongoDB Persistence
    const { req: req3, res: res3 } = mockReqRes({
      user: { id: travelerId, role: 'traveler' },
      body: { experiences: [9901], numberOfPeople: 2, date: '2026-10-01', time: '10:00', totalTime: 2.25 }
    });
    await bookingController.createBooking(req3, res3);
    const booking1 = res3.body?.data?.booking;
    const mongoBooking1 = booking1 ? await Booking.findOne({ bookingId: booking1.bookingId }).lean() : null;
    const pass3 = res3.statusCode === 201 &&
                  res3.body?.success === true &&
                  booking1?.status === 'confirmed' &&
                  booking1?.createdAt &&
                  booking1?.updatedAt &&
                  mongoBooking1 !== null;
    record('Successful Booking Creation & Persistence', pass3, `Booking ID: ${booking1?.bookingId}, Status: ${booking1?.status}`);

    // 3. Duplicate Active Booking Prevention
    const { req: req4, res: res4 } = mockReqRes({
      user: { id: travelerId, role: 'traveler' },
      body: { experiences: [9901], numberOfPeople: 2, date: '2026-10-01', time: '10:00', totalTime: 2.25 }
    });
    await bookingController.createBooking(req4, res4);
    const pass4 = res4.statusCode === 409 && res4.body?.success === false;
    record('Duplicate Active Booking Prevention (409 Conflict)', pass4, `Status ${res4.statusCode}: ${res4.body?.message}`);

    // 4. Traveler View History (My Bookings Scoped)
    const { req: req5, res: res5 } = mockReqRes({ user: { id: travelerId, role: 'traveler' } });
    await bookingController.getMyBookings(req5, res5);
    const myBookings = res5.body?.data?.bookings || [];
    const pass5 = res5.statusCode === 200 && myBookings.some(b => b.bookingId === booking1.bookingId);
    record('Traveler View History Scoped to Traveler', pass5, `Count: ${myBookings.length}`);

    // 5. GET Single Booking Authorization Guard
    const { req: req6a, res: res6a } = mockReqRes({
      user: { id: travelerId, role: 'traveler' },
      params: { bookingId: booking1.bookingId }
    });
    await bookingController.getBookingById(req6a, res6a);
    const pass6a = res6a.statusCode === 200 && res6a.body?.data?.booking?.bookingId === booking1.bookingId;

    const { req: req6b, res: res6b } = mockReqRes({
      user: { id: otherTravelerId, role: 'traveler' },
      params: { bookingId: booking1.bookingId }
    });
    await bookingController.getBookingById(req6b, res6b);
    const pass6b = res6b.statusCode === 403 && res6b.body?.success === false;
    record('Single Booking Authorization Guard', pass6a && pass6b, `Owner status: ${res6a.statusCode}, Non-owner status: ${res6b.statusCode}`);

    // 6. Merchant Booking View & Access Guard
    const { req: req7a, res: res7a } = mockReqRes({ user: { id: merchantId, role: 'merchant' } });
    await bookingController.getMerchantBookings(req7a, res7a);
    const merchantBookings = res7a.body?.data?.bookings || [];
    const pass7a = res7a.statusCode === 200 && merchantBookings.some(b => b.bookingId === booking1.bookingId);

    const { req: req7b, res: res7b } = mockReqRes({
      user: { id: otherMerchantId, role: 'merchant' },
      params: { bookingId: booking1.bookingId }
    });
    await bookingController.getBookingById(req7b, res7b);
    const pass7b = res7b.statusCode === 403 && res7b.body?.success === false;
    record('Merchant Booking View & Authorization Guard', pass7a && pass7b, `Owner Merchant count: ${merchantBookings.length}, Unrelated Merchant status: ${res7b.statusCode}`);

    // 7. Itinerary Booking Persistence (Replacing Demo Mock)
    const { req: req8, res: res8 } = mockReqRes({
      user: { id: travelerId, role: 'traveler' },
      body: { experienceIds: [9902], numberOfPeople: 1, date: '2026-10-05', time: '14:00', totalTime: 1.25 }
    });
    await itineraryController.bookItinerary(req8, res8);
    const itinBooking = res8.body?.data?.booking;
    const mongoItinBooking = itinBooking ? await Booking.findOne({ bookingId: itinBooking.bookingId }).lean() : null;
    const pass8 = res8.statusCode === 201 &&
                  itinBooking?.status === 'confirmed' &&
                  itinBooking?.status !== 'reserved-for-review' &&
                  mongoItinBooking !== null;
    record('Itinerary Booking Persistence (No Demo String)', pass8, `Booking ID: ${itinBooking?.bookingId}, Status: ${itinBooking?.status}`);

    // 8. Server-Side Authorization-Protected Booking Cancellation
    const { req: req9a, res: res9a } = mockReqRes({
      user: { id: otherTravelerId, role: 'traveler' },
      params: { bookingId: booking1.bookingId }
    });
    await bookingController.cancelBooking(req9a, res9a);
    const pass9a = res9a.statusCode === 403;

    const { req: req9b, res: res9b } = mockReqRes({
      user: { id: travelerId, role: 'traveler' },
      params: { bookingId: booking1.bookingId }
    });
    await bookingController.cancelBooking(req9b, res9b);
    const cancelledMongoBooking = await Booking.findOne({ bookingId: booking1.bookingId }).lean();
    const pass9b = res9b.statusCode === 200 &&
                  res9b.body?.data?.booking?.status === 'cancelled' &&
                  cancelledMongoBooking?.status === 'cancelled';

    const { req: req9c, res: res9c } = mockReqRes({
      user: { id: travelerId, role: 'traveler' },
      params: { bookingId: booking1.bookingId }
    });
    await bookingController.cancelBooking(req9c, res9c);
    const pass9c = res9c.statusCode === 400;

    record('Server-side Protected Cancellation Flow', pass9a && pass9b && pass9c, `Unauthorized: ${res9a.statusCode}, Cancel: ${res9b.statusCode}, Repeat Cancel: ${res9c.statusCode}`);

    // Cleanup test data
    await Booking.deleteMany({ bookingId: { $in: [booking1?.bookingId, itinBooking?.bookingId].filter(Boolean) } });
    await Experience.deleteMany({ id: { $in: [9901, 9902] } });

    console.log('\n----------------------------------------------');
    const allPassed = results.every(r => r.passed);
    if (allPassed) {
      console.log('🎉 ALL 8 PRODUCTION BOOKING SYSTEM VERIFICATIONS PASSED CLEANLY!');
    } else {
      console.log('❌ SOME BOOKING SYSTEM VERIFICATIONS FAILED.');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal error running booking tests:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

runBookingTests();
