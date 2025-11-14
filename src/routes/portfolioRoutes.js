const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');

/**
 * @route   POST /api/portfolio/contact
 * @desc    Send contact email from portfolio
 * @access  Public
 * @body    { name, email, message }
 */
router.post('/contact', portfolioController.sendContactEmail);

/**
 * @route   GET /api/portfolio/contact-info
 * @desc    Get contact information
 * @access  Public
 */
router.get('/contact-info', portfolioController.getContactInfo);

/**
 * @route   GET /api/portfolio/health
 * @desc    Health check for portfolio API
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Portfolio API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
