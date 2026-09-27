const express = require('express');
const { getExperiences, getExperienceById } = require('../controllers/experienceController');

const router = express.Router();
router.get('/', getExperiences);
router.get('/:id', getExperienceById);

module.exports = router;
