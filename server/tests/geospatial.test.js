/**
 * ProxiSpeak - Geospatial Calculation & Query Tests
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const UserLocation = require('../src/models/UserLocation');
const {
  calculateDistance,
  calculateStereoPan,
  calculateDistanceGain,
  computeEarshotTransitions,
  queryNearbyFromDB,
} = require('../src/services/geospatialService');

describe('Geospatial Service Unit & DB Tests', () => {
  before(async () => {
    await connectDB();
    await UserLocation.syncIndexes();
    await UserLocation.deleteMany({ roomId: 'test-geo-room' });
  });

  after(async () => {
    await UserLocation.deleteMany({ roomId: 'test-geo-room' });
    await disconnectDB();
  });

  test('calculateDistance matches Euclidean 2D formula from project specification', () => {
    // Project PDF Example (Page 5): Alice (100, 100), Bob (300, 200) -> ~223.6 px
    const dist = calculateDistance(100, 100, 300, 200);
    assert.strictEqual(Math.round(dist * 10) / 10, 223.6);

    // 0 distance
    assert.strictEqual(calculateDistance(50, 50, 50, 50), 0);

    // Standard 3-4-5 triangle: (0,0) to (30, 40) = 50
    assert.strictEqual(calculateDistance(0, 0, 30, 40), 50);
  });

  test('calculateDistanceGain produces smooth acoustic drop-off', () => {
    // At 0 px -> 1.0 (100% volume)
    assert.strictEqual(calculateDistanceGain(0, 100), 1.0);

    // At 100 px (earshot edge) -> 0.0
    assert.strictEqual(calculateDistanceGain(100, 100), 0.0);

    // Beyond earshot -> 0.0
    assert.strictEqual(calculateDistanceGain(150, 100), 0.0);

    // Halfway (50 px) -> gain is between 0 and 1
    const midGain = calculateDistanceGain(50, 100);
    assert.ok(midGain > 0.4 && midGain < 0.8, `Expected mid gain around 0.65, got ${midGain}`);
  });

  test('calculateStereoPan correctly pans audio left (-1.0) and right (+1.0)', () => {
    // Speaker is directly to the right of listener
    const right = calculateStereoPan(100, 100, 200, 100, 100);
    assert.strictEqual(right.pan, 1.0);

    // Speaker is directly to the left of listener
    const left = calculateStereoPan(200, 100, 100, 100, 100);
    assert.strictEqual(left.pan, -1.0);

    // Speaker is directly in front/behind (center)
    const center = calculateStereoPan(100, 100, 100, 150, 100);
    assert.strictEqual(center.pan, 0);
  });

  test('computeEarshotTransitions correctly detects entered and left peers', () => {
    const previous = ['user_1', 'user_2'];
    const current = [
      { userId: 'user_2', distance: 60 },
      { userId: 'user_3', distance: 40 },
    ];

    const { entered, left, active } = computeEarshotTransitions(previous, current);

    // user_3 entered
    assert.strictEqual(entered.length, 1);
    assert.strictEqual(entered[0].userId, 'user_3');

    // user_1 left
    assert.deepStrictEqual(left, ['user_1']);

    // active contains user_2 and user_3
    assert.strictEqual(active.length, 2);
  });

  test('MongoDB 2D geospatial $near query retrieves users within 100px radius', async () => {
    const roomId = 'test-geo-room';

    // Insert user A at (100, 100) and user B at (150, 100) [dist = 50px -> inside]
    // and user C at (300, 300) [dist > 200px -> outside]
    await UserLocation.create([
      {
        userId: 'u_test_a',
        socketId: 'sock_a',
        roomId,
        location: [100, 100],
        rawX: 100,
        rawY: 100,
        isOnline: true,
      },
      {
        userId: 'u_test_b',
        socketId: 'sock_b',
        roomId,
        location: [150, 100],
        rawX: 150,
        rawY: 100,
        isOnline: true,
      },
      {
        userId: 'u_test_c',
        socketId: 'sock_c',
        roomId,
        location: [300, 300],
        rawX: 300,
        rawY: 300,
        isOnline: true,
      },
    ]);

    // Warm-up query to initialize MongoDB driver cursor and connection pool
    await queryNearbyFromDB(roomId, 100, 100, 100, 'u_test_a');

    // Query from (100, 100) with 100px radius, excluding user A
    const { results, latencyMs } = await queryNearbyFromDB(roomId, 100, 100, 100, 'u_test_a');

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].userId, 'u_test_b');
    assert.ok(latencyMs < 20.0, `Database query latency (${latencyMs}ms) must be under 20ms`);
  });
});
