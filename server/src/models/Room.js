/**
 * ProxiSpeak - Room Model (Office Layout & Sound Obstacle Persistence)
 *
 * Persists office room boundaries, furniture, meeting spaces, and sound-blocking
 * obstacles into MongoDB.
 * Week 4 requirement: "Save office layouts and furniture obstacles (which block sound) into MongoDB."
 */

const mongoose = require('mongoose');

const ObstacleSchema = new mongoose.Schema({}); //Add the obstacle schema later on.

const RoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Virtual office canvas dimensions in pixels
    width: {
      type: Number,
      required: true,
      default: 2000,
    },
    height: {
      type: Number,
      required: true,
      default: 1500,
    },
    // Default avatar spawn point when entering this office
    spawnPoint: {
      x: { type: Number, default: 500 },
      y: { type: Number, default: 500 },
    },
    // Sound-blocking obstacles and furniture
    obstacles: [ObstacleSchema],
    metadata: {
      theme: { type: String, default: 'modern-dark' },
      maxUsers: { type: Number, default: 100 },
    },
  },
  {
    timestamps: true,
  }
);

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;