// TTS Service — wraps Web Speech API for audio narration
import { CONFIG } from '../config.js';

class TTSService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.speed = CONFIG.tts.defaultSpeed;
    this.voice = null;
    this.isPaused = false;
    this.isSpeaking = false;
    this.onStateChange = null; // callback
    this._voicesLoaded = false;

    // Load voices
    this._loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this._loadVoices();
    }
  }

  _loadVoices() {
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;

    this._voicesLoaded = true;

    // Try preferred voices first
    for (const preferred of CONFIG.tts.preferredVoices) {
      const found = voices.find((v) => v.name.includes(preferred));
      if (found) {
        this.voice = found;
        return;
      }
    }

    // Fallback to any English voice
    this.voice =
      voices.find((v) => v.lang.startsWith('en')) || voices[0];
  }

  _notify() {
    if (this.onStateChange) {
      this.onStateChange({
        isSpeaking: this.isSpeaking,
        isPaused: this.isPaused,
        speed: this.speed,
      });
    }
  }

  /**
   * Speak text with current settings
   * @returns {Promise} resolves when speech ends
   */
  speak(text) {
    return new Promise((resolve, reject) => {
      this.stop(); // Stop any current speech

      if (!text || text.trim().length === 0) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.speed;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (this.voice) {
        utterance.voice = this.voice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        this._notify();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this._notify();
        resolve();
      };

      utterance.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') {
          resolve();
        } else {
          this.isSpeaking = false;
          this.isPaused = false;
          this._notify();
          reject(new Error(`TTS error: ${event.error}`));
        }
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  pause() {
    if (this.isSpeaking && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
      this._notify();
    }
  }

  resume() {
    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
      this._notify();
    }
  }

  stop() {
    this.synth.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this._notify();
  }

  toggle() {
    if (this.isPaused) {
      this.resume();
    } else if (this.isSpeaking) {
      this.pause();
    }
  }

  setSpeed(speed) {
    this.speed = Math.max(CONFIG.tts.minSpeed, Math.min(CONFIG.tts.maxSpeed, speed));
    this._notify();
  }

  getAvailableVoices() {
    return this.synth.getVoices().filter((v) => v.lang.startsWith('en'));
  }

  setVoice(voiceName) {
    const voices = this.synth.getVoices();
    const found = voices.find((v) => v.name === voiceName);
    if (found) this.voice = found;
  }
}

// Singleton
export const ttsService = new TTSService();
