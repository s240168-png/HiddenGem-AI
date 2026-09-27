const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { handleChat } = require('../controllers/chatController');

router.post('/', authenticate, handleChat);

module.exports = router;
