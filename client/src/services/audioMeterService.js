/**
 * ProxiSpeak - Audio Meter & Speaking Detection Service
 *
 * Analyzes audio levels from the microphone to detect when the user is speaking,
 * driving real-time avatar animation ripples and microphone volume level indicators.
 */

class AudioMeterService {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphoneSource = null;
    this.dataArray = null;
    this.animationId = null;
    this.onVolumeChangeCallback = null;
    this.isSpeaking = false;
    this.volume = 0;
  }

  /**
   * Starts monitoring volume from a MediaStream.
   *
   * @param {MediaStream} stream
   * @param {Function} onVolumeChange - Callback receiving { volume, isSpeaking }
   */
  start(stream, onVolumeChange) {
    this.stop();
    this.onVolumeChangeCallback = onVolumeChange;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
      this.microphoneSource.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.analyser) return;

        this.analyser.getByteFrequencyData(this.dataArray);

        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          sum += this.dataArray[i];
        }

        const avg = sum / this.dataArray.length;
        const normalizedVolume = Math.min(1.0, avg / 128);
        this.volume = normalizedVolume;

        // Threshold for active speech
        const speechThreshold = 0.08;
        const wasSpeaking = this.isSpeaking;
        this.isSpeaking = normalizedVolume > speechThreshold;

        if (this.onVolumeChangeCallback) {
          this.onVolumeChangeCallback({
            volume: this.volume,
            isSpeaking: this.isSpeaking,
          });
        }

        this.animationId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('[AudioMeter] Could not initialize meter:', err.message);
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.microphoneSource) {
      this.microphoneSource.disconnect();
      this.microphoneSource = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.volume = 0;
    this.isSpeaking = false;
  }
}

export const audioMeterService = new AudioMeterService();
