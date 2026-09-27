const Experience = require('../models/mongoose/Experience');
const Offer = require('../models/mongoose/Offer');
const Booking = require('../models/mongoose/Booking');
const Counter = require('../models/mongoose/Counter');

const budgetLevels = { '$': 1, '$$': 2, '$$$': 3 };
const ALLOWED_WEATHER_TYPES = new Set(['indoor', 'outdoor', 'all']);
const ALLOWED_VENUE_STATUS = new Set(['open', 'closed', 'temporarily_closed']);

function withoutMongoId(document) {
  const { _id, ...data } = document;
  return data;
}

async function readExperiences() {
  const experiences = await Experience.find().lean();
  return experiences.map(withoutMongoId);
}

async function getPublicExperiences() {
  const experiences = await Experience.find({ verified: true }).lean();
  return experiences.map(withoutMongoId).filter(experience => experience.verified === true);
}

function activeOfferForExperience(experience, offers) {
  return offers
    .filter(offer => offer.status === 'live' && new Date(offer.expiresAt) > new Date())
    .filter(offer => Array.isArray(experience.vibe) && experience.vibe.includes(offer.targetVibe))
    .reduce((highest, offer) => Math.max(highest, Number(offer.discount) || 0), experience.merchantOffer || 0);
}

function applyOffers(experiences, offers) {
  return experiences.map(experience => ({
    ...experience,
    merchantOffer: activeOfferForExperience(experience, offers)
  }));
}

function minutes(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function queryScore(experience, { budget, vibe, time, rain }) {
  let score = Number(experience.score) || 0;
  if (vibe && Array.isArray(experience.vibe) && experience.vibe.includes(vibe)) score += 8;
  if (budget && budgetLevels[experience.budget] <= budgetLevels[budget]) score += 5;
  if (time && minutes(experience.duration) + minutes(experience.travel) <= time * 60) score += 4;
  if (Number.parseFloat(experience.distance) <= 1) score += 3;
  if (rain && experience.indoor) score += 10;
  score += Math.min(Number(experience.merchantOffer) || 0, 20) / 4;
  return Math.min(99, Math.round(score));
}

async function getExperiences(req, res) {
  try {
    const { budget, vibe } = req.query;
    const time = Number(req.query.time);
    const rain = req.query.rain === 'true' || req.query.weather === 'rain';
    const offers = await req.app.locals.readOffers();
    let experiences = applyOffers(await getPublicExperiences(), offers);

    if (rain) experiences = experiences.filter(experience => experience.indoor && experience.venueStatus === 'open');
    else experiences = experiences.filter(experience => experience.featuredInClear !== false);
    if (budget && budgetLevels[budget]) experiences = experiences.filter(experience => budgetLevels[experience.budget] <= budgetLevels[budget]);
    if (vibe) experiences = experiences.filter(experience => Array.isArray(experience.vibe) && experience.vibe.includes(vibe));
    if (Number.isFinite(time) && time > 0) experiences = experiences.filter(experience => minutes(experience.duration) + minutes(experience.travel) <= time * 60);
    experiences = experiences
      .map(experience => ({ ...experience, fit: queryScore(experience, { budget, vibe, time, rain }) }))
      .sort((first, second) => second.fit - first.fit);

    res.json({ success: true, data: { experiences, count: experiences.length } });
  } catch (error) {
    console.error('getExperiences error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch experiences.' });
  }
}

async function getExperienceById(req, res) {
  try {
    const id = Number(req.params.id);
    const experiences = await getPublicExperiences();
    const offers = await req.app.locals.readOffers();
    const experience = applyOffers(experiences, offers).find(item => item.id === id);
    if (!experience) return res.status(404).json({ success: false, message: 'Experience not found.' });
    res.json({ success: true, data: { experience } });
  } catch (error) {
    console.error('getExperienceById error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch experience.' });
  }
}

function merchantIdFromRequest(req) {
  const merchantId = Number(req.user?.id);
  return Number.isInteger(merchantId) && merchantId > 0 ? merchantId : null;
}

function normalizeVibes(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).slice(0, 10);
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean).slice(0, 10);
  return [];
}

