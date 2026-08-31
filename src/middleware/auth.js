const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protects routes that require a logged-in APP USER (Flutter app).
 * Expects: Authorization: Bearer <token>
 * On success attaches `req.user` (without password) to the request.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'This account has been blocked' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token' });
  }
};

/**
 * Optional auth: attaches req.user if a valid token is present,
 * but does NOT block the request if there isn't one. Useful for
 * endpoints like "content details" that behave slightly differently
 * for logged-in vs anonymous users, without requiring login.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && !user.isBlocked) req.user = user;
    next();
  } catch (error) {
    next(); // invalid token on an optional route just means "anonymous"
  }
};

module.exports = { protect, optionalAuth };
