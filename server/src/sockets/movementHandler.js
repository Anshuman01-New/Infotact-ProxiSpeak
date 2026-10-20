/**
 * ProxiSpeak - Movement & Proximity Socket Handler
 *
 * Handles avatar movement events, broadcasts coordinate updates to peers,
 * dynamically recalculates spatial earshot relationships (100px radius),
 * and triggers peer-entered-earshot / peer-left-earshot events for WebRTC orchestration.
 *
 * Week 1 requirement: "Build WebSocket server to broadcast avatar X/Y coordinates."
 * Week 2 requirement: "Logic to only send WebRTC offer/answers to users within a 100-pixel radius."
 */

const {
  setAvatarPosition,
  findNearbyPeersInMemory,
  computeEarshotTransitions,
  calculateDistance,
} = require('../services/geospatialService');
const { calculateSoundOcclusion } = require('../services/audioOcclusionService');
const config = require('../config/environment');

/**
 * Tracks peers currently in earshot for each active socket:
 * Map: socketId -> Set(peerUserId)
 */
const socketEarshotMap = new Map();

/**
 * Registers avatar movement and proximity event listeners on a socket.
 *
 * @param {import('socket.io').Server} io - Socket.io Server instance
 * @param {import('socket.io').Socket} socket - Connected client socket
 */
function registerMovementHandler(io, socket) {
  // Initialize user's earshot tracker
  socketEarshotMap.set(socket.id, new Set());

  /**
   * Event: 'player-move'
   * Payload: { x: number, y: number, roomId?: string }
   */
  socket.on('player-move', async (data) => {
    try {
      const { x, y, roomId } = data;
      const activeRoomId = roomId || socket.data.roomId || 'default-office';
      const userId = socket.data.userId || socket.id;
      const username = socket.data.username || 'Avatar';
      const avatarColor = socket.data.avatarColor;

      // Update in-memory spatial cache and asynchronously update MongoDB
      const avatar = await setAvatarPosition({
        userId,
        socketId: socket.id,
        roomId: activeRoomId,
        x,
        y,
        username,
        avatarColor,
        earshotRadius: config.defaultEarshotRadius,
      });

      // 1. Broadcast avatar's visual position to everyone in the room (Canvas rendering)
      socket.to(activeRoomId).emit('player-moved', {
        userId,
        socketId: socket.id,
        username: avatar.username,
        avatarColor: avatar.avatarColor,
        x: avatar.x,
        y: avatar.y,
        isMuted: avatar.isMuted,
        isDeafened: avatar.isDeafened,
      });

      // 2. Proximity calculation for Spatial Audio & WebRTC filtering
      const nearbyPeers = findNearbyPeersInMemory(
        activeRoomId,
        avatar.x,
        avatar.y,
        config.defaultEarshotRadius,
        userId
      );

      // Enhance nearby peers with sound obstacle occlusion damping
      for (const peer of nearbyPeers) {
        const occlusion = await calculateSoundOcclusion(
          activeRoomId,
          avatar.x,
          avatar.y,
          peer.x,
          peer.y
        );
        peer.isObstructed = occlusion.isObstructed;
        peer.occlusionMultiplier = occlusion.transmissionMultiplier;
        // Total effective gain = distance gain * obstacle transmission multiplier
        peer.effectiveGain = Math.round(peer.gain * occlusion.transmissionMultiplier * 1000) / 1000;
      }

      // 3. Evaluate Earshot Transitions (Entering vs Leaving 100px radius)
      const previousPeers = socketEarshotMap.get(socket.id) || new Set();
      const { entered, left, active } = computeEarshotTransitions(
        previousPeers,
        nearbyPeers
      );

      // Update socket's earshot map
      const currentPeerIdSet = new Set(nearbyPeers.map((p) => p.userId));
      socketEarshotMap.set(socket.id, currentPeerIdSet);

      // 4. Notify about newly entered peers (Trigger WebRTC P2P connection handshake)
      for (const newPeer of entered) {
        // Tell moving user to initiate connection to newPeer
        socket.emit('peer-entered-earshot', {
          peerId: newPeer.userId,
          peerSocketId: newPeer.socketId,
          username: newPeer.username,
          distance: newPeer.distance,
          gain: newPeer.effectiveGain,
          pan: newPeer.pan,
          // Initiator convention: lower lexical string id initiates WebRTC offer to avoid glare collision
          isInitiator: userId < newPeer.userId,
        });

        // Also notify the other peer that moving user entered their earshot
        io.to(newPeer.socketId).emit('peer-entered-earshot', {
          peerId: userId,
          peerSocketId: socket.id,
          username: avatar.username,
          distance: newPeer.distance,
          gain: newPeer.effectiveGain,
          pan: -newPeer.pan, // Opposite stereo panning for the listener
          isInitiator: newPeer.userId < userId,
        });
      }

      // 5. Notify about peers who left earshot (Trigger WebRTC connection teardown / mute)
      for (const leftPeerId of left) {
        socket.emit('peer-left-earshot', {
          peerId: leftPeerId,
        });

        // Find left peer's socket if active in room
        const roomPeers = findNearbyPeersInMemory(activeRoomId, 0, 0, 100000);
        const leftPeer = roomPeers.find((p) => p.userId === leftPeerId);
        if (leftPeer) {
          io.to(leftPeer.socketId).emit('peer-left-earshot', {
            peerId: userId,
          });
        }
      }

      // 6. Send continuous proximity & spatial audio telemetry to the moving user
      socket.emit('proximity-update', {
        nearbyPeers: active,
        earshotRadius: config.defaultEarshotRadius,
      });
    } catch (error) {
      console.error(`[MovementHandler Error] Socket ${socket.id}:`, error.message);
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    socketEarshotMap.delete(socket.id);
  });
}

function getSocketEarshot(socketId) {
  return socketEarshotMap.get(socketId) || new Set();
}

module.exports = {
  registerMovementHandler,
  getSocketEarshot,
};