function normalizeExperiencePayload(body = {}, existing = {}) {
  const name = String(body.name ?? body.title ?? existing.name ?? existing.title ?? '').trim();
  const description = String(body.description ?? existing.description ?? '').trim();
  const category = String(body.category ?? existing.category ?? '').trim();
  const location = String(body.location ?? existing.location ?? '').trim();
  const duration = String(body.duration ?? existing.duration ?? '').trim();
  const travel = String(body.travel ?? existing.travel ?? '15 min').trim();
  const cost = Number(body.cost ?? existing.cost ?? 0);
  const maxGroupSize = Number(body.max_group_size ?? body.maxGroupSize ?? existing.max_group_size ?? 10);
  const rating = body.rating == null ? Number(existing.rating ?? 0) : Number(body.rating);
  const latitude = body.latitude == null ? Number(existing.latitude) : Number(body.latitude);
  const longitude = body.longitude == null ? Number(existing.longitude) : Number(body.longitude);
  const weatherType = String(body.weather_type ?? existing.weather_type ?? 'all').toLowerCase();
  const venueStatus = String(body.venueStatus ?? existing.venueStatus ?? 'open').toLowerCase();
  const vibes = normalizeVibes(body.vibes ?? body.vibe ?? existing.vibes ?? existing.vibe);
  const image = String(body.image ?? existing.image ?? '').trim();

  if (!name || name.length > 120) return { error: 'Experience name is required and must be at most 120 characters.' };
  if (!description || description.length > 2000) return { error: 'Description is required and must be at most 2000 characters.' };
  if (!category || category.length > 80) return { error: 'Category is required and must be at most 80 characters.' };
  if (!location || location.length > 180) return { error: 'Location is required and must be at most 180 characters.' };
  if (!duration || duration.length > 40) return { error: 'Duration is required.' };
  if (!Number.isFinite(cost) || cost < 0 || cost > 1000000) return { error: 'Cost must be between 0 and 1,000,000.' };
  if (!Number.isInteger(maxGroupSize) || maxGroupSize < 1 || maxGroupSize > 500) return { error: 'Maximum group size must be a whole number between 1 and 500.' };
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) return { error: 'Rating must be between 0 and 5.' };
  if (!ALLOWED_WEATHER_TYPES.has(weatherType)) return { error: 'Weather type must be indoor, outdoor, or all.' };
  if (!ALLOWED_VENUE_STATUS.has(venueStatus)) return { error: 'Venue status is invalid.' };
  if (vibes.length === 0) return { error: 'Choose at least one vibe.' };
  if (image && !/^https?:\/\/[^\s]+$/i.test(image) && !/^\/[^\s]+$/i.test(image)) return { error: 'Image must be a valid http(s) URL or site-relative path.' };

  const data = {
    name,
    title: name,
    category,
    location,
    description,
    cost,
    duration,
    travel,
    max_group_size: maxGroupSize,
    rating,
    vibe: vibes,
    vibes,
    weather_type: weatherType,
    indoor: weatherType === 'indoor' || weatherType === 'all',
    rainSafe: weatherType === 'indoor' || weatherType === 'all',
    venueStatus,
    image,
    featuredInClear: existing.featuredInClear !== false
  };

  if (Number.isFinite(latitude) && latitude >= -90 && latitude <= 90) data.latitude = latitude;
  if (Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) data.longitude = longitude;

  return { data };
}

async function getMerchantExperiences(req, res) {
  try {
    const merchantId = merchantIdFromRequest(req);
    if (!merchantId) return res.status(401).json({ success: false, message: 'Merchant authentication required.' });

    const offers = await req.app.locals.readOffers();
    const rawExperiences = await Experience.find({
      $or: [{ merchantId: String(merchantId) }, { merchantId: merchantId }]
    }).sort({ id: 1 }).lean();

    const experiences = applyOffers(rawExperiences.map(({ _id, ...exp }) => exp), offers)
      .map(experience => ({ ...experience, merchantId }));

    res.json({ success: true, data: { experiences, count: experiences.length } });
  } catch (error) {
    console.error('getMerchantExperiences error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch merchant experiences.' });
  }
}

async function createMerchantExperience(req, res) {
  try {
    const merchantId = merchantIdFromRequest(req);
    if (!merchantId) return res.status(401).json({ success: false, message: 'Merchant authentication required.' });

    const validation = normalizeExperiencePayload(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const latest = await Experience.findOne().sort({ id: -1 }).select({ id: 1 }).lean();
    const currentMax = Number(latest?.id) || 0;
    const counter = await Counter.findOneAndUpdate(
      { key: 'experienceId' },
      [{ $set: {
        seq: { $add: [{ $max: [{ $ifNull: ['$seq', 0] }, currentMax] }, 1] }
      } }],
      { upsert: true, new: true }
    ).lean();
    const nextId = Number(counter.seq);

    const experience = await Experience.create({
      id: nextId,
      ...validation.data,
      merchantId: String(merchantId),
      // There is no admin moderation role in this project; merchant-created listings
      // are therefore published immediately. This can be changed to false when an
      // admin verification workflow is introduced.
      verified: true,
      score: 70,
      match: 70
    });

    const result = withoutMongoId(experience.toObject());
    return res.status(201).json({ success: true, data: { experience: result, message: 'Experience created successfully.' } });
  } catch (error) {
    console.error('createMerchantExperience error:', error);
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'An experience with this ID already exists. Please retry.' });
    return res.status(500).json({ success: false, message: 'Could not create experience.' });
  }
}

