/**
 * ProxiSpeak - Audio Occlusion & Obstacle Attenuation Tests
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  segmentsIntersect,
  segmentIntersectsRectangle,
  calculateSoundOcclusion,
  invalidateRoomCache,
} = require('../src/services/audioOcclusionService');
const Room = require('../src/models/Room');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Audio Occlusion Service Unit Tests', () => {
  test('segmentsIntersect correctly detects crossing line segments', () => {
    // Crossing segments: (0, 5) to (10, 5) and (5, 0) to (5, 10)
    assert.strictEqual(segmentsIntersect(0, 5, 10, 5, 5, 0, 5, 10), true);

    // Parallel non-intersecting segments
    assert.strictEqual(segmentsIntersect(0, 0, 10, 0, 0, 5, 10, 5), false);

    // Disjoint segments
    assert.strictEqual(segmentsIntersect(0, 0, 2, 2, 5, 5, 8, 8), false);
  });

  test('segmentIntersectsRectangle detects ray passing through rectangle', () => {
    const rx1 = 10, ry1 = 10, rx2 = 50, ry2 = 50;

    // Line from (0, 25) to (60, 25) passes through middle of rectangle
    assert.strictEqual(segmentIntersectsRectangle(0, 25, 60, 25, rx1, ry1, rx2, ry2), true);

    // Line completely outside to the right
    assert.strictEqual(segmentIntersectsRectangle(70, 0, 70, 60, rx1, ry1, rx2, ry2), false);

    // Endpoint inside the rectangle
    assert.strictEqual(segmentIntersectsRectangle(20, 20, 100, 100, rx1, ry1, rx2, ry2), true);
  });
});
