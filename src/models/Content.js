const mongoose = require('mongoose');

/**
 * A single playable resolution/quality link for a piece of content.
 */
const streamLinksSchema = new mongoose.Schema(
  {
    sd: { type: String, default: null },
    hd: { type: String, default: null },
    uhd: { type: String, default: null }, // 4K, Super Streamer only
  },
  { _id: false }
);

/**
 * A single caption/subtitle track (SRT or WebVTT file hosted anywhere).
 */
const captionTrackSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' }, // e.g. "English"
    language: { type: String, default: '' }, // e.g. "en"
    url: { type: String, required: true },
  },
  { _id: false }
);

/**
 * One episode inside a TV/Anime season.
 */
const episodeSchema = new mongoose.Schema(
  {
    episodeNumber: { type: Number, required: true },
    title: { type: String, default: '' },
    synopsis: { type: String, default: '' },
    duration: { type: Number, default: 0 }, // minutes
    thumbnail: { type: String, default: '' },
    streamLinks: streamLinksSchema,
    captions: [captionTrackSchema],
    releaseDate: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * One season inside a TV/Anime show.
 */
const seasonSchema = new mongoose.Schema(
  {
    seasonNumber: { type: Number, required: true },
    title: { type: String, default: '' },
    episodes: [episodeSchema],
  },
  { _id: false }
);

/**
 * StreamX Unified Content Schema
 * ---------------------------------------------------------------
 * Every playable/readable item in the app — Movie, TV Show, Music
 * Track, Sports Event, News Clip, Live Event, Education Lesson,
 * Kids Show, or Short — lives in this ONE collection, distinguished
 * by `category` and `subType`. This is the "Polymorphic Content
 * Structure" agreed on during planning: it lets us add brand new
 * categories later without touching the Flutter app's core logic.
 */
const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    synopsis: { type: String, default: '' },

    // --- Classification ---
    category: {
      type: String,
      required: true,
      enum: [
        'movies',
        'tv',
        'anime',
        'music',
        'sports',
        'news',
        'live',
        'education',
        'kids',
        'gaming',
        'shorts',
      ],
      index: true,
    },
    subType: { type: String, default: '' }, // e.g. "highlights", "documentary", "single"
    genres: [{ type: String, index: true }],
    tags: [{ type: String }],

    // --- Media assets ---
    poster: { type: String, default: '' },
    backdrop: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    trailerUrl: { type: String, default: '' },

    // --- Playback (used directly by Movies, Music, Sports clips, News, Shorts) ---
    streamLinks: streamLinksSchema,
    duration: { type: Number, default: 0 }, // minutes, or seconds for Shorts
    allowDownload: { type: Boolean, default: false },
    captions: [captionTrackSchema], // subtitle tracks for the top-level streamLinks

    // --- TV Shows / Anime hierarchical structure ---
    seasons: [seasonSchema],
    seriesStatus: { type: String, enum: ['ongoing', 'ended', null], default: null },

    // --- Cast & metadata ---
    cast: [{ type: String }],
    director: { type: String, default: '' },
    releaseYear: { type: Number, default: null },
    country: { type: String, default: '' },
    language: { type: String, default: '' },
    rating: { type: Number, default: 0 }, // e.g. IMDb-style 0-10

    // --- Access control ---
    ageRating: {
      type: String,
      enum: ['G', 'PG-13', '18+', 'TV-MA'],
      default: 'G',
    },
    isKidsFriendly: { type: Boolean, default: false },
    accessLevel: {
      type: String,
      enum: ['free', 'streamer', 'super_streamer'],
      default: 'free',
    },

    // --- Live Events specific ---
    isLive: { type: Boolean, default: false },
    liveStatus: {
      type: String,
      enum: ['upcoming', 'live', 'ended', null],
      default: null,
    },
    startTime: { type: Date, default: null },

    // --- Discovery signals ---
    viewCount: { type: Number, default: 0 },
    isTrending: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false }, // Admin can pin to Hero Banner

    // --- Source tracking (which external API this came from) ---
    sourceProvider: { type: String, default: 'davetech' },
    sourceId: { type: String, default: '' }, // original ID from the external API
  },
  { timestamps: true }
);

// Common query patterns: category + trending, category + genre.
contentSchema.index({ category: 1, isTrending: -1 });
contentSchema.index({ category: 1, genres: 1 });
contentSchema.index({ title: 'text', synopsis: 'text' });

module.exports = mongoose.model('Content', contentSchema);