async function updateMerchantExperience(req, res) {
  try {
    const merchantId = merchantIdFromRequest(req);
    const experienceId = Number(req.params.id);
    if (!merchantId) return res.status(401).json({ success: false, message: 'Merchant authentication required.' });
    if (!Number.isInteger(experienceId)) return res.status(400).json({ success: false, message: 'Invalid experience ID.' });

    const existing = await Experience.findOne({
      id: experienceId,
      $or: [{ merchantId: String(merchantId) }, { merchantId }]
    }).lean();

    if (!existing) return res.status(404).json({ success: false, message: 'Experience not found or not owned by this merchant.' });

    const validation = normalizeExperiencePayload(req.body, existing);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const updated = await Experience.findOneAndUpdate(
      { id: experienceId, $or: [{ merchantId: String(merchantId) }, { merchantId }] },
      { $set: validation.data },
      { new: true, runValidators: true, lean: true }
    );

    return res.json({ success: true, data: { experience: withoutMongoId(updated), message: 'Experience updated successfully.' } });
  } catch (error) {
    console.error('updateMerchantExperience error:', error);
    return res.status(500).json({ success: false, message: 'Could not update experience.' });
  }
}

async function deleteMerchantExperience(req, res) {
  try {
    const merchantId = merchantIdFromRequest(req);
    const experienceId = Number(req.params.id);
    if (!merchantId) return res.status(401).json({ success: false, message: 'Merchant authentication required.' });
    if (!Number.isInteger(experienceId)) return res.status(400).json({ success: false, message: 'Invalid experience ID.' });

    const owned = await Experience.findOne({
      id: experienceId,
      $or: [{ merchantId: String(merchantId) }, { merchantId }]
    }).lean();

    if (!owned) return res.status(404).json({ success: false, message: 'Experience not found or not owned by this merchant.' });

    const activeBooking = await Booking.findOne({
      status: 'confirmed',
      $or: [{ experienceId }, { experienceIds: experienceId }, { experiences: experienceId }]
    }).lean();
    if (activeBooking) {
      return res.status(409).json({ success: false, message: 'This experience has an active booking and cannot be deleted yet.' });
    }

    const liveOffer = await Offer.findOne({
      experienceId,
      status: 'live',
      expiresAt: { $gt: new Date().toISOString() }
    }).lean();
    if (liveOffer) {
      return res.status(409).json({ success: false, message: 'End the active offer for this experience before deleting it.' });
    }

    await Experience.deleteOne({ id: experienceId, $or: [{ merchantId: String(merchantId) }, { merchantId }] });
    return res.json({ success: true, data: { message: 'Experience deleted successfully.', experienceId } });
  } catch (error) {
    console.error('deleteMerchantExperience error:', error);
    return res.status(500).json({ success: false, message: 'Could not delete experience.' });
  }
}

async function getPublicMerchantExperiences(req, res) {
  try {
    const merchantId = Number(req.params.merchantId);
    if (!Number.isInteger(merchantId)) return res.status(400).json({ success: false, message: 'Invalid merchant ID.' });

    const experiences = await Experience.find({
      verified: true,
      $or: [{ merchantId: String(merchantId) }, { merchantId }]
    }).sort({ name: 1 }).lean();

    const publicExperiences = experiences.map(experience => {
      const result = withoutMongoId(experience);
      delete result.merchantId;
      return result;
    });

    res.json({
      success: true,
      data: {
        experiences: publicExperiences,
        count: publicExperiences.length
      }
    });
  } catch (error) {
    console.error('getPublicMerchantExperiences error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch merchant experiences.' });
  }
}

module.exports = {
  getExperiences,
  getExperienceById,
  readExperiences,
  getPublicExperiences,
  applyOffers,
  budgetLevels,
  getMerchantExperiences,
  createMerchantExperience,
  updateMerchantExperience,
  deleteMerchantExperience,
  getPublicMerchantExperiences,
  normalizeExperiencePayload
};
