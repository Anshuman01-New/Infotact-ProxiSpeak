/**
 * ProxiSpeak - Socket.io Client Service
 *
 * Robust WebSocket client with:
 * - Dynamic event dispatching (listeners can be registered before or after connection)
 * - Automatic join-room dispatch on connect & reconnect
 * - Connection status telemetry and error propagation
 */

import { io } from 'socket.io-client';
import { CONFIG } from '../config';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.joinPayload = null;
    this.connectionState = 'disconnected'; // 'connecting', 'connected', 'disconnected', 'error'
  }

  /**
   * Connect to the Socket.io server with user metadata.
   */
  connect({ userId, username, avatarColor, roomId, x = 350, y = 350 }) {
    if (this.socket) {
      this.disconnect();
    }

    this.joinPayload = {
      userId,
      username,
      avatarColor,
      roomId: roomId || 'default-office',
      x,
      y,
    };

    this.connectionState = 'connecting';
    this._emitInternal('connection-status', { status: 'connecting' });

    console.log(`[Socket] Connecting to backend at: ${CONFIG.SERVER_URL}...`);

    this.socket = io(CONFIG.SERVER_URL, {
      query: {
        userId,
        username,
        avatarColor,
        roomId: this.joinPayload.roomId,
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    // Capture ALL incoming server events and forward to registered listeners
    this.socket.onAny((event, ...args) => {
      console.log(`[Socket Received Event] "${event}":`, args[0]);
      this._emitInternal(event, ...args);
    });

    this.socket.on('connect', () => {
      this.connectionState = 'connected';
      console.log(`[Socket] Connected successfully! Socket ID: ${this.socket.id}`);

      // Auto-send join-room event with user coordinates
      if (this.joinPayload) {
        console.log('[Socket] Sending join-room payload to server:', this.joinPayload);
        this.socket.emit('join-room', this.joinPayload);
      }

      this._emitInternal('connect', this.socket.id);
      this._emitInternal('connection-status', { status: 'connected', socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      this.connectionState = 'disconnected';
      console.warn(`[Socket] Disconnected from server: ${reason}`);
      this._emitInternal('disconnect', reason);
      this._emitInternal('connection-status', { status: 'disconnected', reason });
    });

    this.socket.on('connect_error', (error) => {
      this.connectionState = 'error';
      console.error(`[Socket] Connection error to ${CONFIG.SERVER_URL}:`, error.message);
      this._emitInternal('connect_error', error);
      this._emitInternal('connection-status', {
        status: 'error',
        message: `Cannot reach backend at ${CONFIG.SERVER_URL}. Is the server running?`,
      });
    });

    return this.socket;
  }

  /**
   * Request to join a specific room.
   */
  joinRoom(payload) {
    this.joinPayload = { ...this.joinPayload, ...payload };
    if (this.socket && this.socket.connected) {
      console.log('[Socket] Emitting join-room:', this.joinPayload);
      this.socket.emit('join-room', this.joinPayload);
    }
  }

  /**
   * Send avatar movement update.
   */
  sendMovement({ x, y, roomId }) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('player-move', { x, y, roomId });
  }

  /**
   * Send audio mute/deafen status change.
   */
  sendAudioState({ isMuted, isDeafened }) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('update-audio-state', { isMuted, isDeafened });
  }

  /**
   * Send WebRTC SDP Offer.
   */
  sendWebRTCOffer({ targetSocketId, targetUserId, offer }) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('webrtc-offer', { targetSocketId, targetUserId, offer });
  }

  /**
   * Send WebRTC SDP Answer.
   */
  sendWebRTCAnswer({ targetSocketId, targetUserId, answer }) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('webrtc-answer', { targetSocketId, targetUserId, answer });
  }

  /**
   * Send WebRTC ICE Candidate.
   */
  sendIceCandidate({ targetSocketId, candidate }) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('webrtc-ice-candidate', { targetSocketId, candidate });
  }

  /**
   * Send WebRTC Close Peer notification.
   */
  sendClosePeer({ targetSocketId }) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('webrtc-close-peer', { targetSocketId });
  }

  /**
   * Register an event listener.
   * Can be called anytime, even before connect().
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove an event listener.
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  _emitInternal(event, ...args) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[Socket Listener Error] on "${event}":`, err);
        }
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionState = 'disconnected';
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }

  isConnected() {
    return Boolean(this.socket && this.socket.connected);
  }
}

export const socketService = new SocketService();
