const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * AdminUser is intentionally a SEPARATE collection (and later, a separate
 * JWT secret / login endpoint) from the regular User model. This mirrors
 * how large platforms operate: the mobile app never exposes an admin login
 * screen — the Admin Dashboard is its own website with its own auth.
 */
const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },

    // --- Role-Based Access Control (RBAC) ---
    role: {
      type: String,
      enum: ['superadmin', 'editor', 'moderator'],
      default: 'editor',
    },
    // Fine-grained permissions, e.g. ['content:write', 'ads:manage', 'users:block']
    permissions: [{ type: String }],

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adminUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
