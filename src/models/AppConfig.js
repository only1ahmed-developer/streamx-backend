const mongoose = require('mongoose');

/**
 * AppConfig is a SINGLE-DOCUMENT collection (there will only ever be
 * one row). It's the "remote control" the Admin Dashboard uses to
 * change app-wide behaviour instantly, without publishing a new APK —
 * exactly like Firebase Remote Config, but self-hosted.
 */
const appConfigSchema = new mongoose.Schema(
  {
    // --- Version / Update system ---
    latestVersion: { type: String, default: '1.0.0' },
    minSupportedVersion: { type: String, default: '1.0.0' }, // force-update below this
    updateMessage: { type: String, default: 'A new version of StreamX is available.' },
    apkDownloadUrl: { type: String, default: '' },

    // --- Maintenance mode ---
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'StreamX is under maintenance. Please check back soon.' },

    // --- Ads control (Grade 9 wires this up fully) ---
    adsEnabled: { type: Boolean, default: true },
    admobBannerId: { type: String, default: '' },
    admobInterstitialId: { type: String, default: '' },
    admobRewardedId: { type: String, default: '' },

    // --- Custom / house ads (shown instead of, or alongside, AdMob) ---
    customBannerImage: { type: String, default: '' },
    customBannerLink: { type: String, default: '' },

    // --- Community links ---
    telegramChannelUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppConfig', appConfigSchema);
