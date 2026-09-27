const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    title: { type: String },
    category: { type: String },
    location: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    vibe: [{ type: String }],
    vibes: [{ type: String }],
    description: { type: String },
    cost: { type: Number },
    budget: { type: String },
    duration: { type: String },
    duration_hours: { type: Number },
    travel: { type: String },
    distance: { type: String },
    rating: { type: Number, min: 0, max: 5 },
    indoor: { type: Boolean, default: false },
    weather: { type: String },
    weather_type: { type: String, enum: ['indoor', 'outdoor', 'all'] },
    rainSafe: { type: Boolean, default: false },
    max_group_size: { type: Number, min: 1 },
    image: { type: String },
    images: { type: mongoose.Schema.Types.Mixed },
    verified: { type: Boolean, default: false, index: true },
    merchantId: { type: String, index: true },
    featuredInClear: { type: Boolean },
    venueStatus: { type: String },
    score: { type: Number },
    match: { type: Number },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  {
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('Experience', experienceSchema);
