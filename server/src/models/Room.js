/**
 * ProxiSpeak - Room Model (Office Layout & Sound Obstacle Persistence)
 *
 * Persists office room boundaries, furniture, meeting spaces, and sound-blocking
 * obstacles into MongoDB.
 * Week 4 requirement: "Save office layouts and furniture obstacles (which block sound) into MongoDB."
 */

const mongoose = require("mongoose");

const ObstacleSchema = new mongoose.Schema({
  obstacleId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  // Type of obstacle: 'wall', 'glass', 'partition', 'furniture', 'door'
  type: {
    type: String,
    enum: ["wall", "glass", "partition", "furniture", "door"],
    default: "wall",
  },
  // Geometry shape: 'line' (thin wall segment) or 'rectangle' (furniture / solid block)
  shape: {
    type: String,
    enum: ["line", "rectangle"],
    default: "line",
  },
  /**
   * Coordinate bounds:
   * For line: from (x1, y1) to (x2, y2)
   * For rectangle: top-left (x1, y1) to bottom-right (x2, y2)
   */
  coordinates: {
    x1: { type: Number, required: true },
    y1: { type: Number, required: true },
    x2: { type: Number, required: true },
    y2: { type: Number, required: true },
  },
  /**
   * Sound damping factor (acoustic attenuation / absorption coefficient):
   * 0.0 = completely transparent to sound (no volume reduction)
   * 0.3 = light partition / cubicle (30% volume loss)
   * 0.6 = glass wall (60% volume loss)
   * 0.85 = drywall (85% volume loss)
   * 1.0 = completely soundproof (0% sound penetrates)
   */
  dampingFactor: {
    type: Number,
    min: 0.0,
    max: 1.0,
    default: 0.8,
  },
  isSoundProof: {
    type: Boolean,
    default: false,
  },
});

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
      theme: { type: String, default: "modern-dark" },
      maxUsers: { type: Number, default: 100 },
    },
  },
  {
    timestamps: true,
  },
);

const Room = mongoose.model("Room", RoomSchema);

module.exports = Room;
