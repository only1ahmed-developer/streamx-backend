const express = require('express');
const router = express.Router();

const Content = require('../models/Content');
const { protectAdmin, requireRole } = require('../middleware/adminAuth');
const { client: redisClient } = require('../config/redis');

router.use(protectAdmin);

// Any successful write invalidates the homepage cache so changes show
// up immediately instead of waiting for the 5-minute TTL to expire.
const invalidateHomepageCache = async () => {
  if (redisClient) {
    try {
      await redisClient.del('homepage-bundle');
    } catch (err) {
      console.error('[Cache] Failed to invalidate homepage cache:', err.message);
    }
  }
};

/**
 * GET /api/admin/content
 * Full list for the CMS table, with search/filter/pagination.
 */
router.get('/', async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const query = {};
    if (category) query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [items, total] = await Promise.all([
      Content.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Content.countDocuments(query),
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
 * GET /api/admin/content/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const item = await Content.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Content not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/content
 * Create a new Movie / Show / Song / Sports clip / News / Live event / etc.
 */
router.post('/', requireRole('superadmin', 'editor'), async (req, res, next) => {
  try {
    const item = await Content.create(req.body);
    await invalidateHomepageCache();
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/content/:id
 */
router.put('/:id', requireRole('superadmin', 'editor'), async (req, res, next) => {
  try {
    const item = await Content.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Content not found' });
    await invalidateHomepageCache();
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/content/:id/toggle
 * Quick toggle for isFeatured / isTrending switches in the CMS table,
 * without needing to open the full edit form.
 * body: { field: 'isFeatured' | 'isTrending', value: boolean }
 */
router.patch('/:id/toggle', requireRole('superadmin', 'editor'), async (req, res, next) => {
  try {
    const { field, value } = req.body;
    if (!['isFeatured', 'isTrending'].includes(field)) {
      return res.status(400).json({ success: false, message: 'Invalid field to toggle' });
    }
    const item = await Content.findByIdAndUpdate(req.params.id, { [field]: value }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Content not found' });
    await invalidateHomepageCache();
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/content/:id
 * Only superadmins can delete content, per the RBAC rules discussed.
 */
router.delete('/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    const item = await Content.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Content not found' });
    await invalidateHomepageCache();
    res.json({ success: true, message: 'Content deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
