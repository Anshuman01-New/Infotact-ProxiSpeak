/**
 * ProxiSpeak - UserLocation Model
 *
 * Persists real-time avatar coordinates and user state in MongoDB.
 * Utilizes MongoDB's geospatial 2D indexing for ultra-fast proximity queries
 * ($near, $geoWithin) to calculate user earshot clusters in a 2D canvas space.
 */

const mongoose = require('mongoose');

const UserLocationSchema = new mongoose.Schema(
  {
    // Unique identifier for the user (can match auth ID or client session ID)
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Current active Socket.io connection ID for WebRTC signaling routing
    socketId: {
      type: String,
      required: true,
      index: true,
    },

    // Display name of the user in the virtual office
    username: {
      type: String,
      required: true,
      trim: true,
      default: 'Guest Avatar',
    },

    // Avatar color / appearance representation (e.g. hex color for Canvas rendering)
    avatarColor: {
      type: String,
      default: '#3B82F6', // Blue default
    },

    // Room / Office space ID where the user is currently located
    roomId: {
      type: String,
      required: true,
      index: true,
      default: 'default-office',
    },

    /**
     * 2D Geospatial Coordinates [x, y]
     * In MongoDB, a '2d' index indexes points on a flat Euclidean 2D plane,
     * which perfectly matches HTML5 Canvas pixel space (x: horizontal, y: vertical).
     */
    location: {
      type: [Number], // Stored as [x, y]
      required: true,
      default: [0, 0],
    },

    // Redundant raw fields for direct JSON serialization and rapid math access
    rawX: {
      type: Number,
      required: true,
      default: 0,
    },
    rawY: {
      type: Number,
      required: true,
      default: 0,
    },

    // Individual user earshot radius in pixels (default 100px as per project specification)
    earshotRadius: {
      type: Number,
      default: 100,
      min: 10,
      max: 1000,
    },

    // Audio states for UI indicators & spatial audio mixer
    isMuted: {
      type: Boolean,
      default: false,
    },
    isDeafened: {
      type: Boolean,
      default: false,
    },

    // Online presence status
    isOnline: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Last activity timestamp for cleanup of stale sessions
    lastActive: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const UserLocation = mongoose.model('UserLocation', UserLocationSchema);

module.exports = UserLocation;
