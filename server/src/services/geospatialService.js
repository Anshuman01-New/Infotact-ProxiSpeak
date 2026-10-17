/**
 * ProxiSpeak - Geospatial Engine Service
 *
 * Core spatial math, MongoDB $near / $geoWithin query orchestrations,
 * proximity clustering, and real-time earshot transition detection.
 */

const UserLocation = require('../models/UserLocation');
const config = require('../config/environment');

/**
 * Calculates Euclidean 2D distance between two points in Canvas pixel space.
 * Formula: d = sqrt((x2 - x1)^2 + (y2 - y1)^2)
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number} Distance in pixels
 */
function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates relative stereo pan angle (-1.0 to 1.0) and angle in radians
 * between listener (x1, y1) and speaker (x2, y2).
 *
 * Useful for the frontend Web Audio API StereoPannerNode:
 * - -1.0: Full left ear
 * -  0.0: Center
 * - +1.0: Full right ear
 *
 * @param {number} x1 - Listener X
 * @param {number} y1 - Listener Y
 * @param {number} x2 - Speaker X
 * @param {number} y2 - Speaker Y
 * @param {number} [maxPanDistance=100] - Distance at which pan reaches maximum
 * @returns {{ pan: number, angleRad: number, angleDeg: number }}
 */
function calculateStereoPan(x1, y1, x2, y2, maxPanDistance = 100) {
  const dx = x2 - x1;   // horizontal distance between listener and speaker
  const dy = y2 - y1;   // vertical distance between listener and speaker
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;

  // Normalized horizontal pan ratio clamped between -1.0 and 1.0
  const pan = Math.max(-1.0, Math.min(1.0, dx / maxPanDistance));

  return {
    pan,
    angleRad,
    angleDeg,
  };
}

/**
 * Calculates dynamic audio volume attenuation (gain) based on pixel distance.
 * Implements smooth drop-off:
 * - At 0 px -> Volume is 1.0 (100%)
 * - At earshot edge (e.g. 100 px) -> Volume approaches 0.0 (near silent)
 * - Beyond earshot -> Volume is 0.0
 *
 * Model used: Quadratic inverse smooth roll-off (1 - (d / R)^2)
 *
 * @param {number} distance - Distance in pixels
 * @param {number} earshotRadius - Maximum hearing radius in pixels
 * @returns {number} Gain between 0.0 and 1.0
 */
function calculateDistanceGain(distance, earshotRadius = 100) {
  if (distance >= earshotRadius) return 0.0;
  if (distance <= 0) return 1.0;

  // Smooth quadratic roll-off ensures realistic acoustic decay
  const ratio = distance / earshotRadius;
  const gain = Math.max(0.0, 1.0 - Math.pow(ratio, 1.5));
  return Math.round(gain * 1000) / 1000;
}

/**
 * In-memory active spatial state for sub-millisecond fast lookups.
 * Synchronized with MongoDB UserLocation documents.
 * Map: roomId -> Map(userId -> { userId, socketId, username, x, y, earshotRadius, isMuted, isDeafened, lastActive })
 */
const activeRoomSpatialState = new Map();

/**
 * Gets or creates the spatial state map for a room.
 * @param {string} roomId
 * @returns {Map<string, object>}
 */
function getRoomState(roomId) {
  if (!activeRoomSpatialState.has(roomId)) {
    activeRoomSpatialState.set(roomId, new Map());
  }
  return activeRoomSpatialState.get(roomId);
}

/**
 * Updates an avatar's position in memory and persists to MongoDB.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.socketId
 * @param {string} params.roomId
 * @param {number} params.x
 * @param {number} params.y
 * @param {string} [params.username]
 * @param {string} [params.avatarColor]
 * @param {number} [params.earshotRadius]
 * @returns {Promise<object>} Updated avatar record
 */
async function setAvatarPosition({
  userId,
  socketId,
  roomId = 'default-office',
  x,
  y,
  username,
  avatarColor,
  earshotRadius = config.defaultEarshotRadius,
}) {
  const roomUsers = getRoomState(roomId);
  const existing = roomUsers.get(userId) || {};

  const avatar = {
    userId,
    socketId: socketId || existing.socketId,
    roomId,
    username: username || existing.username || 'Guest Avatar',
    avatarColor: avatarColor || existing.avatarColor || '#3B82F6',
    x: Number(x),
    y: Number(y),
    earshotRadius: Number(earshotRadius) || existing.earshotRadius || config.defaultEarshotRadius,
    isMuted: existing.isMuted || false,
    isDeafened: existing.isDeafened || false,
    lastActive: Date.now(),
  };

  roomUsers.set(userId, avatar);

  // Asynchronously persist / upsert to MongoDB (non-blocking for 60fps real-time flow)
  UserLocation.updatePosition(
    userId,
    avatar.socketId,
    roomId,
    avatar.x,
    avatar.y,
    avatar.username,
    avatar.avatarColor
  ).catch((err) => {
    console.error(`[GeospatialService Error] Failed to persist location for user ${userId}:`, err.message);
  });

  return avatar;
}

/**
 * Removes a user from the active spatial state and marks offline in DB.
 *
 * @param {string} roomId
 * @param {string} userId
 */
