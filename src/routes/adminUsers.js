const express = require('express');
const router = express.Router();

const User = require('../models/User');
const { protectAdmin, requireRole } = require('../middleware/adminAuth');

router.use(protectAdmin);

/**
 * GET /api/admin/users
 */
router.get('/', async (req, res, next) => {
  try {
    const { search, subscriptionType, page = 1, limit = 20 } = req.query;
    const query = {};
    if (subscriptionType) query.subscriptionType = subscriptionType;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [items, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/users/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/users/:id/block
 * body: { isBlocked: boolean }
 */
router.patch('/:id/block', requireRole('superadmin', 'moderator'), async (req, res, next) => {
  try {
    const { isBlocked } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: !!isBlocked }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/users/:id/subscription
 * Manual override — e.g. after confirming an M-Pesa / bank payment
 * outside of an automated payment gateway.
 * body: { subscriptionType, subscriptionExpiresAt }
 */
router.patch('/:id/subscription', requireRole('superadmin'), async (req, res, next) => {
  try {
    const { subscriptionType, subscriptionExpiresAt } = req.body;
    if (!['free', 'streamer', 'super_streamer'].includes(subscriptionType)) {
      return res.status(400).json({ success: false, message: 'Invalid subscription type' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { subscriptionType, subscriptionExpiresAt: subscriptionExpiresAt || null },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/users/:id
 */
router.delete('/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
