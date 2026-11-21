/**
 * ProxiSpeak - WebRTC Peer-to-Peer Audio Service
 *
 * Implements Week 2 requirement:
 * "WebRTC Integration: Implement standard WebRTC peer-to-peer audio connections
 *  using the browser's getUserMedia."
 * "Audio Check: Demonstrate two browsers successfully establishing a WebRTC audio connection."
 *
 * Features:
 * - Proximity-triggered peer connection mesh (100px radius)
 * - Safe ICE candidate queuing (prevents lost candidates before SDP remoteDescription)
 * - Synthetic test melody broadcaster for single-machine / permission-free testing
 */

import { CONFIG } from '../config';
import { socketService } from './socketService';
import { spatialAudioService } from './spatialAudioService';

class WebRTCService {
  constructor() {
    this.localStream = null;
    this.isMuted = false;
    this.peerConnections = new Map(); // peerId -> { pc, targetSocketId, remoteStream }
    this.pendingCandidatesMap = new Map(); // peerId -> Array<candidate>
    this.onPeerStreamCallback = null;
    this.onPeerDisconnectedCallback = null;
    this.isInitialized = false;

    // Test tone broadcaster states
    this.isBroadcastingTone = false;
    this.testToneContext = null;
    this.testToneTrack = null;
  }

