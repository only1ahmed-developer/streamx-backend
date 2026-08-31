const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const AdminUser = require('../models/AdminUser');
const { protectAdmin } = require('../middleware/adminAuth');

const signAdminToken = (adminId) =>
  jwt.sign({ id: adminId }, process.env.ADMIN_JWT_SECRET, {
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
  });

/**
 * POST /api/admin/auth/login
 * This is the ONLY way into the Admin Dashboard. There is no public
 * registration endpoint — admin accounts are created directly in the
 * database (or by a superadmin from inside the dashboard, in Grade 3).
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await AdminUser.findOne({ email: email.toLowerCase() }).select('+password');
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'This admin account is disabled' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = signAdminToken(admin._id);
    res.json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/auth/me
 */
router.get('/me', protectAdmin, async (req, res) => {
  res.json({ success: true, admin: req.admin });
});

module.exports = router;
