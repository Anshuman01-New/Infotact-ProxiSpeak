/**
 * ProxiSpeak - Database Connection Manager
 *
 * Connects to MongoDB with Mongoose and ensures 2dsphere / geospatial indexes
 * are properly initialized for optimal spatial query execution.
 */

const mongoose = require('mongoose');
const config = require('./environment');

/**
 * Initialize MongoDB connection with connection pooling and event listeners.
 */
async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true, // Automatically build indexes defined in schemas
    });

    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Ensure geospatial indexes are ready before servicing queries
    const UserLocation = require('../models/UserLocation');
    await UserLocation.init();

    // Listen for unexpected errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error('[Database] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] MongoDB disconnected. Attempting reconnection...');
    });

    return conn;
  } catch (error) {
    console.error(`[Database Error] Could not connect to MongoDB: ${error.message}`);
    console.error('Make sure your local MongoDB service is running (e.g., mongod or MongoDB Windows Service).');
    throw error;
  }
}

/**
 * Gracefully close the MongoDB connection.
 */
async function disconnectDB() {
  try {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed gracefully.');
  } catch (error) {
    console.error('[Database] Error while closing connection:', error);
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};