  /**
   * Initializes local user media (microphone).
   */
  async initializeLocalMedia() {
    if (this.localStream) return this.localStream;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      console.log('[WebRTC] Microphone stream acquired successfully.');
      this.isInitialized = true;
      return this.localStream;
    } catch (err) {
      console.warn('[WebRTC] Microphone access not granted or unavailable:', err.message);
      // Fallback audible/silent stream generator
      this.localStream = this._createFallbackAudioStream();
      return this.localStream;
    }
  }

  /**
   * Creates an audio stream destination if microphone is denied or unavailable.
   */
  _createFallbackAudioStream() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const dst = ctx.createMediaStreamDestination();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime); // very low volume placeholder
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      return dst.stream;
    } catch (e) {
      return null;
    }
  }

  /**
   * Sets local microphone mute status.
   */
  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    socketService.sendAudioState({ isMuted: this.isMuted });
  }

  /**
   * Toggles broadcasting a clear harmonic sound instead of microphone.
   * Perfect for testing audio across two browser tabs on the same computer!
   */
  toggleTestToneBroadcast() {
    this.isBroadcastingTone = !this.isBroadcastingTone;

    if (this.isBroadcastingTone) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const toneGain = ctx.createGain();
        const dst = ctx.createMediaStreamDestination();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ctx.currentTime); // 520Hz clear tone
        toneGain.gain.setValueAtTime(0.4, ctx.currentTime);

        osc.connect(toneGain);
        toneGain.connect(dst);
        osc.start();

        this.testToneContext = ctx;
        this.testToneTrack = dst.stream.getAudioTracks()[0];

        // Replace track in all active WebRTC senders
        for (const [peerId, peerEntry] of this.peerConnections.entries()) {
          const senders = peerEntry.pc.getSenders();
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(this.testToneTrack);
            console.log(`[WebRTC] Replaced track with Test Tone for peer ${peerId}`);
          }
        }
        return true;
      } catch (err) {
        console.error('[WebRTC] Failed to start test tone broadcast:', err);
        return false;
      }
    } else {
      // Revert back to local microphone track
      if (this.testToneContext) {
        this.testToneContext.close().catch(() => {});
        this.testToneContext = null;
      }
      const micTrack = this.localStream ? this.localStream.getAudioTracks()[0] : null;
      if (micTrack) {
        for (const [peerId, peerEntry] of this.peerConnections.entries()) {
          const senders = peerEntry.pc.getSenders();
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(micTrack);
            console.log(`[WebRTC] Restored microphone track for peer ${peerId}`);
          }
        }
      }
      return false;
    }
  }

  /**
   * Creates and configures an RTCPeerConnection for a remote peer.
   */
  _createPeerConnection(peerId, targetSocketId) {
    if (this.peerConnections.has(peerId)) {
      const existing = this.peerConnections.get(peerId);
      if (targetSocketId) existing.targetSocketId = targetSocketId;
      return existing.pc;
    }

    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS,
    });

    const peerEntry = {
      pc,
      targetSocketId,
      remoteStream: null,
    };
    this.peerConnections.set(peerId, peerEntry);

    // Add local audio track
    const activeTrack = (this.isBroadcastingTone && this.testToneTrack)
      ? this.testToneTrack
      : (this.localStream ? this.localStream.getAudioTracks()[0] : null);

    if (activeTrack && this.localStream) {
      pc.addTrack(activeTrack, this.localStream);
      console.log(`[WebRTC] Added local audio track to PC for peer: ${peerId}`);
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      const currentSocketId = peerEntry.targetSocketId || targetSocketId;
      if (event.candidate && currentSocketId) {
        socketService.sendIceCandidate({
          targetSocketId: currentSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Remote audio track arrival
    pc.ontrack = (event) => {
      console.log(`[WebRTC] 🎵 Received remote audio track from peer: ${peerId}`);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      peerEntry.remoteStream = remoteStream;

      // Pipe into Web Audio API Spatial Mixer
      spatialAudioService.attachPeerStream(peerId, remoteStream, 1.0, 0.0);

      if (this.onPeerStreamCallback) {
        this.onPeerStreamCallback(peerId, remoteStream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} connectionState: ${pc.connectionState}`);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        this.closePeerConnection(peerId, false);
      }
    };

    return pc;
  }

  /**
   * Flushes queued ICE candidates for a peer once remote description is set.
   */
  async _flushPendingCandidates(peerId, pc) {
    if (this.pendingCandidatesMap.has(peerId)) {
      const candidates = this.pendingCandidatesMap.get(peerId);
      this.pendingCandidatesMap.delete(peerId);
      console.log(`[WebRTC] Flushing ${candidates.length} queued ICE candidates for ${peerId}`);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[WebRTC] Error adding queued candidate:`, err.message);
        }
      }
    }
  }

  /**
   * Handles peer-entered-earshot event: initiates WebRTC handshake.
   */
  async handlePeerEnteredEarshot({ peerId, peerSocketId, isInitiator }) {
    console.log(`[WebRTC] Peer ${peerId} entered earshot. Initiator: ${isInitiator}`);
    await this.initializeLocalMedia();
    await spatialAudioService.ensureAudioContext();

    const pc = this._createPeerConnection(peerId, peerSocketId);

    if (isInitiator) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);

        socketService.sendWebRTCOffer({
          targetSocketId: peerSocketId,
          targetUserId: peerId,
          offer: pc.localDescription,
        });
        console.log(`[WebRTC] Sent SDP Offer to peer ${peerId}`);
      } catch (err) {
        console.error(`[WebRTC] Failed to create offer for ${peerId}:`, err);
      }
    }
  }

  /**
   * Handles incoming SDP offer.
   */
  async handleIncomingOffer({ senderSocketId, senderUserId, offer }) {
    console.log(`[WebRTC] Handling incoming offer from ${senderUserId}`);
    await this.initializeLocalMedia();
    await spatialAudioService.ensureAudioContext();

    const pc = this._createPeerConnection(senderUserId, senderSocketId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this._flushPendingCandidates(senderUserId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.sendWebRTCAnswer({
        targetSocketId: senderSocketId,
        targetUserId: senderUserId,
        answer: pc.localDescription,
      });
      console.log(`[WebRTC] Sent SDP Answer to peer ${senderUserId}`);
    } catch (err) {
      console.error(`[WebRTC] Error handling offer from ${senderUserId}:`, err);
    }
  }

  /**
   * Handles incoming SDP answer.
   */
  async handleIncomingAnswer({ senderUserId, answer }) {
    console.log(`[WebRTC] Handling incoming answer from ${senderUserId}`);
    const peerEntry = this.peerConnections.get(senderUserId);
    if (!peerEntry) return;

    try {
      await peerEntry.pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this._flushPendingCandidates(senderUserId, peerEntry.pc);
      console.log(`[WebRTC] Established remote description with ${senderUserId}`);
    } catch (err) {
      console.error(`[WebRTC] Error setting remote answer for ${senderUserId}:`, err);
    }
  }

  /**
   * Handles incoming ICE candidate.
   */
  async handleIncomingIceCandidate({ senderUserId, candidate }) {
    if (!candidate) return;
    const peerEntry = this.peerConnections.get(senderUserId);

    if (peerEntry && peerEntry.pc && peerEntry.pc.remoteDescription && peerEntry.pc.remoteDescription.type) {
      try {
        await peerEntry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`[WebRTC] Error adding immediate ICE candidate for ${senderUserId}:`, err.message);
      }
    } else {
      // Queue candidate until PC and remoteDescription are ready
      if (!this.pendingCandidatesMap.has(senderUserId)) {
        this.pendingCandidatesMap.set(senderUserId, []);
      }
      this.pendingCandidatesMap.get(senderUserId).push(candidate);
    }
  }

  /**
   * Closes a peer connection when user leaves earshot.
   */
  closePeerConnection(peerId, notifyServer = true) {
    if (!this.peerConnections.has(peerId)) return;

    const peerEntry = this.peerConnections.get(peerId);

    try {
      if (notifyServer && peerEntry.targetSocketId) {
        socketService.sendClosePeer({ targetSocketId: peerEntry.targetSocketId });
      }
      peerEntry.pc.close();
    } catch (err) {
      // Ignore cleanup errors
    }

    // Detach from spatial audio mixer
    spatialAudioService.detachPeerStream(peerId);
    this.peerConnections.delete(peerId);
    this.pendingCandidatesMap.delete(peerId);

    if (this.onPeerDisconnectedCallback) {
      this.onPeerDisconnectedCallback(peerId);
    }

    console.log(`[WebRTC] Closed peer connection for ${peerId}`);
  }

  /**
   * Disconnects all active peer connections.
   */
  disconnectAll() {
    for (const peerId of Array.from(this.peerConnections.keys())) {
      this.closePeerConnection(peerId, false);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.testToneContext) {
      this.testToneContext.close().catch(() => {});
      this.testToneContext = null;
    }
    this.isInitialized = false;
  }
}

export const webrtcService = new WebRTCService();
