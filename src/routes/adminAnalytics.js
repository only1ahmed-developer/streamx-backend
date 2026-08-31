const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Content = require('../models/Content');
const { protectAdmin } = require('../middleware/adminAuth');

router.use(protectAdmin);

/**
 * GET /api/admin/analytics/summary
 * Powers the Dashboard overview page: totals, breakdowns, and the
 * most-watched content, so the admin sees "what's hot" at a glance.
 */
router.get('/summary', async (req, res, next) => {
  try {
    const [
      totalUsers,
      usersByTier,
      totalContent,
      contentByCategory,
      topViewed,
      recentUsers,
      liveNow,
    ] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: '$subscriptionType', count: { $sum: 1 } } }]),
      Content.countDocuments(),
      Content.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Content.find().sort({ viewCount: -1 }).limit(10).select('title category viewCount thumbnail'),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email subscriptionType createdAt'),
      Content.countDocuments({ isLive: true, liveStatus: 'live' }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        usersByTier: usersByTier.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {}),
        totalContent,
        contentByCategory: contentByCategory.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {}),
        topViewed,
        recentUsers,
        liveNow,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
