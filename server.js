require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./src/config/db');
require('./src/config/redis'); // just to initialize/log Redis status
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const apiRoutes = require('./src/routes');

const app = express();

// --- Connect to MongoDB ---
connectDB();

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: [process.env.CLIENT_URL, process.env.ADMIN_URL].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// --- Basic rate limiting to protect against abuse ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// --- Routes ---
app.get('/', (req, res) => {
  res.send('StreamX Backend is running. See /api/health');
});
app.use('/api', apiRoutes);

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Server] StreamX backend running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
