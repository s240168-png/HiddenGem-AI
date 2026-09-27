const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    merchantId: { type: Number, index: true },
    title: { type: String },
    description: { type: String },
    discount: { type: Number, required: true },
    duration: { type: String, required: true },
    targetVibe: { type: String, required: true },
    status: { type: String, default: 'live' },
    createdAt: { type: String },
    expiresAt: { type: String, required: true },
  },
  {
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('Offer', offerSchema);
