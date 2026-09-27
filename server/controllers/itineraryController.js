const { getPublicExperiences } = require('./experienceController');
const { buildRecommendations } = require('./recommendationController');
const Itinerary = require('../models/mongoose/Itinerary');

function minutes(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function generateItinerary(req, res) {
  try {
    const result = await buildRecommendations({
      ...req.body,
      time_available_hours: req.body.time_available_hours ?? req.body.hours,
      weather_condition: req.body.weather_condition ?? (req.body.rain ? 'rainy' : req.body.weather)
    }, req.app);
    res.json({ success: true, data: { ...result, experiences: result.recommendations } });
  } catch (error) {
    const status = /semantic|worker/i.test(error.message) ? 503 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
}

async function validateItinerary(experienceIds, availableTime) {
  const ids = Array.isArray(experienceIds) ? experienceIds.map(Number) : [];
  const capacity = Number(availableTime);
  if (!Number.isFinite(capacity) || capacity <= 0) return { error: 'Available time must be greater than zero.' };
  if (!ids.length) return { error: 'Choose at least one experience.' };
  if (ids.length > 3) return { error: 'An itinerary can contain at most 3 stops.' };
  if (new Set(ids).size !== ids.length) return { error: 'Duplicate experiences are not allowed.' };

  const catalog = await getPublicExperiences();
  const selected = ids.map(id => catalog.find(experience => experience.id === id)).filter(Boolean);
  if (selected.length !== ids.length) return { error: 'One or more experiences could not be found.' };

  const totalMinutes = selected.reduce((total, experience) => total + minutes(experience.duration) + minutes(experience.travel), 0);
  const availableMinutes = Math.round(capacity * 60);
  return {
    itinerary: ids,
    selected,
    totalMinutes,
    totalTime: Number((totalMinutes / 60).toFixed(2)),
    availableTime: capacity,
    feasible: totalMinutes <= availableMinutes
  };
}

function formatItinerary(validation) {
  const remainingMinutes = Math.max(Math.round(validation.availableTime * 60) - validation.totalMinutes, 0);
  return {
    success: validation.feasible,
    totalTime: validation.totalTime,
    availableTime: validation.availableTime,
    remainingTime: Number((remainingMinutes / 60).toFixed(2)),
    stops: validation.itinerary.length,
    feasible: validation.feasible,
    itinerary: validation.itinerary,
    experiences: validation.selected
  };
}

async function createItinerary(req, res) {
  const validation = await validateItinerary(req.body.experiences, req.body.availableTime);
  if (validation.error) return res.status(400).json({ success: false, message: validation.error });
  const response = formatItinerary(validation);
  if (!response.feasible) return res.status(400).json({ success: false, message: 'The selected stops exceed your available time.' });
  await Itinerary.create({
    itineraryId: `HG-IT-${Date.now().toString(36).toUpperCase()}-${req.user.id}`,
    userId: Number(req.user.id),
    experiences: response.itinerary,
    availableTime: response.availableTime,
    totalTime: response.totalTime,
    createdAt: new Date().toISOString()
  });
  res.json({ success: true, data: response });
}

async function removeFromItinerary(req, res) {
  const id = Number(req.params.experienceId);
  const experiences = Array.isArray(req.body.experiences) ? req.body.experiences.map(Number).filter(experienceId => experienceId !== id) : [];
  if (!experiences.length) return res.json({ success: true, data: { totalTime: 0, availableTime: Number(req.body.availableTime) || 0, remainingTime: Number(req.body.availableTime) || 0, stops: 0, feasible: true, itinerary: [], experiences: [] } });
  const validation = await validateItinerary(experiences, req.body.availableTime);
  if (validation.error) return res.status(400).json({ success: false, message: validation.error });
  res.json({ success: true, data: formatItinerary(validation) });
}

const { createBooking } = require('./bookingController');

async function bookItinerary(req, res) {
  return createBooking(req, res);
}

module.exports = { generateItinerary, bookItinerary, createItinerary, removeFromItinerary };
