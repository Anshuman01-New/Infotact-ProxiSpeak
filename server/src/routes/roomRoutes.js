/**
 * ProxiSpeak - Room & Office Layout Routes
 *
 * Provides RESTful endpoints to manage virtual office rooms, dimensions,
 * furniture, and sound-blocking obstacles.
 * Week 4 requirement: "Save office layouts and furniture obstacles (which block sound) into MongoDB."
 */

const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { invalidateRoomCache } = require('../services/audioOcclusionService');

/**
 * @route   GET /api/rooms
 * @desc    Get all virtual office rooms
 */
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().select('-__v').lean();
    res.json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/rooms
 * @desc    Create a new office room with dimensions and sound obstacles
 */
router.post('/', async (req, res) => {
  try {
    const { roomId, name, width, height, spawnPoint, obstacles, metadata } = req.body;

    if (!roomId || !name) {
      return res.status(400).json({ success: false, message: 'roomId and name are required.' });
    }

    const existing = await Room.findOne({ roomId });
    if (existing) {
      return res.status(409).json({ success: false, message: `Room with id "${roomId}" already exists.` });
    }

    const room = await Room.create({
      roomId,
      name,
      width: width || 2000,
      height: height || 1500,
      spawnPoint: spawnPoint || { x: 500, y: 500 },
      obstacles: obstacles || [],
      metadata: metadata || {},
    });

    invalidateRoomCache(roomId);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/rooms/:roomId
 * @desc    Get room details, layout dimensions, and obstacles
 */
router.get('/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId }).lean();
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/rooms/:roomId
 * @desc    Update room layout or obstacles
 */
router.put('/:roomId', async (req, res) => {
  try {
    const room = await Room.findOneAndUpdate(
      { roomId: req.params.roomId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    invalidateRoomCache(req.params.roomId);
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/rooms/:roomId/obstacles
 * @desc    Add an obstacle (wall, partition, furniture) to a room
 */
router.post('/:roomId/obstacles', async (req, res) => {
  try {
    const { obstacleId, name, type, shape, coordinates, dampingFactor, isSoundProof } = req.body;

    if (!obstacleId || !name || !coordinates) {
      return res.status(400).json({
        success: false,
        message: 'obstacleId, name, and coordinates { x1, y1, x2, y2 } are required.',
      });
    }

    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    room.obstacles.push({
      obstacleId,
      name,
      type: type || 'wall',
      shape: shape || 'line',
      coordinates,
      dampingFactor: dampingFactor !== undefined ? dampingFactor : 0.8,
      isSoundProof: Boolean(isSoundProof),
    });

    await room.save();
    invalidateRoomCache(req.params.roomId);

    res.status(201).json({ success: true, data: room.obstacles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/rooms/:roomId/obstacles/:obstacleId
 * @desc    Delete an obstacle from a room
 */
router.delete('/:roomId/obstacles/:obstacleId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    room.obstacles = room.obstacles.filter((obs) => obs.obstacleId !== req.params.obstacleId);
    await room.save();
    invalidateRoomCache(req.params.roomId);

    res.json({ success: true, message: 'Obstacle removed.', data: room.obstacles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/rooms/:roomId
 * @desc    Delete an entire room
 */
router.delete('/:roomId', async (req, res) => {
  try {
    const result = await Room.deleteOne({ roomId: req.params.roomId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    invalidateRoomCache(req.params.roomId);
    res.json({ success: true, message: 'Room deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
