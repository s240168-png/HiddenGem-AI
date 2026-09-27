const { getPublicExperiences } = require('./experienceController');
const Booking = require('../models/mongoose/Booking');
const Experience = require('../models/mongoose/Experience');
const crypto = require('crypto');

async function readBookings() {
  const bookings = await Booking.find().lean();
  return bookings.map(({ _id, ...booking }) => booking);
}

async function createBooking(req, res) {
  try {
    const requestedIds = Array.isArray(req.body.experiences)
      ? req.body.experiences
      : Array.isArray(req.body.experienceIds)
        ? req.body.experienceIds
        : req.body.experienceId == null ? [] : [req.body.experienceId];
    const experienceIds = requestedIds.map(Number);
    const numberOfPeople = Number(req.body.numberOfPeople ?? 1);
    const catalog = await getPublicExperiences();

    if (
      !experienceIds.length ||
      experienceIds.length > 3 ||
      new Set(experienceIds).size !== experienceIds.length ||
      experienceIds.some(id => !Number.isInteger(id)) ||
      !experienceIds.every(id => catalog.some(experience => experience.id === id))
    ) {
      return res.status(400).json({ success: false, message: 'Provide up to three valid, verified experiences.' });
    }

    if (!Number.isInteger(numberOfPeople) || numberOfPeople < 1 || numberOfPeople > 50) {
      return res.status(400).json({ success: false, message: 'Number of people must be between 1 and 50.' });
    }

    const selectedExperiences = experienceIds.map(id => catalog.find(item => item.id === id));
    const expectedMinutes = selectedExperiences.reduce((total, experience) => {
      return total + Number.parseInt(experience.duration, 10) + Number.parseInt(experience.travel, 10);
    }, 0);
    const totalTime = req.body.totalTime == null ? Number((expectedMinutes / 60).toFixed(2)) : Number(req.body.totalTime);
    if (!Number.isFinite(totalTime) || totalTime <= 0 || Math.abs(totalTime - expectedMinutes / 60) > 0.01) {
      return res.status(400).json({ success: false, message: 'The itinerary total time is invalid.' });
    }

    const bookingDate = req.body.date || new Date().toISOString().slice(0, 10);
    const dateValue = new Date(bookingDate);
    if (!Number.isFinite(dateValue.getTime())) {
      return res.status(400).json({ success: false, message: 'Provide a valid booking date.' });
    }
    const formattedDate = dateValue.toISOString().slice(0, 10);
    const bookingTime = typeof req.body.time === 'string' && req.body.time.trim() ? req.body.time.trim() : '09:00';
    const userId = Number(req.user.id);

    // Duplicate check: active booking for same user, date, time, and overlapping experiences
    const existingActiveBooking = await Booking.findOne({
      userId,
      date: formattedDate,
      time: bookingTime,
      status: 'confirmed',
      $or: [
        { experienceId: { $in: experienceIds } },
        { experienceIds: { $in: experienceIds } },
        { experiences: { $in: experienceIds } }
      ]
    }).lean();

    if (existingActiveBooking) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active booking for this time and experience.'
      });
    }

    const merchantIds = [...new Set(selectedExperiences.map(item => Number(item.merchantId)).filter(Number.isFinite))];
    const nowIso = new Date().toISOString();

    const booking = await Booking.create({
      bookingId: `HG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId,
      experiences: experienceIds,
      experienceIds,
      experienceNames: selectedExperiences.map(item => item.name || item.title || 'Experience'),
      experienceId: experienceIds.length === 1 ? experienceIds[0] : undefined,
      experienceName: experienceIds.length === 1 ? selectedExperiences[0].name || selectedExperiences[0].title : undefined,
      merchantId: merchantIds.length === 1 ? merchantIds[0] : undefined,
      merchantIds,
      date: formattedDate,
      time: bookingTime,
      numberOfPeople,
      totalCost: selectedExperiences.reduce((total, item) => total + (Number(item.cost) || 0), 0) * numberOfPeople,
      status: 'confirmed',
      totalTime,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const savedBooking = booking.toObject();
    delete savedBooking._id;
    delete savedBooking.__v;

    return res.status(201).json({
      success: true,
      data: {
        booking: savedBooking,
        bookingId: savedBooking.bookingId,
        message: 'Booking saved successfully.'
      }
    });
  } catch (error) {
    console.error('createBooking error:', error);
    return res.status(500).json({ success: false, message: 'Could not create booking.' });
  }
}

async function getMyBookings(req, res) {
  try {
    const bookings = await Booking.find({ userId: Number(req.user.id) }).sort({ createdAt: -1 }).lean();
    const experienceIds = [
      ...new Set(
        bookings.flatMap(booking =>
          booking.experienceIds || booking.experiences || (booking.experienceId == null ? [] : [booking.experienceId])
        ).map(Number)
      )
    ];
    const experiences = await Experience.find({ id: { $in: experienceIds } }).lean();
    const experiencesById = new Map(experiences.map(experience => [Number(experience.id), experience]));
    const results = bookings.map(booking => {
      const ids = booking.experienceIds || booking.experiences || (booking.experienceId == null ? [] : [booking.experienceId]);
      return {
        ...booking,
        experienceDetails: ids.map(id => experiencesById.get(Number(id))).filter(Boolean),
        _id: undefined
      };
    });
    return res.json({ success: true, data: { bookings: results, count: results.length } });
  } catch (error) {
    console.error('getMyBookings error:', error);
    return res.status(500).json({ success: false, message: 'Could not fetch bookings.' });
  }
}

async function getMerchantBookings(req, res) {
  try {
    const merchantId = Number(req.user.id);
    const bookings = await Booking.find({
      $or: [{ merchantId: merchantId }, { merchantIds: merchantId }]
    }).sort({ createdAt: -1 }).lean();

    const experienceIds = [
      ...new Set(
        bookings.flatMap(booking =>
          booking.experienceIds || booking.experiences || (booking.experienceId == null ? [] : [booking.experienceId])
        ).map(Number)
      )
    ];
    const experiences = await Experience.find({ id: { $in: experienceIds } }).lean();
    const experiencesById = new Map(experiences.map(experience => [Number(experience.id), experience]));

    const results = bookings.map(booking => {
      const ids = booking.experienceIds || booking.experiences || (booking.experienceId == null ? [] : [booking.experienceId]);
      return {
        ...booking,
        experienceDetails: ids.map(id => experiencesById.get(Number(id))).filter(Boolean),
        _id: undefined
      };
    });

    return res.json({ success: true, data: { bookings: results, count: results.length } });
  } catch (error) {
    console.error('getMerchantBookings error:', error);
    return res.status(500).json({ success: false, message: 'Could not fetch merchant bookings.' });
  }
}

async function getBookingById(req, res) {
  try {
    const { bookingId } = req.params;
    const isObjectId = typeof bookingId === 'string' && bookingId.match(/^[0-9a-fA-F]{24}$/);
    const booking = await Booking.findOne({
      $or: [{ bookingId: bookingId }, { _id: isObjectId ? bookingId : null }]
    }).lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const userId = Number(req.user.id);
    const userRole = req.user.role;

    if (userRole === 'traveler' && Number(booking.userId) !== userId) {
      return res.status(403).json({ success: false, message: "Access denied. You cannot view another traveler's booking." });
    }

    if (userRole === 'merchant') {
      const isMerchantBooking = Number(booking.merchantId) === userId || (Array.isArray(booking.merchantIds) && booking.merchantIds.includes(userId));
      if (!isMerchantBooking) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only view bookings for your own experiences.' });
      }
    }

    const ids = booking.experienceIds || booking.experiences || (booking.experienceId == null ? [] : [booking.experienceId]);
    const experiences = await Experience.find({ id: { $in: ids } }).lean();
    const result = {
      ...booking,
      experienceDetails: experiences,
      _id: undefined
    };

    return res.json({ success: true, data: { booking: result } });
  } catch (error) {
    console.error('getBookingById error:', error);
    return res.status(500).json({ success: false, message: 'Could not fetch booking.' });
  }
}

async function cancelBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const isObjectId = typeof bookingId === 'string' && bookingId.match(/^[0-9a-fA-F]{24}$/);
    const booking = await Booking.findOne({
      $or: [{ bookingId: bookingId }, { _id: isObjectId ? bookingId : null }]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const userId = Number(req.user.id);

    const isTravelerOwner = Number(booking.userId) === userId;
    const isMerchantOwner = Number(booking.merchantId) === userId || (Array.isArray(booking.merchantIds) && booking.merchantIds.includes(userId));

    if (!isTravelerOwner && !isMerchantOwner) {
      return res.status(403).json({ success: false, message: 'Access denied. You cannot modify or cancel this booking.' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
    }

    booking.status = 'cancelled';
    booking.updatedAt = new Date().toISOString();
    await booking.save();

    const savedBooking = booking.toObject();
    delete savedBooking._id;
    delete savedBooking.__v;

    return res.json({
      success: true,
      message: 'Booking cancelled successfully.',
      data: { booking: savedBooking }
    });
  } catch (error) {
    console.error('cancelBooking error:', error);
    return res.status(500).json({ success: false, message: 'Could not cancel booking.' });
  }
}

module.exports = {
  createBooking,
  getMyBookings,
  getMerchantBookings,
  getBookingById,
  cancelBooking,
  readBookings
};
