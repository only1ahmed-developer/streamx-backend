const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * A sub-profile inside one account (e.g. "Kids" profile vs "Adult" profile),
 * similar to how Netflix lets one account hold multiple profiles.
 */
const profileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: '' },
    isKidsProfile: { type: Boolean, default: false },
    pin: { type: String, default: null }, // optional PIN lock for this profile
  },
  { _id: true, timestamps: true }
);

const watchHistoryItemSchema = new mongoose.Schema(
  {
    content: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
    progressSeconds: { type: Number, default: 0 },
    season: { type: Number, default: null },
    episode: { type: Number, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },

    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },

    // --- Subscription / Monetization tier (see Grade 2 for enforcement logic) ---
    subscriptionType: {
      type: String,
      enum: ['free', 'streamer', 'super_streamer'],
      default: 'free',
    },
    subscriptionExpiresAt: { type: Date, default: null },

    // --- Profiles (Netflix-style multi-profile) ---
    profiles: [profileSchema],

    // --- Personalization ---
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
    watchHistory: [watchHistoryItemSchema],
    favoriteGenres: [{ type: String }],

    // --- Account status ---
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },

    // --- Push notifications ---
    fcmTokens: [{ type: String }],
  },
  { timestamps: true }
);

// Hash the password before saving, only if it was modified.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to check a plaintext password against the stored hash.
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
