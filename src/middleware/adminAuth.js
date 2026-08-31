const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

/**
 * Protects Admin Dashboard routes ONLY. Uses a completely different
 * secret (ADMIN_JWT_SECRET) than the app-user auth, and there is no
 * login screen for this inside the Flutter app — only on the separate
 * Admin Dashboard website (Grade 3).
 */
const protectAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Admin not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    const admin = await AdminUser.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Admin account not found or disabled' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Admin not authorized, invalid or expired token' });
  }
};

/**
 * Restricts a route to specific admin roles.
 * Usage: router.delete('/users/:id', protectAdmin, requireRole('superadmin'), handler)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin || !allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions for this action' });
    }
    next();
  };
};

module.exports = { protectAdmin, requireRole };
