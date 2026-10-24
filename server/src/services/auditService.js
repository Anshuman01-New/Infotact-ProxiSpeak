/**
 * ProxiSpeak - Spatial Audit & Latency Benchmark Service
 *
 * Week 2 Requirement:
 * "Spatial Audit: Prove the backend accurately filters and clusters users
 * based on geospatial coordinates under 20ms."
 *
 * Executes automated benchmark iterations measuring MongoDB $near query performance
 * and spatial clustering latency under simulated concurrent user load.
 */

const UserLocation = require('../models/UserLocation');
const { clusterUsersInRoom, setAvatarPosition } = require('./geospatialService');
const config = require('../config/environment');

/**
 * Runs a rigorous spatial query benchmark against MongoDB.
 *
 * @param {object} options
 * @param {number} [options.userCount=50] - Number of simulated users in the space
 * @param {number} [options.queryCount=100] - Number of spatial queries to execute
 * @param {number} [options.radius=100] - Earshot radius to search within
 * @param {string} [options.roomId='audit-benchmark-room']
 * @returns {Promise<object>} Benchmark report with latency percentiles
 */
async function runSpatialAudit({
  userCount = 50,
  queryCount = 100,
  radius = config.defaultEarshotRadius,
  roomId = "audit-benchmark-room",
} = {}) {
  const targetThresholdMs = config.spatialAuditMaxLatencyMs; // 20ms target

  // Step 1: Clean up any old audit data for this room
  await UserLocation.deleteMany({ roomId });

  // Step 2: Seed simulated concurrent users across a 2000x2000 pixel virtual office
  const seedDocs = [];
  for (let i = 0; i < userCount; i++) {
    const x = Math.floor(Math.random() * 2000);
    const y = Math.floor(Math.random() * 2000);

    seedDocs.push({
      userId: `audit-user-${i}`,
      socketId: `socket-audit-${i}`,
      username: `Simulated User ${i}`,
      roomId,
      location: [x, y],
      rawX: x,
      rawY: y,
      earshotRadius: radius,
      isOnline: true,
      lastActive: new Date(),
    });

    // Also populate in-memory state for clustering test
    await setAvatarPosition({
      userId: `audit-user-${i}`,
      socketId: `socket-audit-${i}`,
      roomId,
      x,
      y,
      username: `Simulated User ${i}`,
    });
  }

  await UserLocation.insertMany(seedDocs);

  // Step 3: Run spatial query benchmark
  const latencies = [];

  for (let q = 0; q < queryCount; q++) {
    const testX = Math.floor(Math.random() * 2000);
    const testY = Math.floor(Math.random() * 2000);

    const startHr = process.hrtime.bigint();

    // Execute MongoDB 2D geospatial $near query
    await UserLocation.findNearbyUsers(roomId, testX, testY, radius);

    const endHr = process.hrtime.bigint();
    const durationMs = Number(endHr - startHr) / 1e6;
    latencies.push(durationMs);
  }

  // Step 4: Measure Clustering Algorithm Performance
  const clusterStartHr = process.hrtime.bigint();
  const clusters = clusterUsersInRoom(roomId, radius);
  const clusterEndHr = process.hrtime.bigint();
  const clusteringLatencyMs = Number(clusterEndHr - clusterStartHr) / 1e6;

  // Step 5: Calculate statistical metrics
  latencies.sort((a, b) => a - b);
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const sumLatency = latencies.reduce((acc, curr) => acc + curr, 0);
  const avgLatency = sumLatency / latencies.length;

  //Calculating percentiles (P50, P95, P99) for latency distribution
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  // Clean up audit test room from MongoDB
  await UserLocation.deleteMany({ roomId });

  const passed = p95 <= targetThresholdMs;

  return {
    timestamp: new Date().toISOString(),
    status: passed ? 'PASSED' : 'FAILED',
    targetThresholdMs,
    metrics: {
      simulatedUsers: userCount,
      queriesExecuted: queryCount,
      earshotRadiusPx: radius,
      minLatencyMs: Math.round(minLatency * 100) / 100,
      maxLatencyMs: Math.round(maxLatency * 100) / 100,
      avgLatencyMs: Math.round(avgLatency * 100) / 100,
      p50LatencyMs: Math.round(p50 * 100) / 100,
      p95LatencyMs: Math.round(p95 * 100) / 100,
      p99LatencyMs: Math.round(p99 * 100) / 100,
      clusteringLatencyMs: Math.round(clusteringLatencyMs * 100) / 100,
      clustersFound: clusters.length,
    },
    auditAssessment: passed
      ? `PASS: P95 spatial query latency (${p95.toFixed(2)}ms) is strictly UNDER the 20ms target requirement!`
      : `WARN: P95 spatial query latency (${p95.toFixed(2)}ms) exceeded the 20ms threshold.`,
  };
}

module.exports = {
  runSpatialAudit,
};
