/**
 * ProxiSpeak - Main Application Master Controller
 *
 * Integrates:
 * - 2D Canvas Virtual World Rendering (60 FPS)
 * - Socket.io Real-time Movement & Geospatial Signaling
 * - WebRTC Peer-to-Peer Earshot Mesh Audio Connections
 * - Web Audio API Dynamic Proximity Attenuation & 3D Stereo Panning
 * - Sound-blocking Obstacle Ray-casting Occlusion
 * - Active Speaking Detection & Audio Telemetry
 *
 * UI Layout (non-overlapping):
 * - Unified glassmorphic top header bar (ProxiSpeak logo, connection, earshot status, toggles)
 * - Bottom center controls dock (mic, deafen, test tone, toggles)
 * - Bottom right radar HUD (above controls, never overlapping)
 * - Right-side user list drawer (slides in, full height)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import CanvasWorld from './components/CanvasWorld';
import ControlsOverlay from './components/ControlsOverlay';
import SpatialRadar from './components/SpatialRadar';
import UserList from './components/UserList';
import JoinModal from './components/JoinModal';
import DiagnosticsModal from './components/DiagnosticsModal';

import { socketService } from './services/socketService';
import { webrtcService } from './services/webrtcService';
import { spatialAudioService } from './services/spatialAudioService';
import { audioMeterService } from './services/audioMeterService';
import { calculateDistance, calculateStereoPan, calculateDistanceGain, calculateClientOcclusion } from './utils/geometry';
import { CONFIG } from './config';
import {
  Wifi, WifiOff, Volume2, Radio, Users, Zap, ChevronRight,
  Activity, Menu, X, Layers
} from 'lucide-react';

export default function App() {
  const [hasJoined, setHasJoined] = useState(false);
  const [self, setSelf] = useState(null);
  const [peers, setPeers] = useState([]);
  const [room, setRoom] = useState({
    roomId: 'default-office',
    name: 'Infotact Headquarters — Floor 1',
    width: CONFIG.WORLD_WIDTH,
    height: CONFIG.WORLD_HEIGHT,
    obstacles: [],
  });

  // Connection & Audio Telemetry
  const [connectionStatus, setConnectionStatus] = useState({ status: 'disconnected' });
  const [isBroadcastingTone, setIsBroadcastingTone] = useState(false);

  // Audio & UI States
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Overlays & Modals
  const [showEarshotRadius, setShowEarshotRadius] = useState(true);
  const [showRadar, setShowRadar] = useState(true);
  const [showUserList, setShowUserList] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  // Canvas navigation target — set when user clicks "Walk to" in UserList.
  // Passed to CanvasWorld which sets its internal mouseTargetRef for smooth movement.
  const [navigateTo, setNavigateTo] = useState(null);

  // References for live closures
  const selfRef = useRef(self);
  selfRef.current = self;
  const peersRef = useRef(peers);
  peersRef.current = peers;
  const roomRef = useRef(room);
  roomRef.current = room;

  // Toast manager — throttled queue to avoid spam
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Recalculates spatial audio for all peers relative to self's position
  const updateAllPeersSpatialAudio = useCallback((selfPos) => {
    if (!selfPos) return;
    const currentPeers = peersRef.current;
    const currentObstacles = roomRef.current.obstacles || [];

    for (const peer of currentPeers) {
      const dist = calculateDistance(selfPos.x, selfPos.y, peer.x, peer.y);
      if (dist <= CONFIG.DEFAULT_EARSHOT_RADIUS) {
        const { pan } = calculateStereoPan(selfPos.x, selfPos.y, peer.x, peer.y, CONFIG.DEFAULT_EARSHOT_RADIUS);
        const gain = calculateDistanceGain(dist, CONFIG.DEFAULT_EARSHOT_RADIUS);
        const occlusion = calculateClientOcclusion(currentObstacles, selfPos.x, selfPos.y, peer.x, peer.y);
        spatialAudioService.updatePeerSpatial(peer.userId, {
          distance: dist,
          gain,
          pan,
          isObstructed: occlusion.isObstructed,
          occlusionMultiplier: occlusion.transmissionMultiplier,
          peerMuted: peer.isMuted,
        });
      } else {
        spatialAudioService.updatePeerSpatial(peer.userId, { distance: dist, gain: 0, pan: 0 });
      }
    }
  }, []);

  // Ensure AudioContext is resumed upon any user interaction
  useEffect(() => {
    const unlockAudio = () => spatialAudioService.ensureAudioContext();
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Handle Join Room Submission
  const handleJoin = async ({ username, avatarColor, roomId }) => {
    const mediaStream = await webrtcService.initializeLocalMedia();
    await spatialAudioService.ensureAudioContext();

    if (mediaStream) {
      audioMeterService.start(mediaStream, ({ volume, isSpeaking }) => {
        setMicVolume(volume);
        setIsSpeaking(isSpeaking);
      });
    }

    const generatedUserId = `user_${Math.random().toString(36).substring(2, 9)}`;
    const spawnX = 300 + Math.floor(Math.random() * 40);
    const spawnY = 300 + Math.floor(Math.random() * 40);

    const initialSelf = {
      userId: generatedUserId,
      username,
      avatarColor,
      roomId,
      x: spawnX,
      y: spawnY,
      isMuted: false,
      isDeafened: false,
    };
    setSelf(initialSelf);

    socketService.connect({
      userId: generatedUserId,
      username,
      avatarColor,
      roomId,
      x: spawnX,
      y: spawnY,
    });

    setHasJoined(true);
    showToast(`👋 Welcome, ${username}! Walk within 100px of a colleague to talk.`);
  };

  // Setup Socket & WebRTC event listeners
  useEffect(() => {
    webrtcService.onPeerStreamCallback = (peerId, remoteStream) => {
      console.log(`[App] Remote stream received from peer: ${peerId}`);
      if (selfRef.current) updateAllPeersSpatialAudio(selfRef.current);
    };

    const handleConnectionStatus = (statusData) => {
      console.log('[App] Connection status:', statusData);
      setConnectionStatus(statusData);
    };

    const handleRoomState = (data) => {
      console.log('[App] Received room-state:', data);
      if (data.room) setRoom(data.room);
      if (data.self) setSelf((prev) => ({ ...prev, ...data.self }));
      if (Array.isArray(data.peers)) setPeers(data.peers);
    };

    const handleUserJoined = (newPeer) => {
      console.log('[App] User joined room:', newPeer);
      setPeers((prev) => {
        const filtered = prev.filter((p) => p.userId !== newPeer.userId);
        return [...filtered, newPeer];
      });
      showToast(`🟢 ${newPeer.username} entered the office.`);
      if (selfRef.current) updateAllPeersSpatialAudio(selfRef.current);
    };

    const handleUserLeft = ({ userId }) => {
      console.log('[App] User left room:', userId);
      webrtcService.closePeerConnection(userId);
      setPeers((prev) => {
        const leaving = prev.find((p) => p.userId === userId);
        if (leaving) showToast(`🔴 ${leaving.username} left the office.`);
        return prev.filter((p) => p.userId !== userId);
      });
    };

    const handlePlayerMoved = (movedPeer) => {
      setPeers((prev) => {
        const index = prev.findIndex((p) => p.userId === movedPeer.userId);
        if (index === -1) return [...prev, movedPeer];
        const updated = [...prev];
        updated[index] = { ...updated[index], ...movedPeer };
        return updated;
      });

      const currentSelf = selfRef.current;
      if (currentSelf) {
        const dist = calculateDistance(currentSelf.x, currentSelf.y, movedPeer.x, movedPeer.y);
        const { pan } = calculateStereoPan(currentSelf.x, currentSelf.y, movedPeer.x, movedPeer.y, CONFIG.DEFAULT_EARSHOT_RADIUS);
        const gain = calculateDistanceGain(dist, CONFIG.DEFAULT_EARSHOT_RADIUS);
        const occlusion = calculateClientOcclusion(roomRef.current.obstacles || [], currentSelf.x, currentSelf.y, movedPeer.x, movedPeer.y);
        spatialAudioService.updatePeerSpatial(movedPeer.userId, {
          distance: dist, gain, pan,
          isObstructed: occlusion.isObstructed,
          occlusionMultiplier: occlusion.transmissionMultiplier,
          peerMuted: movedPeer.isMuted,
        });
      }
    };

    const handlePeerEnteredEarshot = async (data) => {
      console.log('[App] peer-entered-earshot:', data);
      showToast(`🎙️ ${data.username} is within earshot!`);
      await webrtcService.handlePeerEnteredEarshot(data);
      if (selfRef.current) updateAllPeersSpatialAudio(selfRef.current);
    };

    const handlePeerLeftEarshot = (data) => {
      console.log('[App] peer-left-earshot:', data);
      webrtcService.closePeerConnection(data.peerId);
    };

    const handleProximityUpdate = (data) => {
      if (data.nearbyPeers && selfRef.current) {
        for (const peer of data.nearbyPeers) {
          spatialAudioService.updatePeerSpatial(peer.userId, {
            distance: peer.distance,
            gain: peer.effectiveGain !== undefined ? peer.effectiveGain : peer.gain,
            pan: peer.pan,
            isObstructed: peer.isObstructed,
            occlusionMultiplier: peer.occlusionMultiplier,
            peerMuted: peer.isMuted,
          });
        }
      }
    };

    const handleWebRTCOffer = async (data) => { await webrtcService.handleIncomingOffer(data); };
    const handleWebRTCAnswer = async (data) => { await webrtcService.handleIncomingAnswer(data); };
    const handleWebRTCIceCandidate = async (data) => { await webrtcService.handleIncomingIceCandidate(data); };
    const handleWebRTCClosePeer = (data) => { webrtcService.closePeerConnection(data.senderUserId, false); };
    const handleUserAudioStateChanged = ({ userId, isMuted, isDeafened }) => {
      setPeers((prev) => prev.map((p) => (p.userId === userId ? { ...p, isMuted, isDeafened } : p)));
    };

    socketService.on('connection-status', handleConnectionStatus);
    socketService.on('room-state', handleRoomState);
    socketService.on('user-joined', handleUserJoined);
    socketService.on('user-left', handleUserLeft);
    socketService.on('player-moved', handlePlayerMoved);
    socketService.on('peer-entered-earshot', handlePeerEnteredEarshot);
    socketService.on('peer-left-earshot', handlePeerLeftEarshot);
    socketService.on('proximity-update', handleProximityUpdate);
    socketService.on('webrtc-offer', handleWebRTCOffer);
    socketService.on('webrtc-answer', handleWebRTCAnswer);
    socketService.on('webrtc-ice-candidate', handleWebRTCIceCandidate);
    socketService.on('webrtc-close-peer', handleWebRTCClosePeer);
    socketService.on('user-audio-state-changed', handleUserAudioStateChanged);

    return () => {
      socketService.off('connection-status', handleConnectionStatus);
      socketService.off('room-state', handleRoomState);
      socketService.off('user-joined', handleUserJoined);
      socketService.off('user-left', handleUserLeft);
      socketService.off('player-moved', handlePlayerMoved);
      socketService.off('peer-entered-earshot', handlePeerEnteredEarshot);
      socketService.off('peer-left-earshot', handlePeerLeftEarshot);
      socketService.off('proximity-update', handleProximityUpdate);
      socketService.off('webrtc-offer', handleWebRTCOffer);
      socketService.off('webrtc-answer', handleWebRTCAnswer);
      socketService.off('webrtc-ice-candidate', handleWebRTCIceCandidate);
      socketService.off('webrtc-close-peer', handleWebRTCClosePeer);
      socketService.off('user-audio-state-changed', handleUserAudioStateChanged);
    };
  }, [showToast, updateAllPeersSpatialAudio]);

  // Handle avatar movement from Canvas
  const handleAvatarMove = useCallback(
    (x, y) => {
      setSelf((prev) => (prev ? { ...prev, x, y } : { x, y }));
      socketService.sendMovement({ x, y, roomId: roomRef.current.roomId });
      updateAllPeersSpatialAudio({ x, y });
    },
    [updateAllPeersSpatialAudio]
  );

  // Toggle Microphone Mute
  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    webrtcService.setMuted(nextMuted);
    setSelf((prev) => (prev ? { ...prev, isMuted: nextMuted } : prev));
  }, [isMuted]);

  // Toggle Deafen
  const handleToggleDeafen = useCallback(() => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    spatialAudioService.setDeafened(nextDeafened);
    socketService.sendAudioState({ isDeafened: nextDeafened });
    setSelf((prev) => (prev ? { ...prev, isDeafened: nextDeafened } : prev));
  }, [isDeafened]);

  // Toggle Test Tone Broadcast
  const handleToggleBroadcastTone = useCallback(() => {
    const active = webrtcService.toggleTestToneBroadcast();
    setIsBroadcastingTone(active);
    showToast(active ? '🔊 Broadcasting test tone via WebRTC...' : '🎤 Switched back to microphone.');
  }, [showToast]);

  // Walk directly to user coordinates.
  // We tell CanvasWorld to set its mouseTargetRef so the avatar walks smoothly
  // on the local canvas. The game loop's onMove callback will broadcast the
  // updated position to the server as the avatar moves — no instant teleport.
  const handleNavigateToUser = useCallback((targetX, targetY) => {
    // Use an object identity change to ensure the useEffect in CanvasWorld fires
    // even if the same coordinates are clicked twice (wrap in a new object each time).
    setNavigateTo({ x: targetX, y: targetY });
    // Close the roster drawer so the user can see their avatar moving
    setShowUserList(false);
    showToast(`🚶 Walking to colleague…`);
  }, [showToast]);


  // Compute peers in earshot
  const peersInEarshot = self
    ? peers.filter((p) => calculateDistance(self.x, self.y, p.x, p.y) <= CONFIG.DEFAULT_EARSHOT_RADIUS)
    : [];

  // Connection indicator
  const isConnected = connectionStatus.status === 'connected';
  const isConnecting = connectionStatus.status === 'connecting';
  const isError = connectionStatus.status === 'error';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">

      {/* ═══════════════════════════════════════════════════════
          UNIFIED TOP HEADER BAR — single bar, no overlapping
          ═══════════════════════════════════════════════════════ */}
      {hasJoined && (
        <header className="absolute top-0 left-0 right-0 z-30 px-4 py-2.5 flex items-center justify-between gap-3 pointer-events-auto"
          style={{
            background: 'linear-gradient(180deg, rgba(2,8,20,0.97) 0%, rgba(2,8,20,0.80) 80%, transparent 100%)',
          }}
        >
          {/* LEFT — Logo & Room Info */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            {/* Logo mark */}
            <div className="flex items-center gap-2 select-none">
              <div className="relative w-7 h-7">
                <div className="absolute inset-0 rounded-full bg-blue-600/40 blur-sm animate-pulse" />
                <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-700/40">
                  <Radio size={13} className="text-white" />
                </div>
              </div>
              <div className="leading-none">
                <div className="text-sm font-black text-white tracking-tight">ProxiSpeak</div>
                <div className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]">
                  {room.name}
                </div>
              </div>
            </div>

            {/* Connection pill */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              isConnected
                ? 'bg-emerald-950/80 border-emerald-700/50 text-emerald-300'
                : isConnecting
                ? 'bg-amber-950/80 border-amber-700/50 text-amber-300'
                : 'bg-rose-950/80 border-rose-700/50 text-rose-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : isConnecting ? 'bg-amber-400 animate-ping' : 'bg-rose-400'
              }`} />
              {isConnected ? 'Live' : isConnecting ? 'Connecting…' : 'Offline'}
            </div>
          </div>

          {/* CENTER — Live Earshot Status Badge */}
          <div className="flex-1 flex justify-center min-w-0">
            {peersInEarshot.length > 0 ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-600/60 text-emerald-200 text-xs font-medium shadow-lg shadow-emerald-900/40 backdrop-blur-sm max-w-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
                <Volume2 size={13} className="text-emerald-400 flex-shrink-0" />
                <span className="truncate">
                  <span className="font-bold">{peersInEarshot.map((p) => p.username).join(', ')}</span>
                  {' '}in earshot{peersInEarshot.length === 1 ? ` • ${Math.round(calculateDistance(self.x, self.y, peersInEarshot[0].x, peersInEarshot[0].y))}px` : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/50 text-slate-400 text-xs backdrop-blur-sm max-w-xs">
                <Radio size={13} className="text-blue-400 flex-shrink-0" />
                <span className="truncate">
                  {peers.length === 0
                    ? 'Waiting for colleagues to join…'
                    : peers.length === 1
                    ? `${peers[0].username} is ${Math.round(calculateDistance(self.x, self.y, peers[0].x, peers[0].y))}px away — walk closer!`
                    : `${peers.length} colleague${peers.length > 1 ? 's' : ''} in room — walk within 100px to talk`}
                </span>
              </div>
            )}
          </div>

          {/* RIGHT — Action Icon Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Online count */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/70 border border-slate-700/50 text-[11px] text-slate-300 font-mono">
              <Users size={12} className="text-slate-400" />
              {peers.length + 1}
            </div>

            {/* Earshot radius toggle */}
            <button
              onClick={() => setShowEarshotRadius((v) => !v)}
              title="Toggle 100px Earshot Ring"
              className={`p-2 rounded-xl transition-all ${showEarshotRadius ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Radio size={15} />
            </button>

            {/* Radar HUD toggle */}
            <button
              onClick={() => setShowRadar((v) => !v)}
              title="Toggle Spatial Radar HUD"
              className={`p-2 rounded-xl transition-all ${showRadar ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Layers size={15} />
            </button>

            {/* Diagnostics */}
            <button
              onClick={() => setShowDiagnostics(true)}
              title="Audio Diagnostics"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
            >
              <Activity size={15} />
            </button>

            {/* User list / roster */}
            <button
              onClick={() => setShowUserList((v) => !v)}
              title="Open Office Roster"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                showUserList
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-700/40 hover:bg-slate-700/60'
              }`}
            >
              <Users size={14} />
              <span className="hidden md:inline">Roster</span>
            </button>
          </div>
        </header>
      )}

      {/* ERROR BANNER — below header, only on error */}
      {hasJoined && isError && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 bg-rose-700/95 border border-rose-500/60 rounded-xl text-white text-xs shadow-2xl backdrop-blur-sm max-w-sm text-center">
          <WifiOff size={15} className="flex-shrink-0" />
          <span>
            Cannot reach ProxiSpeak backend at <code className="font-mono bg-rose-800/70 px-1 rounded">{CONFIG.SERVER_URL}</code>.
            Run <code className="font-mono bg-rose-800/70 px-1 rounded">npm run dev</code> in <code className="font-mono bg-rose-800/70 px-1 rounded">server/</code>.
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════════
          2D CANVAS WORLD (fills remaining space)
          ═══════════════════════════════════════ */}
      <div className="absolute inset-0 w-full h-full">
        <CanvasWorld
          self={self}
          peers={peers}
          room={room}
          isSpeaking={isSpeaking}
          onMove={handleAvatarMove}
          showEarshotRadius={showEarshotRadius}
          onSelectPeer={() => setShowUserList(true)}
          navigateTo={navigateTo}
        />
      </div>

      {/* ════════════════════════════════════════
          BOTTOM CONTROLS DOCK — absolute bottom center
          ════════════════════════════════════════ */}
      {hasJoined && (
        <ControlsOverlay
          isMuted={isMuted}
          isDeafened={isDeafened}
          micVolume={micVolume}
          isSpeaking={isSpeaking}
          showEarshotRadius={showEarshotRadius}
          showRadar={showRadar}
          showUserList={showUserList}
          peerCount={peers.length}
          roomName={room.name}
          isBroadcastingTone={isBroadcastingTone}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          onToggleEarshot={() => setShowEarshotRadius((v) => !v)}
          onToggleRadar={() => setShowRadar((v) => !v)}
          onToggleUserList={() => setShowUserList((v) => !v)}
          onOpenDiagnostics={() => setShowDiagnostics(true)}
          onToggleBroadcastTone={handleToggleBroadcastTone}
        />
      )}

      {/* ════════════════════════════════════════
          SPATIAL RADAR — bottom RIGHT, above controls
          ════════════════════════════════════════ */}
      {hasJoined && showRadar && self && (
        <SpatialRadar
          self={self}
          peers={peers}
          onClose={() => setShowRadar(false)}
        />
      )}

      {/* ═══════════════════════════════════
          RIGHT SIDE USER LIST DRAWER
          ═══════════════════════════════════ */}
      <UserList
        isOpen={showUserList}
        onClose={() => setShowUserList(false)}
        self={self || { x: 300, y: 300, username: 'You', isMuted, isDeafened }}
        peers={peers}
        onNavigateToUser={handleNavigateToUser}
      />

      {/* ══════════════════════════
          DIAGNOSTICS MODAL
          ══════════════════════════ */}
      <DiagnosticsModal
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
      />

      {/* ════════════════════════════
          JOIN MODAL (Onboarding Screen)
          ════════════════════════════ */}
      <JoinModal isOpen={!hasJoined} onJoin={handleJoin} />

      {/* ════════════════════════
          TOAST NOTIFICATION
          ════════════════════════ */}
      {toastMessage && (
        <div
          key={toastMessage}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 animate-toast-up pointer-events-none"
        >
          <div className="bg-slate-900/95 border border-slate-700/70 rounded-2xl px-4 py-2.5 text-xs text-slate-200 shadow-2xl flex items-center gap-2 max-w-sm text-center backdrop-blur-sm">
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
