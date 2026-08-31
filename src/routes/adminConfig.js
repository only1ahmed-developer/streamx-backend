const express = require('express');
const router = express.Router();

const AppConfig = require('../models/AppConfig');
const { protectAdmin, requireRole } = require('../middleware/adminAuth');

router.use(protectAdmin);

/**
 * GET /api/admin/config
 */
router.get('/', async (req, res, next) => {
  try {
    let config = await AppConfig.findOne();
    if (!config) config = await AppConfig.create({});
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/config
 * Updates maintenance mode, version/force-update info, ads toggles &
 * IDs, custom banner, and the Telegram channel link — all without
 * needing a new APK release, exactly as discussed in planning.
 */
router.put('/', requireRole('superadmin', 'editor'), async (req, res, next) => {
  try {
    let config = await AppConfig.findOne();
    if (!config) config = new AppConfig();

    Object.assign(config, req.body);
    await config.save();

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
