const express = require('express');
const router = express.Router();
const AppConfig = require('../models/AppConfig');

const authRoutes = require('./auth');
const contentRoutes = require('./content');
const adminAuthRoutes = require('./adminAuth');
const adminContentRoutes = require('./adminContent');
const adminUsersRoutes = require('./adminUsers');
const adminConfigRoutes = require('./adminConfig');
const adminAnalyticsRoutes = require('./adminAnalytics');

router.use('/auth', authRoutes);
router.use('/content', contentRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/content', adminContentRoutes);
router.use('/admin/users', adminUsersRoutes);
router.use('/admin/config', adminConfigRoutes);
router.use('/admin/analytics', adminAnalyticsRoutes);

/**
 * GET /api/health
 * Simple check to confirm the server + DB are alive.
 * Useful for Render/Vercel/Heroku health checks.
 */
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'StreamX API is running', timestamp: new Date().toISOString() });
});

/**
 * GET /api/app-config
 * The Flutter app calls this on startup to check for the "Startup
 * Check" flow discussed in planning: is there a new version, is the
 * app in maintenance mode, are ads on, etc. If no AppConfig document
 * exists yet, it auto-creates one with defaults so the app never
 * gets a 404 here.
 */
router.get('/app-config', async (req, res, next) => {
  try {
    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create({});
    }
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

// --- Grade 4 onward: Flutter app consumes /content, /auth, /app-config ---

module.exports = router;
