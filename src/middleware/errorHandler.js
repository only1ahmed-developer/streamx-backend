/**
 * Catches requests to routes that don't exist.
 */
const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found - ${req.originalUrl}`));
};

/**
 * Final error handler. Any `next(error)` call anywhere in the app
 * ends up here, so the API always returns a consistent JSON shape
 * instead of leaking stack traces to the Flutter app in production.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
