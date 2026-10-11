/**
 * ProxiSpeak - Environment & Application Configuration
 *
 * Centralizes all environment configuration values, applying safe defaults
 * for local development and enabling easy override via .env file.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  // Server Port
  port: parseInt(process.env.PORT, 10) || 5000,

  // Environment mode ('development', 'production', 'test')
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB Connection URI
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proxispeak',

  // Allowed CORS origins for Express and Socket.io
  clientOrigins: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5173'],

  // Default Earshot Radius in pixels (Week 2 requirement: 100-pixel radius)
  defaultEarshotRadius: parseFloat(process.env.DEFAULT_EARSHOT_RADIUS) || 100,

  // Benchmark target latency in milliseconds (Week 2 Spatial Audit target: < 20ms)
  spatialAuditMaxLatencyMs: parseFloat(process.env.SPATIAL_AUDIT_MAX_LATENCY_MS) || 20,

  // Redis Pub/Sub Configuration for horizontal multi-node scaling (Week 3 requirement)
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
};

module.exports = config;
