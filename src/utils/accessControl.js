const { getCache, setCache } = require('../config/redis');

/**
 * StreamX Access Matrix (from planning):
 *
 *              | Free                        | Streamer          | Super Streamer
 * Trailer      | Always free                 | Always free       | Always free
 * SD stream    | Always free                 | Always free       | Always free
 * HD stream    | Needs Rewarded Ad unlock    | Always free       | Always free
 * UHD (4K)     | Locked (upgrade prompt)     | Locked            | Always free
 * Download SD/HD | Not allowed                | Allowed           | Allowed
 * Download UHD | Not allowed                  | Not allowed       | Allowed
 */

const TIER_RANK = { free: 0, streamer: 1, super_streamer: 2 };

/**
 * Checks whether a logged-in user currently has an "HD unlock" from
 * having just watched a Rewarded Ad. Unlocks are short-lived (see
 * unlockHdForUser) and stored in Redis keyed per user+content.
 */
const hasActiveAdUnlock = async (userId, contentId) => {
  const key = `adUnlock:${userId}:${contentId}`;
  const value = await getCache(key);
  return Boolean(value);
};

/**
 * Called after the Flutter app confirms a Rewarded Ad finished
 * playing (AdMob's onUserEarnedReward callback). Grants a 30-minute
 * HD unlock window for that specific piece of content.
 */
const unlockHdForUser = async (userId, contentId) => {
  const key = `adUnlock:${userId}:${contentId}`;
  await setCache(key, true, 30 * 60); // 30 minutes
};

/**
 * Returns only the stream links a given user is currently allowed to
 * play for a piece of content, plus flags the app can use to show
 * "Watch Ad to unlock HD" / "Upgrade to unlock 4K" prompts.
 *
 * `user` may be null/undefined (anonymous visitor) — anonymous users
 * are treated the same as "free".
 */
const getAllowedStreamLinks = async (user, content) => {
  const tier = user?.subscriptionType || 'free';
  const links = content.streamLinks || {};
  const result = {
    sd: links.sd || null,
    hd: null,
    uhd: null,
    hdRequiresAd: false,
    hdLockedUpgradeOnly: false,
    uhdLocked: false,
  };

  if (!links.hd) {
    // nothing more to gate
  } else if (TIER_RANK[tier] >= TIER_RANK.streamer) {
    result.hd = links.hd;
  } else if (user) {
    const unlocked = await hasActiveAdUnlock(user._id, content._id);
    if (unlocked) {
      result.hd = links.hd;
    } else {
      result.hdRequiresAd = true;
    }
  } else {
    result.hdRequiresAd = true;
  }

  if (links.uhd) {
    if (TIER_RANK[tier] >= TIER_RANK.super_streamer) {
      result.uhd = links.uhd;
    } else {
      result.uhdLocked = true;
    }
  }

  return result;
};

/**
 * Determines whether a user may download a given quality of a piece
 * of content. Returns { allowed: boolean, reason?: string }.
 */
const canDownload = (user, quality /* 'sd' | 'hd' | 'uhd' */) => {
  const tier = user?.subscriptionType || 'free';

  if (tier === 'free') {
    return { allowed: false, reason: 'Downloads require a Streamer or Super Streamer plan.' };
  }
  if (quality === 'uhd' && tier !== 'super_streamer') {
    return { allowed: false, reason: '4K downloads require the Super Streamer plan.' };
  }
  return { allowed: true };
};

module.exports = { getAllowedStreamLinks, canDownload, unlockHdForUser, TIER_RANK };
