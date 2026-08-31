const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the MONGO_URI env variable.
 * Exits the process if the connection fails, since the server
 * cannot function correctly without a database.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[DB] Connection error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected. Attempting to reconnect is handled by the driver.');
});

module.exports = connectDB;
