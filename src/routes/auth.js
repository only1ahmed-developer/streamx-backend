const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const User = require('../models/User');
const { protect } = require('../middleware/auth');

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * POST /api/auth/register
 * body: { name, email, password }
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      profiles: [{ name, isKidsProfile: false }],
    });

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptionType: user.subscriptionType,
        profiles: user.profiles,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'This account has been blocked' });
    }

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptionType: user.subscriptionType,
        profiles: user.profiles,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Returns the logged-in user's full profile (used by "My Account" page).
 * Watchlist is populated with full Content documents so the app can
 * render posters/titles without extra round-trips.
 */
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('watchlist');
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/profiles
 * Add a new sub-profile (e.g. a Kids profile) to the account.
 * body: { name, isKidsProfile, avatar, pin }
 */
router.post('/profiles', protect, async (req, res, next) => {
  try {
    const { name, isKidsProfile, avatar, pin } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Profile name is required' });
    if (req.user.profiles.length >= 5) {
      return res.status(400).json({ success: false, message: 'Maximum of 5 profiles per account' });
    }

    req.user.profiles.push({ name, isKidsProfile: !!isKidsProfile, avatar, pin });
    await req.user.save();
    res.status(201).json({ success: true, profiles: req.user.profiles });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/watchlist/:contentId  -> add
 * DELETE /api/auth/watchlist/:contentId -> remove
 */
router.post('/watchlist/:contentId', protect, async (req, res, next) => {
  try {
    const { contentId } = req.params;
    if (!req.user.watchlist.includes(contentId)) {
      req.user.watchlist.push(contentId);
      await req.user.save();
    }
    res.json({ success: true, watchlist: req.user.watchlist });
  } catch (error) {
    next(error);
  }
});

router.delete('/watchlist/:contentId', protect, async (req, res, next) => {
  try {
    const { contentId } = req.params;
    req.user.watchlist = req.user.watchlist.filter((id) => id.toString() !== contentId);
    await req.user.save();
    res.json({ success: true, watchlist: req.user.watchlist });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/watch-history
 * Called periodically by the video player to save "Continue Watching"
 * progress. body: { contentId, progressSeconds, season?, episode? }
 */
router.put('/watch-history', protect, async (req, res, next) => {
  try {
    const { contentId, progressSeconds, season, episode } = req.body;
    if (!contentId) return res.status(400).json({ success: false, message: 'contentId is required' });

    const existing = req.user.watchHistory.find((h) => h.content.toString() === contentId);
    if (existing) {
      existing.progressSeconds = progressSeconds;
      existing.season = season ?? existing.season;
      existing.episode = episode ?? existing.episode;
      existing.updatedAt = new Date();
    } else {
      req.user.watchHistory.unshift({ content: contentId, progressSeconds, season, episode });
    }
    // Keep history to a reasonable size
    req.user.watchHistory = req.user.watchHistory.slice(0, 200);

    await req.user.save();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
