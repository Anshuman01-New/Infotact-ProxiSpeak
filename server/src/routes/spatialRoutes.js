/**
 * ProxiSpeak - Spatial & Proximity Engine Routes
 *
 * Exposes endpoints for geospatial queries, real-time avatar locations,
 * acoustic occlusion tests, and the Week 2 <20ms spatial audit benchmark.
 */

const express = require('express');
const router = express.Router();
const UserLocation = require('../models/UserLocation');
const {
  queryNearbyFromDB,
  clusterUsersInRoom,
  getRoomState,
} = require('../services/geospatialService');
const { calculateSoundOcclusion } = require('../services/audioOcclusionService');
const { runSpatialAudit } = require('../services/auditService');
const config = require('../config/environment');

/**
 * @route   GET /api/spatial/users
 * @desc    Get all active avatars in a room
 */
router.get('/users', async (req, res) => {
  try {
    const roomId = req.query.roomId || 'default-office';
    const users = await UserLocation.find({ roomId, isOnline: true }).select('-__v').lean();
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/spatial/nearby
 * @desc    Query nearby avatars using MongoDB 2D geospatial $near index
 *          Returns matched users and the exact query latency in milliseconds.
 */
router.post('/nearby', async (req, res) => {
  try {
    const { roomId = 'default-office', x, y, radius = config.defaultEarshotRadius, excludeUserId } = req.body;

    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ success: false, message: 'Numeric x and y coordinates are required.' });
    }

    const { results, latencyMs } = await queryNearbyFromDB(roomId, x, y, radius, excludeUserId);

    res.json({
      success: true,
      queryCenter: { x, y },
      radius,
      matchCount: results.length,
      latencyMs: Math.round(latencyMs * 100) / 100,
      meets20msTarget: latencyMs < 20.0,
      data: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/spatial/clusters
 * @desc    Get physical conversation clusters in a room based on proximity
 */
router.get('/clusters', (req, res) => {
  try {
    const roomId = req.query.roomId || 'default-office';
    const threshold = parseFloat(req.query.threshold) || config.defaultEarshotRadius;

    const clusters = clusterUsersInRoom(roomId, threshold);

    res.json({
      success: true,
      roomId,
      threshold,
      clusterCount: clusters.length,
      clusters,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/spatial/audit
 * @desc    Run the automated spatial latency audit benchmark
 *          Week 2 requirement: "Prove the backend accurately filters and clusters
 *          users based on geospatial coordinates under 20ms."
 */
router.get('/audit', async (req, res) => {
  try {
    const userCount = parseInt(req.query.users, 10) || 50;
    const queryCount = parseInt(req.query.queries, 10) || 100;

    const auditResults = await runSpatialAudit({ userCount, queryCount });

    res.json({
      success: true,
      audit: auditResults,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/spatial/occlusion
 * @desc    Calculate acoustic sound occlusion between two points through room obstacles
 */
router.post('/occlusion', async (req, res) => {
  try {
    const { roomId = 'default-office', x1, y1, x2, y2 } = req.body;

    if ([x1, y1, x2, y2].some((coord) => typeof coord !== 'number')) {
      return res.status(400).json({
        success: false,
        message: 'Numeric x1, y1, x2, y2 coordinates are required.',
      });
    }

    const occlusion = await calculateSoundOcclusion(roomId, x1, y1, x2, y2);

    res.json({
      success: true,
      data: occlusion,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
