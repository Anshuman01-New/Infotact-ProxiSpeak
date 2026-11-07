/**
 * ProxiSpeak - Multi-User Real-time Detection & Spatial Movement Tests
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { io: ioClient } = require('socket.io-client');
const app = require('../src/app');
const { initializeSocketServer } = require('../src/sockets');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Multi-User Real-Time Presence & Earshot Tests', () => {
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

  test('Two clients join the same room and successfully detect each other', async () => {
    const roomId = 'multi-user-test-room';

    const clientAlice = ioClient(`http://localhost:${port}`, {
      query: { userId: 'alice_1', username: 'Alice', roomId },
      transports: ['websocket'],
    });

    const clientBob = ioClient(`http://localhost:${port}`, {
      query: { userId: 'bob_2', username: 'Bob', roomId },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((res) => clientAlice.on('connect', res)),
      new Promise((res) => clientBob.on('connect', res)),
    ]);

    // Alice joins room first
    const aliceJoinedPromise = new Promise((resolve) => {
      clientAlice.on('room-state', (data) => {
        assert.strictEqual(data.room.roomId, roomId);
        assert.strictEqual(data.self.userId, 'alice_1');
        assert.strictEqual(data.peers.length, 0); // Alice is alone initially
        resolve(data);
      });
    });

    clientAlice.emit('join-room', {
      roomId,
      username: 'Alice',
      userId: 'alice_1',
      x: 200,
      y: 200,
    });
    await aliceJoinedPromise;

    // Bob now joins room:
    // 1. Bob should receive room-state containing Alice in data.peers
    // 2. Alice should receive 'user-joined' containing Bob
    const bobRoomStatePromise = new Promise((resolve) => {
      clientBob.on('room-state', (data) => {
        assert.strictEqual(data.room.roomId, roomId);
        assert.strictEqual(data.self.userId, 'bob_2');
        assert.strictEqual(data.peers.length, 1);
        assert.strictEqual(data.peers[0].userId, 'alice_1');
        resolve(data);
      });
    });

    const aliceDetectsBobPromise = new Promise((resolve) => {
      clientAlice.on('user-joined', (newPeer) => {
        assert.strictEqual(newPeer.userId, 'bob_2');
        assert.strictEqual(newPeer.username, 'Bob');
        resolve(newPeer);
      });
    });

    clientBob.emit('join-room', {
      roomId,
      username: 'Bob',
      userId: 'bob_2',
      x: 240, // 40px away from Alice -> WITHIN 100px EARSHOT!
      y: 200,
    });

    await Promise.all([bobRoomStatePromise, aliceDetectsBobPromise]);

    // Clean up
    clientAlice.disconnect();
    clientBob.disconnect();
  });
});
