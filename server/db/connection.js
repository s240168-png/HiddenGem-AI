const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in the .env file.');

  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

function getConnectionStatus() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, getConnectionStatus };
