/**
 * ProxiSpeak - WebRTC Signaling & Mesh Filtering Tests
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { io: ioClient } = require('socket.io-client');
const app = require('../src/app');
const { initializeSocketServer } = require('../src/sockets');
const { connectDB, disconnectDB } = require('../src/config/db');
const { setAvatarPosition } = require('../src/services/geospatialService');
const { isWithinEarshot } = require('../src/sockets/signalingHandler');

describe('WebRTC Proximity-Guarded Signaling Tests', () => {
  let server;
  let socketServer;
  let port;

  before(async () => {
    await connectDB();
    server = http.createServer(app);
    socketServer = await initializeSocketServer(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (socketServer) socketServer.close();
    if (server) server.close();
    await disconnectDB();
  });

  test('isWithinEarshot returns true only when within 100px radius', async () => {
    const roomId = 'earshot-test-room';

    // Alice at (100, 100)
    await setAvatarPosition({ userId: 'alice', socketId: 'sock1', roomId, x: 100, y: 100 });
    // Bob at (150, 100) -> distance = 50px (Within earshot)
    await setAvatarPosition({ userId: 'bob', socketId: 'sock2', roomId, x: 150, y: 100 });
    // Charlie at (300, 100) -> distance = 200px (Outside earshot)
    await setAvatarPosition({ userId: 'charlie', socketId: 'sock3', roomId, x: 300, y: 100 });

    assert.strictEqual(isWithinEarshot(roomId, 'alice', 'bob', 100), true);
    assert.strictEqual(isWithinEarshot(roomId, 'alice', 'charlie', 100), false);
  });

  test('Signaling server only forwards WebRTC offer if target is within earshot', async () => {
    const clientA = ioClient(`http://localhost:${port}`, {
      query: { userId: 'alice', roomId: 'test-signaling-room' },
      transports: ['websocket'],
    });

    const clientB = ioClient(`http://localhost:${port}`, {
      query: { userId: 'bob', roomId: 'test-signaling-room' },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((res) => clientA.on('connect', res)),
      new Promise((res) => clientB.on('connect', res)),
    ]);

    const joinedPromise = Promise.all([
      new Promise((resolve) => clientA.once('room-state', resolve)),
      new Promise((resolve) => clientB.once('room-state', resolve)),
    ]);

    // Position Alice at (100, 100) and Bob at (140, 100) -> dist = 40px (within 100px earshot)
    clientA.emit('join-room', { roomId: 'test-signaling-room', x: 100, y: 100 });
    clientB.emit('join-room', { roomId: 'test-signaling-room', x: 140, y: 100 });

    await joinedPromise;

    // Alice sends WebRTC offer to Bob
    const offerReceivedPromise = new Promise((resolve) => {
      clientB.on('webrtc-offer', (data) => {
        assert.strictEqual(data.senderUserId, 'alice');
        assert.strictEqual(data.offer.sdp, 'mock-sdp-offer');
        resolve();
      });
    });

    clientA.emit('webrtc-offer', {
      targetSocketId: clientB.id,
      targetUserId: 'bob',
      offer: { type: 'offer', sdp: 'mock-sdp-offer' },
    });

    await offerReceivedPromise;

    // Now move Bob far away to (600, 600) -> dist > 500px (outside earshot)
    const bobMovedPromise = new Promise((resolve) => clientA.once('player-moved', resolve));
    clientB.emit('player-move', { x: 600, y: 600, roomId: 'test-signaling-room' });
    await bobMovedPromise;

    // Alice attempts to send offer again, server should reject it with OUT_OF_EARSHOT
    const signalingErrorPromise = new Promise((resolve) => {
      clientA.on('signaling-error', (err) => {
        assert.strictEqual(err.code, 'OUT_OF_EARSHOT');
        resolve();
      });
    });

    clientA.emit('webrtc-offer', {
      targetSocketId: clientB.id,
      targetUserId: 'bob',
      offer: { type: 'offer', sdp: 'mock-sdp-offer-2' },
    });

    await signalingErrorPromise;

    clientA.disconnect();
    clientB.disconnect();
  });
});
