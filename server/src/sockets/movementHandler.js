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
    //Add the actual code later
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
