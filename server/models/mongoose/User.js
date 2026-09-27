const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, default: undefined },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    passwordHash: { type: String },
    role: { type: String, enum: ['traveler', 'merchant'], required: true },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    verificationTokenHash: { type: String, default: null },
    verificationTokenExpires: { type: String, default: null },
    lastVerificationSentAt: { type: String, default: null },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  {
    timestamps: false,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('User', userSchema);
