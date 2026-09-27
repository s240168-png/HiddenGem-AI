const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    userId: { type: Number, index: true },
    experiences: [{ type: Number }],
    experienceIds: [{ type: Number }],
    experienceNames: [{ type: String }],
    experienceId: { type: Number },
    experienceName: { type: String },
    merchantId: { type: Number },
    merchantIds: [{ type: Number }],
    date: { type: String },
    time: { type: String },
    numberOfPeople: { type: Number, min: 1 },
    totalCost: { type: Number, min: 0 },
    status: { type: String, enum: ['confirmed', 'cancelled', 'completed'], default: 'confirmed' },
    totalTime: { type: Number, required: true },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  {
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
