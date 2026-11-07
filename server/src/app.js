/**
 * ProxiSpeak - Express Application Configuration
 *
 * Configures middleware, security, CORS, and REST API routing for
 * the ProxiSpeak backend ecosystem.
 */

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config/environment');

const roomRoutes = require('./routes/roomRoutes');
const spatialRoutes = require('./routes/spatialRoutes');

const app = express();

// Standard middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any local origin (localhost, 127.0.0.1, any port) or configured clientOrigins
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || config.clientOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'proxispeak-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
    },
    redis: {
      enabled: config.redis.enabled,
    },
  });
});

// Mount API routes
app.use('/api/rooms', roomRoutes);
app.use('/api/spatial', spatialRoutes);

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
