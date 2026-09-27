const { validateEnv } = require('./config/env');
const env = validateEnv();

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { readOffers } = require('./controllers/offerController');
const authRoutes = require('./routes/authRoutes');
const experienceRoutes = require('./routes/experienceRoutes');
const itineraryRoutes = require('./routes/itineraryRoutes');
const offerRoutes = require('./routes/offerRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { requirePageAuth } = require('./middleware/authMiddleware');
const { connectDB } = require('./db/connection');
const { getPublicMerchants } = require('./controllers/merchantController');
const { getPublicMerchantExperiences } = require('./controllers/experienceController');

const app = express();
const port = process.env.PORT || 3000;

app.locals.readOffers = readOffers;
app.locals.weatherCondition = 'clear';

const allowedOrigins = new Set(
  String(process.env.CORS_ORIGIN || process.env.APP_BASE_URL || `http://localhost:${port}`)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('CORS origin is not allowed.'));
  }
}));

app.use(cookieParser());
app.use(express.json({ limit: env.MAX_CONTENT_LENGTH }));
app.use(express.urlencoded({ extended: true, limit: env.MAX_CONTENT_LENGTH }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/css', express.static(path.join(__dirname, '..', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'js')));
app.use('/images', express.static(path.join(__dirname, '..', 'images')));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'HiddenGemsAI backend is running',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      environment: env.NODE_ENV
    }
  });
});

app.get('/api/merchants', getPublicMerchants);
app.get('/api/merchants/:merchantId/experiences', getPublicMerchantExperiences);

app.use('/api/auth', authRoutes);
app.use('/api/experiences', experienceRoutes);
app.use('/api/itineraries', itineraryRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/chat', chatRoutes);

// Public landing page (no auth required)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'landing.html')));
app.get('/landing', (req, res) => res.sendFile(path.join(__dirname, '..', 'landing.html')));
app.get('/landing.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'landing.html')));

// Public portal & authentication
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'login.html')));

// Role-protected pages
app.get(['/traveler-details', '/traveler-details.html'], requirePageAuth('traveler'), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'traveler-details.html'));
});
app.get(['/customer', '/customer.html'], requirePageAuth('traveler'), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'customer.html'));
});
app.get(['/merchant-details', '/merchant-details.html'], requirePageAuth('merchant'), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'merchant-details.html'));
});
app.get(['/merchant', '/merchant.html'], requirePageAuth('merchant'), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'merchant.html'));
});

app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API endpoint not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  const status = error.statusCode === 400 || error.statusCode === 413 || error.type === 'entity.parse.failed'
    ? error.statusCode === 413 ? 413 : 400
    : 500;
  const message = status === 413
    ? 'Request body exceeds the maximum allowed size.'
    : status === 400
      ? 'Request body must contain valid JSON.'
      : 'An unexpected server error occurred.';
  res.status(status).json({ success: false, message });
});

async function start() {
  try {
    await connectDB();
    console.log('MongoDB connected successfully');
    app.listen(port, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${port}`));
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exitCode = 1;
  }
}

start();
