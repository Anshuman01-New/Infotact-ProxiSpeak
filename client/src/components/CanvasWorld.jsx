/**
 * ProxiSpeak - 2D Virtual World Canvas Component
 *
 * Implements Week 1 & Week 4 requirements with high visual polish:
 * - High-performance HTML5 Canvas rendering engine (Week 1)
 * - Smooth keyboard (WASD / Arrow keys) and mouse navigation (Week 1)
 * - Steady 60 FPS animation loop with delta-time interpolation (Week 4)
 * - 100-pixel Earshot Radius visualization ring with ethereal aura
 * - Real-time acoustic ray-casting laser with animated sound particles
 * - Detailed architectural office floor (desks, conference rooms, soundproof booth, plants)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CONFIG } from '../config';
import { calculateDistance, calculateClientOcclusion } from '../utils/geometry';
import { getInitials, hexToRgba } from '../utils/colors';

export default function CanvasWorld({
  self,
  peers,
  room,
  isSpeaking,
  onMove,
  showEarshotRadius = true,
  onSelectPeer,
  navigateTo = null,   // { x, y } set by parent (e.g. "Walk to" in UserList)
}) {
  const canvasRef = useRef(null);

  // Position state with smooth interpolation
  const posRef = useRef({ x: self?.x || 300, y: self?.y || 300 });
  const targetPosRef = useRef({ x: self?.x || 300, y: self?.y || 300 });
  const keysPressedRef = useRef(new Set());
  const mouseTargetRef = useRef(null);
  const selfRef = useRef(self);
  selfRef.current = self;

  // Animation & FPS telemetry
  const fpsRef = useRef(60);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());
  const [fps, setFps] = useState(60);

  // Sync initial self position on first join only (userId dependency)
  useEffect(() => {
    if (self) {
      targetPosRef.current = { x: self.x, y: self.y };
      if (calculateDistance(posRef.current.x, posRef.current.y, self.x, self.y) > 200) {
        posRef.current = { x: self.x, y: self.y };
      }
    }
  }, [self?.userId]);

  // "Walk to" navigation: when parent sets navigateTo, tell the canvas to walk there.
  // We set mouseTargetRef so the existing movement loop smoothly drives the avatar
  // to the destination — identical to what happens when the user clicks on the canvas.
  useEffect(() => {
    if (navigateTo && selfRef.current) {
      mouseTargetRef.current = { x: navigateTo.x, y: navigateTo.y };
      // Clear any held keyboard keys so they don't interfere
      keysPressedRef.current.clear();
    }
  }, [navigateTo]);

  // Handle Keyboard Input safely without intercepting input fields
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Never intercept keystrokes when user is typing in form inputs, textareas, or modals
      if (
        e.target &&
        (e.target.tagName === 'INPUT' ||
         e.target.tagName === 'TEXTAREA' ||
         e.target.tagName === 'SELECT' ||
         e.target.isContentEditable ||
         e.target.closest('input, textarea, select, [contenteditable="true"], form, [role="dialog"]'))
      ) {
        return;
      }

      // If user hasn't joined the virtual world yet, do not capture keys
      if (!selfRef.current) return;

      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        keysPressedRef.current.add(key);
        mouseTargetRef.current = null; // Keyboard overrides mouse click
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      keysPressedRef.current.delete(key);
    };

    const handleBlur = () => {
      // Clear keys when window or tab loses focus (prevents stuck keys when switching browser tabs)
      keysPressedRef.current.clear();
      mouseTargetRef.current = null;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Handle Mouse Click/Drag Destination
  const handleCanvasMouseDown = useCallback((e) => {
    // Only process clicks if user has joined
    if (!selfRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const clickScreenX = e.clientX - rect.left;
    const clickScreenY = e.clientY - rect.top;

    const cameraX = posRef.current.x - canvas.width / 2;
    const cameraY = posRef.current.y - canvas.height / 2;

    const worldX = Math.max(25, Math.min(CONFIG.WORLD_WIDTH - 25, clickScreenX + cameraX));
    const worldY = Math.max(25, Math.min(CONFIG.WORLD_HEIGHT - 25, clickScreenY + cameraY));

    // Check if clicked directly on a peer avatar
    const clickedPeer = peers.find((p) => calculateDistance(worldX, worldY, p.x, p.y) <= 30);
    if (clickedPeer && onSelectPeer) {
      onSelectPeer(clickedPeer);
    }

    mouseTargetRef.current = { x: worldX, y: worldY };
  }, [peers, onSelectPeer]);

  // Keep refs for 60 FPS renderLoop
  const peersRef = useRef(peers);
  peersRef.current = peers;
  const roomRef = useRef(room);
  roomRef.current = room;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const showEarshotRef = useRef(showEarshotRadius);
  showEarshotRef.current = showEarshotRadius;

  // Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let lastBroadcast = 0;
    let lastTime = performance.now();

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const renderLoop = (currentTime) => {
      const deltaTime = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // 1. Calculate FPS
      frameCountRef.current++;
      if (currentTime - lastFpsUpdateRef.current >= 500) {
        const measuredFps = Math.round((frameCountRef.current * 1000) / (currentTime - lastFpsUpdateRef.current));
        fpsRef.current = measuredFps;
        setFps(measuredFps);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = currentTime;
      }

      // 2. Handle Movement Logic
      const speed = CONFIG.AVATAR_SPEED * 60 * deltaTime;
      let dx = 0;
      let dy = 0;

      const keys = keysPressedRef.current;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;

      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      if (dx !== 0 || dy !== 0) {
        posRef.current.x += dx * speed;
        posRef.current.y += dy * speed;
        mouseTargetRef.current = null;
      } else if (mouseTargetRef.current) {
        const dist = calculateDistance(posRef.current.x, posRef.current.y, mouseTargetRef.current.x, mouseTargetRef.current.y);
        if (dist > 3) {
          const angle = Math.atan2(mouseTargetRef.current.y - posRef.current.y, mouseTargetRef.current.x - posRef.current.x);
          const step = Math.min(dist, speed);
          posRef.current.x += Math.cos(angle) * step;
          posRef.current.y += Math.sin(angle) * step;
        } else {
          mouseTargetRef.current = null;
        }
      }

      // Constrain within office dimensions
      const currentRoom = roomRef.current;
      const worldW = currentRoom?.width || CONFIG.WORLD_WIDTH;
      const worldH = currentRoom?.height || CONFIG.WORLD_HEIGHT;
      posRef.current.x = Math.max(25, Math.min(worldW - 25, posRef.current.x));
      posRef.current.y = Math.max(25, Math.min(worldH - 25, posRef.current.y));

      // Broadcast position to server throttled to 30 updates/sec
      if (currentTime - lastBroadcast > 33) {
        const moved = calculateDistance(posRef.current.x, posRef.current.y, targetPosRef.current.x, targetPosRef.current.y) > 0.5;
        if (moved) {
          targetPosRef.current = { x: Math.round(posRef.current.x), y: Math.round(posRef.current.y) };
          onMove(targetPosRef.current.x, targetPosRef.current.y);
          lastBroadcast = currentTime;
        }
      }

      // 3. Render Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Camera view coordinates (centered on self avatar)
      const camX = posRef.current.x - canvas.width / 2;
      const camY = posRef.current.y - canvas.height / 2;

      ctx.save();
      ctx.translate(-camX, -camY);

      const currentPeers = peersRef.current || [];
      const currentSpeaking = isSpeakingRef.current;
      const currentShowEarshot = showEarshotRef.current;

      // Render Virtual Office World
      drawOfficeFloor(ctx, worldW, worldH);
      drawOfficeArchitecture(ctx);
      drawObstacles(ctx, currentRoom?.obstacles || []);

      // Draw acoustic connection lines and particles to nearby peers in earshot
      drawAcousticBeams(ctx, posRef.current, currentPeers, currentRoom?.obstacles || [], currentTime);

      // Draw remote peers
      for (const peer of currentPeers) {
        drawAvatar(ctx, peer, false, false, currentTime);
      }

      // Self avatar
      const selfAvatar = {
        userId: selfRef.current?.userId || 'self',
        username: selfRef.current?.username || 'You',
        avatarColor: selfRef.current?.avatarColor || '#3B82F6',
        x: posRef.current.x,
        y: posRef.current.y,
        isMuted: selfRef.current?.isMuted || false,
        isDeafened: selfRef.current?.isDeafened || false,
      };

      // Draw 100px Earshot Radius aura around self
      if (currentShowEarshot) {
        drawEarshotCircle(ctx, selfAvatar.x, selfAvatar.y, CONFIG.DEFAULT_EARSHOT_RADIUS, currentTime);
      }

      // Draw self avatar
      drawAvatar(ctx, selfAvatar, true, currentSpeaking, currentTime);

      // Draw mouse destination pin
      if (mouseTargetRef.current) {
        drawTargetMarker(ctx, mouseTargetRef.current.x, mouseTargetRef.current.y, currentTime);
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [onMove]);

  // --- Visual Floor & Architectural Rendering ---

  function drawOfficeFloor(ctx, width, height) {
    // Rich modern dark background
    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 0, width, height);

    // Subtle architect grid (60px tiles)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = 0; x <= width; x += 60) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 60) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Outer office structural perimeter
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, width, height);
  }

  function drawOfficeArchitecture(ctx) {
    // 1. Conference Room A Zone (Glass Meeting Room)
    ctx.fillStyle = 'rgba(6, 182, 212, 0.04)';
    ctx.fillRect(500, 200, 400, 300);

    // Conference Table
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#0EA5E9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(620, 310, 160, 80, 24);
    ctx.fill();
    ctx.stroke();

    // Table Chairs
    ctx.fillStyle = '#475569';
    [650, 700, 750].forEach((cx) => {
      ctx.beginPath();
      ctx.arc(cx, 295, 8, 0, Math.PI * 2);
      ctx.arc(cx, 405, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#38BDF8';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText('CONFERENCE ROOM A', 525, 235);
    ctx.font = '400 11px Inter, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Acoustic Glass Walls • 65% Sound Absorption', 525, 252);

    // 2. Soundproof Isolation Pod
    ctx.fillStyle = 'rgba(225, 29, 72, 0.06)';
    ctx.fillRect(1100, 200, 200, 200);

    ctx.fillStyle = '#F43F5E';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('🔇 SOUNDPROOF BOOTH', 1120, 235);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '400 11px Inter, sans-serif';
    ctx.fillText('100% Acoustic Isolation', 1120, 252);

    // 3. Open Workstation Desks
    ctx.fillStyle = 'rgba(59, 130, 246, 0.03)';
    ctx.fillRect(180, 620, 680, 360);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText('ENGINEERING WORKSPACE', 200, 650);

    // Desks
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(220, 720, 160, 60, 8);
    ctx.roundRect(420, 720, 160, 60, 8);
    ctx.roundRect(620, 720, 160, 60, 8);
    ctx.roundRect(220, 820, 160, 60, 8);
    ctx.roundRect(420, 820, 160, 60, 8);
    ctx.roundRect(620, 820, 160, 60, 8);
    ctx.fill();
    ctx.stroke();

    // 4. Lounge & Coffee Bar
    ctx.fillStyle = 'rgba(168, 85, 247, 0.04)';
    ctx.fillRect(980, 680, 360, 260);
    ctx.fillStyle = '#A855F7';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText('LOUNGE & CAFÉ', 1010, 715);

    // Potted Plants (Green touch)
    drawPlant(ctx, 480, 220);
    drawPlant(ctx, 920, 220);
    drawPlant(ctx, 1080, 220);
    drawPlant(ctx, 160, 640);
  }

  function drawPlant(ctx, x, y) {
    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10B981';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const px = x + Math.cos(angle) * 10;
      const py = y + Math.sin(angle) * 10;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawObstacles(ctx, obstacles) {
    for (const obs of obstacles) {
      const { coordinates, shape, type, isSoundProof = false } = obs;
      if (!coordinates) continue;

      if (shape === 'rectangle') {
        const w = coordinates.x2 - coordinates.x1;
        const h = coordinates.y2 - coordinates.y1;

        if (isSoundProof) {
          ctx.fillStyle = 'rgba(225, 29, 72, 0.12)';
          ctx.strokeStyle = '#E11D48';
          ctx.lineWidth = 3;
          ctx.fillRect(coordinates.x1, coordinates.y1, w, h);
          ctx.strokeRect(coordinates.x1, coordinates.y1, w, h);
        } else if (type === 'furniture') {
          ctx.fillStyle = '#1E293B';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(coordinates.x1, coordinates.y1, w, h, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#94A3B8';
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText(obs.name || 'Furniture', coordinates.x1 + 10, coordinates.y1 + 22);
        }
      } else {
        // Line wall
        ctx.beginPath();
        ctx.moveTo(coordinates.x1, coordinates.y1);
        ctx.lineTo(coordinates.x2, coordinates.y2);

        if (type === 'glass') {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#0284C7';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowColor = 'transparent';
        } else if (type === 'partition') {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 6;
          ctx.stroke();
        }
      }
    }
  }

  function drawAcousticBeams(ctx, selfPos, peersList, obstacles, time) {
    for (const peer of peersList) {
      const dist = calculateDistance(selfPos.x, selfPos.y, peer.x, peer.y);
      if (dist <= CONFIG.DEFAULT_EARSHOT_RADIUS) {
        const occlusion = calculateClientOcclusion(obstacles, selfPos.x, selfPos.y, peer.x, peer.y);

        ctx.beginPath();
        ctx.moveTo(selfPos.x, selfPos.y);
        ctx.lineTo(peer.x, peer.y);

        if (occlusion.isObstructed) {
          if (occlusion.transmissionMultiplier === 0) {
            ctx.strokeStyle = '#EF4444';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = '#F59E0B';
            ctx.setLineDash([8, 4]);
            ctx.lineWidth = 2;
          }
        } else {
          // Clear vibrant acoustic beam
          const alpha = Math.max(0.3, 1 - dist / CONFIG.DEFAULT_EARSHOT_RADIUS);
          ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);

          // Animated flowing sound particle along the beam
          const t = (time * 0.0015) % 1;
          const px = selfPos.x + (peer.x - selfPos.x) * t;
          const py = selfPos.y + (peer.y - selfPos.y) * t;

          ctx.fillStyle = '#34D399';
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawEarshotCircle(ctx, x, y, radius, time) {
    const pulse = Math.sin(time * 0.003) * 2;
    const currentRadius = radius + pulse;

    // Ethereal radial gradient aura
    const grad = ctx.createRadialGradient(x, y, radius * 0.1, x, y, currentRadius);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.12)');
    grad.addColorStop(0.7, 'rgba(59, 130, 246, 0.05)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // Boundary ring
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Radius badge label
    ctx.fillStyle = 'rgba(147, 197, 253, 0.85)';
    ctx.font = '500 10px JetBrains Mono, monospace';
    ctx.fillText(`${radius}px Earshot Zone`, x + radius - 30, y + 16);
  }

  function drawAvatar(ctx, avatar, isSelf, speaking, time) {
    const { x, y, username, avatarColor = '#3B82F6', isMuted, isDeafened } = avatar;
    const radius = 22;

    // Speaking concentric acoustic waves
    if (speaking) {
      for (let i = 1; i <= 3; i++) {
        const rippleRadius = radius + ((time * 0.04 * i) % 30);
        const rippleAlpha = Math.max(0, 1 - (rippleRadius - radius) / 30);
        ctx.strokeStyle = hexToRgba(avatarColor, rippleAlpha * 0.7);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Avatar drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Avatar outer border ring
    ctx.fillStyle = isSelf ? '#FFFFFF' : '#0F172A';
    ctx.beginPath();
    ctx.arc(x, y, radius + 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Avatar core gradient circle
    const avatarGrad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    avatarGrad.addColorStop(0, avatarColor);
    avatarGrad.addColorStop(1, '#0F172A');

    ctx.fillStyle = avatarColor;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Initials in avatar
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(username), x, y);

    // Floating glassmorphism nametag badge
    ctx.font = '600 11px Inter, sans-serif';
    const nameText = isSelf ? `${username} (You)` : username;
    const textWidth = ctx.measureText(nameText).width;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = isSelf ? '#3B82F6' : '#334155';
    ctx.lineWidth = 1;

    const badgeW = textWidth + 18;
    const badgeH = 22;
    const badgeX = x - badgeW / 2;
    const badgeY = y - radius - 28;

    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSelf ? '#93C5FD' : '#E2E8F0';
    ctx.fillText(nameText, x, badgeY + badgeH / 2);

    // Muted / Deafened icon indicator
    if (isMuted || isDeafened) {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(x + radius - 4, y - radius + 4, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.fillText(isDeafened ? 'D' : 'M', x + radius - 4, y - radius + 5);
    }
  }

  function drawTargetMarker(ctx, x, y, time) {
    const pulse = Math.sin(time * 0.008) * 3;
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 9 + pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-950">
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        className="w-full h-full cursor-crosshair block"
      />
    </div>
  );
}
