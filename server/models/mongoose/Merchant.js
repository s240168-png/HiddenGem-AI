const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    businessName: { type: String },
    email: { type: String, lowercase: true, trim: true },
    createdAt: { type: String },
  },
  { versionKey: false, strict: false }
);

module.exports = mongoose.model('Merchant', merchantSchema);