async function removeAvatar(roomId, userId) {
  if (roomId && activeRoomSpatialState.has(roomId)) {
    activeRoomSpatialState.get(roomId).delete(userId);
    if (activeRoomSpatialState.get(roomId).size === 0) {
      activeRoomSpatialState.delete(roomId);
    }
  }

  // Update in DB
  try {
    await UserLocation.findOneAndUpdate(
      { userId },
      { $set: { isOnline: false, lastActive: new Date() } }
    );
  } catch (err) {
    console.error(`[GeospatialService Error] Failed to set user ${userId} offline:`, err.message);
  }
}

/**
 * Queries MongoDB for avatars within earshot using native MongoDB $near query.
 * Meets the Week 2 requirement: "Implement MongoDB $near queries to group users."
 *
 * @param {string} roomId
 * @param {number} x
 * @param {number} y
 * @param {number} radius - Radius in pixels
 * @param {string} [excludeUserId] - Optional user to exclude
 * @returns {Promise<Array>} List of nearby users from DB
 */
async function queryNearbyFromDB(roomId, x, y, radius = config.defaultEarshotRadius, excludeUserId = null) {
  const startTime = process.hrtime.bigint();

  const results = await UserLocation.findNearbyUsers(roomId, x, y, radius, excludeUserId);

  const endTime = process.hrtime.bigint();
  const latencyMs = Number(endTime - startTime) / 1e6;

  return {
    results,
    latencyMs,
  };
}

/**
 * Finds all active peers within earshot of a given position in memory (ultra-fast).
 * Includes computed distance, stereo pan, and audio volume gain.
 *
 * @param {string} roomId
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} excludeUserId
 * @returns {Array<object>} Nearby peers with spatial audio calculations
 */
function findNearbyPeersInMemory(roomId, x, y, radius = config.defaultEarshotRadius, excludeUserId = null) {
  const roomUsers = getRoomState(roomId);
  const nearby = [];

  for (const [peerId, peer] of roomUsers.entries()) {
    if (peerId === excludeUserId) continue;

    const dist = calculateDistance(x, y, peer.x, peer.y);
    if (dist <= radius) {
      const { pan, angleRad, angleDeg } = calculateStereoPan(x, y, peer.x, peer.y, radius);
      const gain = calculateDistanceGain(dist, radius);

      nearby.push({
        userId: peer.userId,
        socketId: peer.socketId,
        username: peer.username,
        avatarColor: peer.avatarColor,
        x: peer.x,
        y: peer.y,
        distance: Math.round(dist * 10) / 10,
        gain,
        pan: Math.round(pan * 100) / 100,
        angleRad,
        angleDeg: Math.round(angleDeg),
        isMuted: peer.isMuted,
        isDeafened: peer.isDeafened,
      });
    }
  }

  // Sort by closest distance first
  return nearby.sort((a, b) => a.distance - b.distance);
}

/**
 * Computes transition diffs between a user's previous peer earshot set
 * and current nearby peers.
 *
 * Detects:
 * - enteredEarshot: peers who just came within 100px (need WebRTC connection)
 * - leftEarshot: peers who moved beyond 100px (close/pause WebRTC connection)
 * - activeInEarshot: peers remaining within range with updated coordinates
 *
 * @param {Set<string>|Array<string>} previousPeerIds - User IDs previously in earshot
 * @param {Array<object>} currentNearbyPeers - Array of current nearby peer objects
 * @returns {{ entered: Array<object>, left: Array<string>, active: Array<object> }}
 */
function computeEarshotTransitions(previousPeerIds = [], currentNearbyPeers = []) {
  const prevSet = new Set(previousPeerIds);
  const currentSet = new Set(currentNearbyPeers.map((p) => p.userId));

  const entered = currentNearbyPeers.filter((p) => !prevSet.has(p.userId));
  const left = Array.from(prevSet).filter((userId) => !currentSet.has(userId));
  const active = currentNearbyPeers;

  return { entered, left, active };
}

/**
 * Clusters users into physical conversation groups based on proximity.
 * Uses connected component graph clustering: if User A is within threshold of User B,
 * they belong to the same cluster.
 *
 * @param {string} roomId
 * @param {number} [clusterThreshold=100]
 * @returns {Array<Array<object>>} Array of user clusters
 */
function clusterUsersInRoom(roomId, clusterThreshold = config.defaultEarshotRadius) {
  const roomUsers = Array.from(getRoomState(roomId).values());
  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < roomUsers.length; i++) {
    const rootUser = roomUsers[i];
    if (visited.has(rootUser.userId)) continue;

    const cluster = [];
    const queue = [rootUser];
    visited.add(rootUser.userId);

    while (queue.length > 0) {
      const current = queue.shift();
      cluster.push(current);

      for (let j = 0; j < roomUsers.length; j++) {
        const candidate = roomUsers[j];
        if (!visited.has(candidate.userId)) {
          const dist = calculateDistance(current.x, current.y, candidate.x, candidate.y);
          if (dist <= clusterThreshold) {
            visited.add(candidate.userId);
            queue.push(candidate);
          }
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

module.exports = {
  calculateDistance,
  calculateStereoPan,
  calculateDistanceGain,
  setAvatarPosition,
  removeAvatar,
  getRoomState,
  queryNearbyFromDB,
  findNearbyPeersInMemory,
  computeEarshotTransitions,
  clusterUsersInRoom,
};
