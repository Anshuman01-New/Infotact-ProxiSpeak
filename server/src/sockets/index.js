/**
 * ProxiSpeak - Socket.io Server Master Hub
 *
 * Orchestrates client connection lifecycle, room admission, user presence,
 * and delegates movement and WebRTC signaling to modular handlers.
 */

const { Server } = require('socket.io');
const config = require('../config/environment');
const { setupRedisAdapter } = require('../config/redis');
const { registerMovementHandler } = require('./movementHandler');
const { registerSignalingHandler } = require('./signalingHandler');
const {
  setAvatarPosition,
  removeAvatar,
  getRoomState,
} = require('../services/geospatialService');
const Room = require('../models/Room');

/**
 * Initializes and configures the Socket.io server with CORS and Redis adapter.
 *
 * @param {import('http').Server} httpServer
 * @returns {Promise<import('socket.io').Server>}
 */
async function initializeSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Heartbeat configuration for responsive disconnect detection
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Attach Redis Pub/Sub adapter if enabled (Week 3 requirement)
  await setupRedisAdapter(io);

  io.on('connection', (socket) => {
    // Extract query parameters if passed during socket connection
    const { userId, username, avatarColor, roomId } = socket.handshake.query;

    socket.data.userId = userId || `user_${socket.id.substring(0, 6)}`;
    socket.data.username = username || 'Guest Avatar';
    socket.data.avatarColor = avatarColor || '#3B82F6';
    socket.data.roomId = roomId || 'default-office';

    console.log(
      `[Socket Connect] User "${socket.data.username}" (${socket.data.userId}) connected on socket ${socket.id}`
    );

    /**
     * Event: 'join-room'
     * Client requests to enter a specific virtual office room.
     * Payload: { roomId?: string, username?: string, avatarColor?: string, x?: number, y?: number }
     */
    socket.on('join-room', async (payload = {}) => {
      try {
        const targetRoomId = payload.roomId || socket.data.roomId || 'default-office';
        const initialX = typeof payload.x === 'number' ? payload.x : 300;
        const initialY = typeof payload.y === 'number' ? payload.y : 300;

        if (payload.username) socket.data.username = payload.username;
        if (payload.avatarColor) socket.data.avatarColor = payload.avatarColor;
        socket.data.roomId = targetRoomId;

        // Join Socket.io room channel
        await socket.join(targetRoomId);

        // Atomically fetch or create default room record
        const roomDoc = await Room.findOneAndUpdate(
          { roomId: targetRoomId },
          {
            $setOnInsert: {
              roomId: targetRoomId,
              name: 'Main Virtual Office',
              width: 2000,
              height: 1500,
              spawnPoint: { x: initialX, y: initialY },
              obstacles: [],
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean().exec();

        // Register initial position in spatial cache and MongoDB
        const avatar = await setAvatarPosition({
          userId: socket.data.userId,
          socketId: socket.id,
          roomId: targetRoomId,
          x: initialX,
          y: initialY,
          username: socket.data.username,
          avatarColor: socket.data.avatarColor,
        });

        // Collect existing avatars in the room for the joining user
        const roomUsers = Array.from(getRoomState(targetRoomId).values());

        // Send current room state to joining client
        socket.emit('room-state', {
          room: {
            roomId: roomDoc.roomId,
            name: roomDoc.name,
            width: roomDoc.width,
            height: roomDoc.height,
            obstacles: roomDoc.obstacles,
          },
          self: avatar,
          peers: roomUsers.filter((u) => u.userId !== socket.data.userId),
        });

        // Broadcast to other users in the room that a new avatar joined
        socket.to(targetRoomId).emit('user-joined', {
          userId: avatar.userId,
          socketId: socket.id,
          username: avatar.username,
          avatarColor: avatar.avatarColor,
          x: avatar.x,
          y: avatar.y,
          isMuted: avatar.isMuted,
          isDeafened: avatar.isDeafened,
        });

        console.log(`[Room Join] User "${avatar.username}" entered room "${targetRoomId}" at (${avatar.x}, ${avatar.y})`);
      } catch (err) {
        console.error(`[Join Room Error] Socket ${socket.id}:`, err.message);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * Event: 'update-audio-state'
     * Toggles mute/deafen status for the user.
     * Payload: { isMuted?: boolean, isDeafened?: boolean }
     */
    socket.on('update-audio-state', async (data) => {
      const roomUsers = getRoomState(socket.data.roomId);
      const user = roomUsers.get(socket.data.userId);

      if (user) {
        if (typeof data.isMuted === 'boolean') user.isMuted = data.isMuted;
        if (typeof data.isDeafened === 'boolean') user.isDeafened = data.isDeafened;

        io.to(socket.data.roomId).emit('user-audio-state-changed', {
          userId: socket.data.userId,
          isMuted: user.isMuted,
          isDeafened: user.isDeafened,
        });
      }
    });

    // Delegate movement and signaling to dedicated handlers
    registerMovementHandler(io, socket);
    registerSignalingHandler(io, socket);

    /**
     * Disconnection handling
     */
    socket.on('disconnect', async (reason) => {
      const { userId, roomId, username } = socket.data;
      console.log(`[Socket Disconnect] User "${username}" (${userId}) left: ${reason}`);

      if (roomId && userId) {
        // Remove from spatial engine and update DB
        await removeAvatar(roomId, userId);

        // Notify remaining peers in the room
        io.to(roomId).emit('user-left', {
          userId,
          socketId: socket.id,
        });
      }
    });
  });

  return io;
}

module.exports = {
  initializeSocketServer,
};
