const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema(
  {
    itineraryId: { type: String, required: true, unique: true },
    userId: { type: Number, required: true, index: true },
    experiences: [{ type: Number, required: true }],
    availableTime: { type: Number, required: true },
    totalTime: { type: Number, required: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Itinerary', itinerarySchema);