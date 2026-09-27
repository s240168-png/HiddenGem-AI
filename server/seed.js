const { validateEnv } = require('./config/env');
validateEnv();

const fs = require('fs');
const path = require('path');
const { connectDB } = require('./db/connection');
const User = require('./models/mongoose/User');
const Merchant = require('./models/mongoose/Merchant');
const Experience = require('./models/mongoose/Experience');
const Offer = require('./models/mongoose/Offer');
const Itinerary = require('./models/mongoose/Itinerary');
const Booking = require('./models/mongoose/Booking');
const Counter = require('./models/mongoose/Counter');

const dataDir = path.join(__dirname, 'data');
const models = [User, Merchant, Experience, Offer, Itinerary, Booking, Counter];

function readJson(fileName) {
  const filePath = path.join(dataDir, fileName);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
}

function upsertOperations(records, key, transform = record => record) {
  return records.map(record => ({
    updateOne: {
      filter: { [key]: record[key] },
      update: { $set: transform(record) },
      upsert: true
    }
  }));
}

async function ensureCollections() {
  for (const model of models) {
    try {
      await model.createCollection();
    } catch (error) {
      if (error.codeName !== 'NamespaceExists') throw error;
    }
    await model.init();
  }
}

async function seed() {
  await connectDB();
  await ensureCollections();

  const users = readJson('users.json');
  if (users.length) await User.bulkWrite(upsertOperations(users, 'id'));
  const merchants = users
    .filter(user => user.role === 'merchant')
    .map(user => ({
      userId: user.id,
      name: user.name,
      businessName: user.businessName,
      email: user.email,
      createdAt: user.createdAt
    }));
  if (merchants.length) await Merchant.bulkWrite(upsertOperations(merchants, 'userId'));

  const ownerships = readJson('merchant-experiences.json');
  const ownershipByExperienceId = new Map(
    ownerships
      .filter(link => link && link.experienceId != null && link.merchantId != null)
      .map(link => [String(link.experienceId), Number(link.merchantId)])
  );
  const experienceFile = ['gem_data.json', 'ratnagiri_dataset.json', 'experiences.json']
    .find(fileName => fs.existsSync(path.join(dataDir, fileName))) || 'experiences.json';
  const experiences = readJson(experienceFile);
  const experienceOperations = experiences.map(experience => {
    const merchantId = ownershipByExperienceId.get(String(experience.id));
    const experienceData = { ...experience };
    delete experienceData.merchantId;
    const update = merchantId == null
      ? { $set: experienceData }
      : { $set: { ...experienceData, merchantId } };
    return { updateOne: { filter: { id: experience.id }, update, upsert: true } };
  });
  if (experienceOperations.length) await Experience.bulkWrite(experienceOperations);
  const maxExperienceId = experiences.reduce((max, experience) => Math.max(max, Number(experience.id) || 0), 0);
  if (maxExperienceId > 0) {
    await Counter.findOneAndUpdate(
      { key: 'experienceId' },
      { $max: { seq: maxExperienceId } },
      { upsert: true, new: true }
    );
  }

  const offers = readJson('offers.json');
  if (offers.length) await Offer.bulkWrite(upsertOperations(offers, 'id'));

  const bookings = readJson('bookings.json');
  if (bookings.length) await Booking.bulkWrite(upsertOperations(bookings, 'bookingId'));

  const itineraries = readJson('itineraries.json').map(itinerary => ({
    ...itinerary,
    itineraryId: itinerary.itineraryId || itinerary.id || `${itinerary.userId}:${itinerary.createdAt}`
  }));
  if (itineraries.length) await Itinerary.bulkWrite(upsertOperations(itineraries, 'itineraryId'));

  console.log(`Seed complete: ${users.length} users, ${merchants.length} merchants, ${experiences.length} experiences, ${offers.length} offers, ${itineraries.length} itineraries, ${bookings.length} bookings.`);
}

seed()
  .catch(error => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });