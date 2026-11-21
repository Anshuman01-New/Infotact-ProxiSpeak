/**
 * ProxiSpeak - Server Entry Point
 *
 * Boots HTTP and WebSocket servers, connects to MongoDB, initializes Redis adapters,
 * and sets up graceful process lifecycle management.
 */

const http = require('http');
const app = require('./app');
const config = require('./config/environment');
const { connectDB, disconnectDB } = require('./config/db');
const { initializeSocketServer } = require('./sockets');
const { closeRedis } = require('./config/redis');

// Create standard HTTP server wrapping Express
const server = http.createServer(app);

let io;

/**
 * Boots the ProxiSpeak server.
 */
async function startServer() {
  try {
    // 1. Connect to MongoDB database
    await connectDB();

    // 2. Initialize Socket.io server with real-time signaling & movement
    io = await initializeSocketServer(server);

    // 3. Start listening on configured port
    server.listen(config.port, () => {
      console.log('====================================================');
      console.log(`🚀 ProxiSpeak Backend Engine running on port ${config.port}`);
      console.log(`📡 Environment: ${config.nodeEnv}`);
      console.log(`🎯 Default Earshot Radius: ${config.defaultEarshotRadius}px`);
      console.log(`⏱️ Spatial Audit Target: < ${config.spatialAuditMaxLatencyMs}ms`);
      console.log(`🌐 Allowed Client Origins: ${config.clientOrigins.join(', ')}`);
      console.log(`🩺 Health check available at: http://localhost:${config.port}/health`);
      console.log('====================================================');
    });
  } catch (error) {
    console.error('Fatal error during server startup:', error);
    process.exit(1);
  }
}

/**
 * Graceful termination handler.
 */
async function shutdown(signal) {
  console.log(`\n[Process] Received ${signal}. Commencing graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('[Server] HTTP and WebSocket server stopped.');
    });
  }

  await closeRedis();
  await disconnectDB();

  console.log('[Process] Cleanup complete. Exiting.');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server if executed directly
if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  startServer,
};
