/**
 * ProxiSpeak - Audio Occlusion & Obstacle Attenuation Service
 *
 * Implements Week 4 requirement:
 * "Save office layouts and furniture obstacles (which block sound) into MongoDB.
 *  Implement the intended sound-blocking behavior of obstacles."
 *
 * Calculates line-of-sight sound ray obstruction through walls, glass partitions,
 * and furniture obstacles, computing acoustic damping multipliers.
 */

const Room = require('../models/Room');

// In-memory cache for room obstacles to avoid repeated DB lookups during 60 FPS animation/movement
const roomObstacleCache = new Map();

/**
 * Checks if counter-clockwise orientation holds for 3 points (A, B, C).
 */
function ccw(ax, ay, bx, by, cx, cy) {
  return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}

/**
 * Determines whether two 2D line segments (P1-P2 and P3-P4) intersect.
 */
function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  return (
    ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
    ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
  );
}

/**
 * Determines if line segment P1-P2 intersects an axis-aligned rectangle obstacle.
 */
function segmentIntersectsRectangle(x1, y1, x2, y2, rx1, ry1, rx2, ry2) {
  const minX = Math.min(rx1, rx2);
  const maxX = Math.max(rx1, rx2);
  const minY = Math.min(ry1, ry2);
  const maxY = Math.max(ry1, ry2);

  // Check if either endpoint is inside the rectangle
  if ((x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) ||
      (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY)) {
    return true;
  }

  // Check intersection with all 4 bounding edges
  return (
    segmentsIntersect(x1, y1, x2, y2, minX, minY, maxX, minY) || // Top
    segmentsIntersect(x1, y1, x2, y2, maxX, minY, maxX, maxY) || // Right
    segmentsIntersect(x1, y1, x2, y2, maxX, maxY, minX, maxY) || // Bottom
    segmentsIntersect(x1, y1, x2, y2, minX, maxY, minX, minY)    // Left
  );
}

/**
 * Retrieves obstacles for a room, using memory cache if available.
 *
 * @param {string} roomId
 * @returns {Promise<Array>}
 */
async function getRoomObstacles(roomId) {
  if (roomObstacleCache.has(roomId)) {
    return roomObstacleCache.get(roomId);
  }

  const room = await Room.findOne({ roomId }).select('obstacles').lean().exec();
  const obstacles = room && room.obstacles ? room.obstacles : [];
  roomObstacleCache.set(roomId, obstacles);
  return obstacles;
}

/**
 * Invalidates the obstacle cache for a room when room or obstacles change.
 *
 * @param {string} roomId
 */
function invalidateRoomCache(roomId) {
  if (roomId) {
    roomObstacleCache.delete(roomId);
  } else {
    roomObstacleCache.clear();
  }
}

/**
 * Calculates acoustic occlusion between two points in a room.
 *
 * @param {string} roomId
 * @param {number} x1 - Source / Listener X
 * @param {number} y1 - Source / Listener Y
 * @param {number} x2 - Target / Speaker X
 * @param {number} y2 - Target / Speaker Y
 * @returns {Promise<{ isObstructed: boolean, transmissionMultiplier: number, obstructedObstacles: Array }>}
 */
async function calculateSoundOcclusion(roomId, x1, y1, x2, y2) {
  const obstacles = await getRoomObstacles(roomId);

  if (!obstacles || obstacles.length === 0) {
    return {
      isObstructed: false,
      transmissionMultiplier: 1.0,
      obstructedObstacles: [],
    };
  }

  const obstructedObstacles = [];
  let transmissionMultiplier = 1.0;

  for (const obstacle of obstacles) {
    const { coordinates, shape, dampingFactor = 0.8, isSoundProof = false } = obstacle;
    if (!coordinates) continue;

    let intersected = false;

    if (shape === 'rectangle') {
      intersected = segmentIntersectsRectangle(
        x1, y1, x2, y2,
        coordinates.x1, coordinates.y1, coordinates.x2, coordinates.y2
      );
    } else {
      // Default to line segment
      intersected = segmentsIntersect(
        x1, y1, x2, y2,
        coordinates.x1, coordinates.y1, coordinates.x2, coordinates.y2
      );
    }

    if (intersected) {
      obstructedObstacles.push({
        obstacleId: obstacle.obstacleId,
        name: obstacle.name,
        type: obstacle.type,
        dampingFactor,
        isSoundProof,
      });

      if (isSoundProof) {
        transmissionMultiplier = 0.0;
        break; // Completely muted sound cannot penetrate soundproof barrier
      } else {
        const factor = typeof dampingFactor === 'number' ? dampingFactor : 0.8;
        transmissionMultiplier *= Math.max(0.0, 1.0 - factor);
      }
    }
  }

  const roundedMultiplier = Math.round(transmissionMultiplier * 1000) / 1000;

  return {
    isObstructed: obstructedObstacles.length > 0,
    transmissionMultiplier: roundedMultiplier,
    obstructedObstacles,
  };
}

module.exports = {
  calculateSoundOcclusion,
  invalidateRoomCache,
  segmentsIntersect,
  segmentIntersectsRectangle,
};
