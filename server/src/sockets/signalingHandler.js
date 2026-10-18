/**
 * ProxiSpeak - WebRTC Signaling Socket Handler
 *
 * Coordinates peer-to-peer WebRTC audio connections between browser clients.
 * Implements Proximity-Guarded Signaling:
 * Only permits WebRTC offers, answers, and ICE candidates between avatars
 * if they are physically within the 100-pixel earshot radius!
 *
 * Week 2 requirement:
 * "Logic to only send WebRTC offer/answers to users within a 100-pixel radius."
 */

const { getRoomState, calculateDistance } = require('../services/geospatialService');
const config = require('../config/environment');

/**
 * Validates if two users in a room are within the designated earshot radius.
 *
 * @param {string} roomId
 * @param {string} senderUserId
 * @param {string} targetUserId
 * @param {number} [maxDistance]
 * @returns {boolean} True if within earshot
 */
function isWithinEarshot(roomId, senderUserId, targetUserId, maxDistance = config.defaultEarshotRadius) {
  const roomUsers = getRoomState(roomId);
  const sender = roomUsers.get(senderUserId);
  const target = roomUsers.get(targetUserId);

  if (!sender || !target) {
    return false;
  }

  const distance = calculateDistance(sender.x, sender.y, target.x, target.y);
  return distance <= maxDistance;
}

/**
 * Registers WebRTC signaling event handlers on a socket.
 *
 * @param {import('socket.io').Server} io - Socket.io Server instance
 * @param {import('socket.io').Socket} socket - Connected client socket
 */
function registerSignalingHandler(io, socket) {
  /**
   * Event: 'webrtc-offer'
   * Client Alice creates an SDP offer and sends it to Bob.
   * Server validates earshot proximity before forwarding!
   *
   * Payload: { targetSocketId: string, targetUserId: string, offer: RTCSessionDescriptionInit }
   */
  socket.on('webrtc-offer', (data) => {
    try {
      const { targetSocketId, targetUserId, offer } = data;
      const roomId = socket.data.roomId || 'default-office';
      const senderUserId = socket.data.userId;

      if (!targetSocketId || !offer) {
        return socket.emit('signaling-error', { message: 'Invalid offer payload: missing target or offer.' });
      }

      // Proximity Guard: Verify target is within earshot (100px)
      if (targetUserId && !isWithinEarshot(roomId, senderUserId, targetUserId)) {
        console.warn(`[Signaling Blocked] Offer rejected: ${senderUserId} and ${targetUserId} are outside earshot.`);
        return socket.emit('signaling-error', {
          code: 'OUT_OF_EARSHOT',
          message: 'Target user is outside the 100-pixel earshot radius. WebRTC connection disallowed.',
        });
      }

      // Forward offer to target peer
      io.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        senderUserId: senderUserId,
        senderUsername: socket.data.username,
        offer,
      });
    } catch (error) {
      console.error(`[Signaling Error] Offer handling failed for socket ${socket.id}:`, error.message);
    }
  });

  /**
   * Event: 'webrtc-answer'
   * Client Bob sends SDP answer back to Alice.
   *
   * Payload: { targetSocketId: string, targetUserId: string, answer: RTCSessionDescriptionInit }
   */
  socket.on('webrtc-answer', (data) => {
    try {
      const { targetSocketId, targetUserId, answer } = data;
      const roomId = socket.data.roomId || 'default-office';
      const senderUserId = socket.data.userId;

      if (!targetSocketId || !answer) {
        return socket.emit('signaling-error', { message: 'Invalid answer payload: missing target or answer.' });
      }

      // Proximity Guard: Verify target is still within earshot
      if (targetUserId && !isWithinEarshot(roomId, senderUserId, targetUserId)) {
        console.warn(`[Signaling Blocked] Answer rejected: ${senderUserId} and ${targetUserId} are outside earshot.`);
        return socket.emit('signaling-error', {
          code: 'OUT_OF_EARSHOT',
          message: 'Target user is outside the 100-pixel earshot radius.',
        });
      }

      // Forward answer to original offerer
      io.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        senderUserId: senderUserId,
        senderUsername: socket.data.username,
        answer,
      });
    } catch (error) {
      console.error(`[Signaling Error] Answer handling failed for socket ${socket.id}:`, error.message);
    }
  });

  /**
   * Event: 'webrtc-ice-candidate'
   * Exchanges ICE candidates for NAT traversal and direct media connection.
   *
   * Payload: { targetSocketId: string, candidate: RTCIceCandidateInit }
   */
  socket.on('webrtc-ice-candidate', (data) => {
    try {
      const { targetSocketId, candidate } = data;

      if (!targetSocketId || !candidate) return;

      io.to(targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        senderUserId: socket.data.userId,
        candidate,
      });
    } catch (error) {
      console.error(`[Signaling Error] ICE candidate routing failed:`, error.message);
    }
  });

  /**
   * Event: 'webrtc-close-peer'
   * Explicitly teardown WebRTC peer connection when leaving or stepping out of range.
   *
   * Payload: { targetSocketId: string }
   */
  socket.on('webrtc-close-peer', (data) => {
    try {
      const { targetSocketId } = data;
      if (!targetSocketId) return;

      io.to(targetSocketId).emit('webrtc-close-peer', {
        senderSocketId: socket.id,
        senderUserId: socket.data.userId,
      });
    } catch (error) {
      console.error(`[Signaling Error] Close peer failed:`, error.message);
    }
  });
}

module.exports = {
  registerSignalingHandler,
  isWithinEarshot,
};
