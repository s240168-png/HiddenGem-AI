const Merchant = require('../models/mongoose/Merchant');
const Experience = require('../models/mongoose/Experience');
const Booking = require('../models/mongoose/Booking');
const { getMerchantExperiences } = require('./experienceController');

async function getAnalytics(req, res) {
  try {
    const now = new Date();
    const merchantId = Number(req.user.id);
    const offers = await req.app.locals.readOffers();
    const merchantOffers = offers.filter(o => Number(o.merchantId) === merchantId);
    const activeOffers = merchantOffers.filter(offer => offer.status === 'live' && new Date(offer.expiresAt) > now).length;

    const merchantExperiences = await Experience.find({
      $or: [{ merchantId: String(merchantId) }, { merchantId: merchantId }]
    }).lean();

    const totalBookings = await Booking.countDocuments({
      $or: [{ merchantId }, { merchantIds: merchantId }]
    });

    res.json({
      success: true,
      data: {
        analytics: {
          totalExperiences: merchantExperiences.length,
          activeOffers,
          totalBookings,
          discountOffers: merchantOffers.length
        }
      }
    });
  } catch (error) {
    console.error('getAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch merchant analytics.' });
  }
}

async function getPublicMerchants(req, res) {
  try {
    const merchants = await Merchant.find({}).lean();
    const publicMerchants = merchants.map(m => ({
      id: m.userId || m._id,
      name: m.name,
      businessName: m.businessName,
      address: m.address,
      latitude: m.latitude,
      longitude: m.longitude
    }));
    res.json({ success: true, data: publicMerchants });
  } catch (error) {
    console.error('getPublicMerchants error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch merchants.' });
  }
}

module.exports = { getAnalytics, getMerchantExperiences, getPublicMerchants };
