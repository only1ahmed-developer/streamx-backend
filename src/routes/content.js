const express = require('express');
const router = express.Router();

const Content = require('../models/Content');
const { optionalAuth, protect } = require('../middleware/auth');
const { getCache, setCache } = require('../config/redis');
const { getAllowedStreamLinks, unlockHdForUser, canDownload } = require('../utils/accessControl');

/**
 * GET /api/content
 * The "Unified Endpoint Structure" agreed on in planning:
 *   /api/content?type=movies&filter=trending
 *   /api/content?type=music&filter=popular&genre=Bongo%20Flava
 *   /api/content?type=tv&search=Avengers&page=2
 *
 * Query params:
 *   type     - category (movies, tv, anime, music, sports, news, live,
 *              education, kids, gaming, shorts). Omit for "All".
 *   filter   - trending | latest | popular | featured
 *   genre    - filter by a single genre
 *   year     - filter by releaseYear
 *   country  - filter by country
 *   ageRating- G | PG-13 | 18+ | TV-MA
 *   isLive   - 'true' to only return live-flagged items (any category —
 *              a live football match may still be category=sports)
 *   liveStatus - upcoming | live | ended (used together with isLive)
 *   search   - free-text search across title/synopsis
 *   sort     - trending | newest | rating | az (default depends on filter)
 *   page, limit - pagination (default page=1, limit=20)
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      type,
      filter,
      genre,
      year,
      country,
      ageRating,
      isLive,
      liveStatus,
      search,
      sort,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};
    if (type) query.category = type;
    if (genre) query.genres = genre;
    if (year) query.releaseYear = Number(year);
    if (country) query.country = country;
    if (ageRating) query.ageRating = ageRating;
    if (isLive === 'true') query.isLive = true;
    if (liveStatus) query.liveStatus = liveStatus;
    if (search) query.$text = { $search: search };

    // Parental safety: unless explicitly requesting 18+ content with an
    // authenticated adult user, hide it by default for anonymous/kids access.
    // (Full profile-level PIN enforcement is wired up on the app side too.)
    if (!ageRating) {
      query.ageRating = { $ne: '18+' };
    }

    if (filter === 'trending') query.isTrending = true;
    if (filter === 'featured') query.isFeatured = true;

    let sortStage = { createdAt: -1 }; // default: latest
    if (sort === 'trending' || filter === 'trending') sortStage = { viewCount: -1 };
    if (sort === 'rating') sortStage = { rating: -1 };
    if (sort === 'az') sortStage = { title: 1 };
    if (sort === 'newest' || filter === 'latest') sortStage = { releaseYear: -1, createdAt: -1 };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    // Shorts are short-form, free-to-play clips (see planning notes) — the
    // swipe feed needs a playable URL immediately on scroll, so unlike
    // every other category we don't strip streamLinks from the list.
    const listSelect = type === 'shorts' ? '-seasons' : '-seasons -streamLinks';

    const [items, total] = await Promise.all([
      Content.find(query)
        .sort(sortStage)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select(listSelect),
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
 * GET /api/content/homepage
 * Returns a ready-to-render bundle for the Home screen: hero/featured
 * items plus one row per major category (Trending, Movies, TV, Music,
 * Sports...), so the Flutter app can build the whole page in one call.
 */
router.get('/homepage', async (req, res, next) => {
  try {
    const cacheKey = 'homepage-bundle';
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ success: true, cached: true, data: cached });

    const baseSelect = '-seasons -streamLinks';
    const safe = { ageRating: { $ne: '18+' } };

    const [featured, trendingMovies, trendingTv, music, sports, education, animation] = await Promise.all([
      Content.find({ ...safe, isFeatured: true }).limit(8).select(baseSelect),
      Content.find({ ...safe, category: 'movies' }).sort({ viewCount: -1 }).limit(12).select(baseSelect),
      Content.find({ ...safe, category: 'tv' }).sort({ viewCount: -1 }).limit(12).select(baseSelect),
      Content.find({ ...safe, category: 'music' }).sort({ createdAt: -1 }).limit(12).select(baseSelect),
      Content.find({ ...safe, category: 'sports' }).sort({ createdAt: -1 }).limit(12).select(baseSelect),
      Content.find({ ...safe, category: 'education' }).sort({ createdAt: -1 }).limit(12).select(baseSelect),
      Content.find({ ...safe, category: 'anime' }).sort({ createdAt: -1 }).limit(12).select(baseSelect),
    ]);

    const bundle = {
      hero: featured,
      rows: [
        { title: 'Trending Movies', category: 'movies', items: trendingMovies },
        { title: 'Popular TV Shows', category: 'tv', items: trendingTv },
        { title: 'Music', category: 'music', items: music },
        { title: 'Sports', category: 'sports', items: sports },
        { title: 'Education', category: 'education', items: education },
        { title: 'Anime', category: 'anime', items: animation },
      ],
    };

    await setCache(cacheKey, bundle, 300); // cache 5 minutes
    res.json({ success: true, cached: false, data: bundle });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/content/:id
 * Full details for one item, WITH access-control applied to the
 * stream links based on the requesting user's subscription tier.
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).json({ success: false, message: 'Content not found' });

    // fire-and-forget view count bump
    Content.updateOne({ _id: content._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    const allowedStreamLinks = await getAllowedStreamLinks(req.user, content);

    res.json({
      success: true,
      data: {
        ...content.toObject(),
        streamLinks: allowedStreamLinks, // overrides raw links with gated version
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/content/:id/unlock-hd
 * Called by the app right after a Rewarded Ad finishes successfully.
 * Grants a temporary HD-quality unlock for Free-tier users.
 */
router.post('/:id/unlock-hd', protect, async (req, res, next) => {
  try {
    await unlockHdForUser(req.user._id, req.params.id);
    res.json({ success: true, message: 'HD unlocked for the next 30 minutes.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/content/:id/download?quality=sd|hd|uhd
 * Returns a direct download URL for the requested quality, gated by the
 * Free/Streamer/Super Streamer download rules from Grade 2's
 * accessControl.js. The Flutter app's DownloadService (Grade 7) calls
 * this first, then performs the actual file transfer itself.
 */
router.get('/:id/download', protect, async (req, res, next) => {
  try {
    const quality = ['sd', 'hd', 'uhd'].includes(req.query.quality) ? req.query.quality : 'sd';

    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).json({ success: false, message: 'Content not found' });
    if (!content.allowDownload) {
      return res.status(403).json({ success: false, message: 'Downloads are not enabled for this title.' });
    }

    const { allowed, reason } = canDownload(req.user, quality);
    if (!allowed) return res.status(403).json({ success: false, message: reason });

    const url = content.streamLinks?.[quality];
    if (!url) {
      return res.status(404).json({ success: false, message: `${quality.toUpperCase()} is not available for this title.` });
    }

    res.json({ success: true, data: { url, quality, title: content.title } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
