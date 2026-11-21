/**
 * ProxiSpeak - Client Geometric & Spatial Calculations
 */

/**
 * Calculates Euclidean 2D distance between two points in Canvas pixel space.
 * Formula: d = sqrt((x2 - x1)^2 + (y2 - y1)^2)
 */
export function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates relative stereo pan angle (-1.0 to 1.0) and angle in radians
 * between listener (x1, y1) and speaker (x2, y2).
 *
 * -1.0 = Full Left Ear
 *  0.0 = Center
 * +1.0 = Full Right Ear
 */
export function calculateStereoPan(x1, y1, x2, y2, maxPanDistance = 100) {
  const dx = x2 - x1; // Horizontal offset
  const dy = y2 - y1; // Vertical offset
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;

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
 * - At earshot edge (e.g. 100 px) -> Volume approaches 0.0
 * - Beyond earshot -> Volume is 0.0
 */
export function calculateDistanceGain(distance, earshotRadius = 100) {
  if (distance >= earshotRadius) return 0.0;
  if (distance <= 0) return 1.0;

  const ratio = distance / earshotRadius;
  const gain = Math.max(0.0, 1.0 - Math.pow(ratio, 1.5));
  return Math.round(gain * 1000) / 1000;
}

/**
 * Checks counter-clockwise orientation for 3 points.
 */
function ccw(ax, ay, bx, by, cx, cy) {
  return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}

/**
 * Checks if two line segments (P1-P2 and P3-P4) intersect.
 */
export function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  return (
    ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
    ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
  );
}

/**
 * Checks if line segment intersects a rectangle.
 */
export function segmentIntersectsRectangle(x1, y1, x2, y2, rx1, ry1, rx2, ry2) {
  const minX = Math.min(rx1, rx2);
  const maxX = Math.max(rx1, rx2);
  const minY = Math.min(ry1, ry2);
  const maxY = Math.max(ry1, ry2);

  if ((x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) ||
      (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY)) {
    return true;
  }

  return (
    segmentsIntersect(x1, y1, x2, y2, minX, minY, maxX, minY) ||
    segmentsIntersect(x1, y1, x2, y2, maxX, minY, maxX, maxY) ||
    segmentsIntersect(x1, y1, x2, y2, maxX, maxY, minX, maxY) ||
    segmentsIntersect(x1, y1, x2, y2, minX, maxY, minX, minY)
  );
}

/**
 * Computes acoustic obstruction and damping factor through obstacles in client.
 */
export function calculateClientOcclusion(obstacles, x1, y1, x2, y2) {
  if (!obstacles || obstacles.length === 0) {
    return { isObstructed: false, transmissionMultiplier: 1.0, obstructedObstacles: [] };
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
      intersected = segmentsIntersect(
        x1, y1, x2, y2,
        coordinates.x1, coordinates.y1, coordinates.x2, coordinates.y2
      );
    }

    if (intersected) {
      obstructedObstacles.push(obstacle);
      if (isSoundProof) {
        transmissionMultiplier = 0.0;
        break;
      } else {
        const factor = typeof dampingFactor === 'number' ? dampingFactor : 0.8;
        transmissionMultiplier *= Math.max(0.0, 1.0 - factor);
      }
    }
  }

  return {
    isObstructed: obstructedObstacles.length > 0,
    transmissionMultiplier: Math.round(transmissionMultiplier * 1000) / 1000,
    obstructedObstacles,
  };
}
