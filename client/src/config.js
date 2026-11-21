/**
 * ProxiSpeak Client Configuration
 */

export const CONFIG = {
  // Backend URL (defaults to localhost:5000)
  SERVER_URL: import.meta.env.VITE_SERVER_URL || 'http://localhost:5000',

  // Proximity Earshot Radius in pixels (Project Specification Week 2: 100px)
  DEFAULT_EARSHOT_RADIUS: 100,

  // WebRTC STUN servers for NAT traversal
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],

  // Virtual world bounds default
  WORLD_WIDTH: 2000,
  WORLD_HEIGHT: 1500,

  // Avatar movement speed (pixels per frame at 60 FPS)
  AVATAR_SPEED: 4.5,
};
