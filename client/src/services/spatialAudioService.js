/**
 * ProxiSpeak - Spatial Audio Mixer Service (Web Audio API)
 *
 * Implements:
 * - Dynamic Volume Attenuation (Week 3) based on pixel distance
 * - 3D Stereo Audio Panning (Week 4) using StereoPannerNode
 * - Acoustic Sound Occlusion / Obstacle Damping using BiquadFilterNode
 * - Chromium MediaStream Audio Packet Pulling Workaround
 * - Diagnostic Synthetic Audio Spatializer for instant verification
 */

class SpatialAudioService {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.peerNodes = new Map(); // peerId -> { sourceNode, filterNode, gainNode, panNode, stream, audioEl }
    this.isDeafened = false;
    this.isMuted = false;
  }

  /**
   * Initializes or resumes the Web Audio API AudioContext upon user gesture.
   */
  async ensureAudioContext() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // Master output gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      this.masterGain.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('[SpatialAudio] AudioContext resumed successfully.');
      } catch (err) {
        console.warn('[SpatialAudio] Could not resume AudioContext:', err.message);
      }
    }

    return this.audioContext;
  }

  /**
   * Attaches an incoming remote WebRTC MediaStream into the Web Audio processing graph.
   *
   * Audio Routing Pipeline:
   * MediaStreamSource -> BiquadFilter (Wall Occlusion) -> GainNode (Distance Attenuation) -> StereoPannerNode (3D Left/Right) -> MasterGain -> Speakers
   *
   * @param {string} peerId
   * @param {MediaStream} mediaStream
   * @param {number} [initialGain=1.0]
   * @param {number} [initialPan=0.0]
   */
  async attachPeerStream(peerId, mediaStream, initialGain = 1.0, initialPan = 0.0) {
    await this.ensureAudioContext();

    // Detach any existing node for this peer
    this.detachPeerStream(peerId);

    try {
      // 1. Critical Chromium / WebRTC Fix:
      // In Chromium-based browsers (Chrome, Edge, Brave), a remote WebRTC MediaStream
      // passed to AudioContext.createMediaStreamSource will NOT output sound unless
      // the MediaStream is also linked to an HTML <audio> element.
      // Setting volume to 0.0001 or using play() forces Chromium to decode RTP packets.
      let audioEl = document.getElementById(`audio-sink-${peerId}`);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `audio-sink-${peerId}`;
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.volume = 0.0001; // Non-zero volume keeps audio decoding active
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = mediaStream;
      audioEl.play().catch((e) => console.log('[SpatialAudio] HTML audio play note:', e.message));

      // 2. Web Audio API source node
      const sourceNode = this.audioContext.createMediaStreamSource(mediaStream);

      // Acoustic Occlusion Filter (muffles high frequencies behind walls)
      const filterNode = this.audioContext.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(20000, this.audioContext.currentTime); // Normal = unblocked
      filterNode.Q.setValueAtTime(1.0, this.audioContext.currentTime);

      // Distance Attenuation Gain Node - INITIALIZE WITH AUDIBLE GAIN!
      const gainNode = this.audioContext.createGain();
      const startingGain = this.isDeafened ? 0.0 : Math.max(0.1, initialGain);
      gainNode.gain.setValueAtTime(startingGain, this.audioContext.currentTime);

      // Stereo Panner Node (-1.0 left to +1.0 right)
      let panNode = null;
      if (typeof this.audioContext.createStereoPanner === 'function') {
        panNode = this.audioContext.createStereoPanner();
        panNode.pan.setValueAtTime(initialPan, this.audioContext.currentTime);
      }

      // Connect pipeline
      sourceNode.connect(filterNode);
      filterNode.connect(gainNode);

      if (panNode) {
        gainNode.connect(panNode);
        panNode.connect(this.masterGain);
      } else {
        gainNode.connect(this.masterGain);
      }

      this.peerNodes.set(peerId, {
        sourceNode,
        filterNode,
        gainNode,
        panNode,
        stream: mediaStream,
        audioEl,
        currentGain: startingGain,
        currentPan: initialPan,
      });

      console.log(`[SpatialAudio] Successfully attached audio pipeline for peer: ${peerId} (Gain: ${startingGain}, Pan: ${initialPan})`);
    } catch (err) {
      console.error(`[SpatialAudio] Failed to attach peer stream for ${peerId}:`, err);
    }
  }

  /**
   * Updates spatial parameters (gain, pan, occlusion filter) for a peer.
   *
   * @param {string} peerId
   * @param {object} params
   * @param {number} params.distance - Pixel distance
   * @param {number} params.gain - Attenuated volume (0.0 to 1.0)
   * @param {number} params.pan - Stereo pan (-1.0 to 1.0)
   * @param {boolean} [params.isObstructed] - Whether line-of-sight passes through an obstacle
   * @param {number} [params.occlusionMultiplier] - Wall transmission factor (0.0 to 1.0)
   * @param {boolean} [params.peerMuted] - Whether the remote peer has muted themselves
   */
  updatePeerSpatial(peerId, {
    distance = 0,
    gain = 1.0,
    pan = 0.0,
    isObstructed = false,
    occlusionMultiplier = 1.0,
    peerMuted = false,
  } = {}) {
    if (!this.peerNodes.has(peerId) || !this.audioContext) return;

    // Wake AudioContext if browser put it to sleep
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const { gainNode, panNode, filterNode } = this.peerNodes.get(peerId);
    const now = this.audioContext.currentTime;
    const timeConstant = 0.05; // 50ms smooth transition constant prevents audio clicks/pops

    // 1. Calculate effective volume
    let targetGain = gain;
    if (this.isDeafened || peerMuted) {
      targetGain = 0.0;
    } else if (isObstructed) {
      targetGain = targetGain * occlusionMultiplier;
    }

    targetGain = Math.max(0.0, Math.min(1.0, targetGain));
    gainNode.gain.setTargetAtTime(targetGain, now, timeConstant);

    // 2. Calculate 3D stereo panning
    if (panNode) {
      const targetPan = Math.max(-1.0, Math.min(1.0, pan));
      panNode.pan.setTargetAtTime(targetPan, now, timeConstant);
    }

    // 3. Acoustic Occlusion: low-pass filter simulates wall sound muffling
    if (filterNode) {
      const targetFrequency = isObstructed ? 750 : 20000;
      filterNode.frequency.setTargetAtTime(targetFrequency, now, timeConstant);
    }

    const peerData = this.peerNodes.get(peerId);
    peerData.currentGain = targetGain;
    peerData.currentPan = pan;
    peerData.isObstructed = isObstructed;
  }

  /**
   * Detaches and tears down a peer's Web Audio graph.
   *
   * @param {string} peerId
   */
  detachPeerStream(peerId) {
    if (!this.peerNodes.has(peerId)) return;

    const { sourceNode, filterNode, gainNode, panNode, audioEl } = this.peerNodes.get(peerId);

    try {
      if (sourceNode) sourceNode.disconnect();
      if (filterNode) filterNode.disconnect();
      if (gainNode) gainNode.disconnect();
      if (panNode) panNode.disconnect();
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      }
    } catch (e) {
      // Node already disconnected
    }

    this.peerNodes.delete(peerId);
    console.log(`[SpatialAudio] Detached audio pipeline for peer: ${peerId}`);
  }

  /**
   * Sets deafen state (mutes all remote sound output).
   *
   * @param {boolean} deafened
   */
  setDeafened(deafened) {
    this.isDeafened = Boolean(deafened);
    if (!this.masterGain || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    this.masterGain.gain.setTargetAtTime(this.isDeafened ? 0.0 : 1.0, now, 0.05);
  }

  /**
   * Generates a spatial test tone with specified stereo pan and distance.
   */
  async playSpatialTestTone({ pan = 0, gain = 0.5, frequency = 440, duration = 0.6 } = {}) {
    await this.ensureAudioContext();

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const toneGain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    toneGain.gain.setValueAtTime(0.001, now);
    toneGain.gain.exponentialRampToValueAtTime(gain, now + 0.05);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    let tonePan = null;
    if (typeof this.audioContext.createStereoPanner === 'function') {
      tonePan = this.audioContext.createStereoPanner();
      tonePan.pan.setValueAtTime(pan, now);
      osc.connect(toneGain);
      toneGain.connect(tonePan);
      tonePan.connect(this.masterGain);
    } else {
      osc.connect(toneGain);
      toneGain.connect(this.masterGain);
    }

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /**
   * Cleans up all audio pipelines.
   */
  close() {
    for (const peerId of this.peerNodes.keys()) {
      this.detachPeerStream(peerId);
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const spatialAudioService = new SpatialAudioService();
