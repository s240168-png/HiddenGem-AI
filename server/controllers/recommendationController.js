const { getPublicExperiences, applyOffers, budgetLevels } = require("./experienceController");
const { generateItinerary } = require("../services/semanticRecommendationService");

const allowedVibes = new Set([
  "Solo & Quiet", "Local Artisans", "Hidden Food", "Culture & Heritage", "Nightlife",
  "Nature & Scenic", "Adventure", "Photography", "History", "Family Friendly",
  "Romantic", "Shopping", "Spiritual", "Beach & Coastal", "Wellness & Relaxation",
  "Local Festivals", "Art & Creativity"
]);
const legacyBudgetLimits = { "$": 500, "$$": 1000, "$$$": 1500 };
const groupSizes = { Solo: 1, Couple: 2, Friends: 4, Family: 4 };

function normalizePreferences(input = {}) {
  const time_available_hours = Number(input.time_available_hours ?? input.availableTime);
  const group_size = Number(input.group_size ?? groupSizes[input.groupSize] ?? 1);
  const budget_limit = Number(input.budget_limit ?? legacyBudgetLimits[input.budget]);
  const user_vibes = input.user_vibes ?? input.vibes;
  const rawWeather = String(input.weather_condition ?? input.weather ?? "clear").toLowerCase();
  const weather_condition = rawWeather === "rain" || rawWeather === "rainy" ? "rainy" : rawWeather;

  if (!Number.isFinite(time_available_hours) || time_available_hours < 1 || time_available_hours > 8) {
    throw new Error("Available time must be between 1 and 8 hours.");
  }
  if (!Number.isInteger(group_size) || group_size < 1 || group_size > 50) {
    throw new Error("Group size must be a whole number between 1 and 50.");
  }
  if (!Number.isFinite(budget_limit) || budget_limit <= 0) {
    throw new Error("Budget limit must be greater than zero.");
  }
  if (!Array.isArray(user_vibes) || user_vibes.length === 0 || user_vibes.some(vibe => typeof vibe !== "string" || !allowedVibes.has(vibe.trim()))) {
    throw new Error("Choose at least one valid vibe.");
  }
  if (!["clear", "rainy"].includes(weather_condition)) {
    throw new Error("Weather condition must be \"clear\" or \"rainy\".");
  }

  return {
    time_available_hours,
    group_size,
    budget_limit,
    weather_condition,
    user_vibes: user_vibes.map(vibe => vibe.trim()),
    start_time: typeof input.start_time === "string" && input.start_time.trim() ? input.start_time.trim() : "09:00 AM",
    availableTime: time_available_hours,
    budget: input.budget || Object.entries(legacyBudgetLimits).find(([, limit]) => limit === budget_limit)?.[0] || "$$$",
    vibes: user_vibes.map(vibe => vibe.trim()),
    weather: weather_condition === "rainy" ? "rain" : "clear"
  };
}

function candidateCost(experience) {
  if (Number.isFinite(Number(experience.cost))) return Number(experience.cost);
  return legacyBudgetLimits[experience.budget] || Number.POSITIVE_INFINITY;
}

function isRainCompatible(experience) {
  return ["indoor", "all"].includes(String(experience.weather_type || "").toLowerCase());
}

async function buildRecommendations(input, app) {
  const preferences = normalizePreferences(input);
  const offers = await app.locals.readOffers();
  
  const candidates = applyOffers(await getPublicExperiences(), offers)
    .filter(experience => experience.venueStatus === "open")
    .filter(experience => Number(experience.max_group_size) >= preferences.group_size)
    .filter(experience => candidateCost(experience) <= preferences.budget_limit)
    .filter(experience => preferences.weather_condition !== "rainy" || isRainCompatible(experience))
    .filter(experience => preferences.weather_condition === "rainy" || experience.featuredInClear !== false);

  const payload = {
    start_time: preferences.start_time,
    time_available_hours: preferences.time_available_hours,
    budget_limit: preferences.budget_limit,
    user_vibes: preferences.user_vibes,
    experiences: candidates
  };

  const response = await generateItinerary(payload);
  
  const itineraryIds = response.itinerary.map(item => item.id).filter(id => id != null);

  const recommendations = (response.experiences || candidates).map(exp => {
    exp.fit = Math.round(exp.vibe_score || 0);
    exp.match = exp.fit;
    return exp;
  }).sort((a, b) => b.fit - a.fit);

  return { 
    preferences, 
    recommendations, 
    itinerary: response.itinerary,
    schedule: response.itinerary,
    totalSpent: response.totalSpent,
    budgetLimit: response.budgetLimit
  };
}

async function getRecommendations(req, res) {
  try {
    const result = await buildRecommendations(req.body, req.app);
    res.json({ success: true, data: result });
  } catch (error) {
    const status = /semantic|worker|python/i.test(error.message) ? 503 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
}

module.exports = { getRecommendations, buildRecommendations, normalizePreferences, allowedVibes };

