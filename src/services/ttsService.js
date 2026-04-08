// TTS Service — Dual-channel manager (lecture + chat) wrapping Web Speech API
import { CONFIG } from '../config.js';

class TTSService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.speed = CONFIG.tts.defaultSpeed;
    this.voice = null;
    this._voicesLoaded = false;

    // ── Channel state ───────────────────────────────────────────────
    // Which channel owns the current utterance: 'lecture' | 'chat' | null
    this.activeChannel = null;

    // Lecture channel
    this.lecture = {
      isSpeaking: false,
      isPaused: false,
      text: '',        // full text being spoken
      charIndex: 0,    // last tracked word-boundary position
    };

    // Chat channel
    this.chat = {
      isSpeaking: false,
      isPaused: false,
      text: '',
      charIndex: 0,
    };

    // Saved lecture state when chat interrupts
    this._savedLecture = null; // { text, charIndex, wasSpeaking }

    // ── Callbacks ───────────────────────────────────────────────────
    this.onLectureStateChange = null;
    this.onChatStateChange = null;

    // ── Guard: prevent resume-restart loops ─────────────────────────
    this._isRestarting = false;

    // Load voices
    this._loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this._loadVoices();
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  Voice loading
  // ════════════════════════════════════════════════════════════════════

  _loadVoices() {
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;

    this._voicesLoaded = true;

    for (const preferred of CONFIG.tts.preferredVoices) {
      const found = voices.find((v) => v.name.includes(preferred));
      if (found) {
        this.voice = found;
        return;
      }
    }

    this.voice =
      voices.find((v) => v.lang.startsWith('en')) || voices[0];
  }

  // ════════════════════════════════════════════════════════════════════
  //  State notification helpers
  // ════════════════════════════════════════════════════════════════════

  _notifyLecture() {
    if (this.onLectureStateChange) {
      this.onLectureStateChange({
        isSpeaking: this.lecture.isSpeaking,
        isPaused: this.lecture.isPaused,
        speed: this.speed,
      });
    }
  }

  _notifyChat() {
    if (this.onChatStateChange) {
      this.onChatStateChange({
        isSpeaking: this.chat.isSpeaking,
        isPaused: this.chat.isPaused,
        speed: this.speed,
      });
    }
  }

  // Legacy callback compat — fires for whichever channel is active
  _notifyActive() {
    if (this.activeChannel === 'lecture') this._notifyLecture();
    else if (this.activeChannel === 'chat') this._notifyChat();
  }

  // ════════════════════════════════════════════════════════════════════
  //  Core utterance creation
  // ════════════════════════════════════════════════════════════════════

  /**
   * Create and speak an utterance on the given channel.
   * Returns a promise that resolves when the utterance ends.
   */
  _speakOnChannel(channel, text) {
    return new Promise((resolve, reject) => {
      // Cancel anything currently playing (raw cancel, no state logic)
      this.synth.cancel();

      if (!text || text.trim().length === 0) {
        resolve();
        return;
      }

      const state = this[channel]; // this.lecture or this.chat
      state.text = text;
      state.charIndex = 0;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.speed;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (this.voice) {
        utterance.voice = this.voice;
      }

      // Track word-boundary position for immediate speed changes & resume
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          state.charIndex = event.charIndex;
        }
      };

      utterance.onstart = () => {
        this.activeChannel = channel;
        state.isSpeaking = true;
        state.isPaused = false;
        this._notifyActive();
      };

      utterance.onend = () => {
        // Guard: if we're in the middle of a restart (speed change / resume),
        // don't reset state — the new utterance will take over.
        if (this._isRestarting) {
          resolve();
          return;
        }

        state.isSpeaking = false;
        state.isPaused = false;
        state.charIndex = 0;
        this.currentUtterance = null;

        // If chat just finished, possibly resume lecture
        if (channel === 'chat') {
          this.activeChannel = null;
          this._notifyChat();
          this._maybeResumeLectureAfterChat();
        } else {
          this.activeChannel = null;
          this._notifyLecture();
        }

        resolve();
      };

      utterance.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') {
          // Don't reset state on cancel if we're restarting
          if (!this._isRestarting) {
            state.isSpeaking = false;
            state.isPaused = false;
            this._notifyActive();
          }
          resolve();
        } else {
          state.isSpeaking = false;
          state.isPaused = false;
          this._notifyActive();
          reject(new Error(`TTS error: ${event.error}`));
        }
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  LECTURE channel
  // ════════════════════════════════════════════════════════════════════

  /**
   * Speak text on the lecture channel. Stops any current lecture speech first.
   */
  speakLecture(text) {
    // If chat is active, stop it first
    if (this.activeChannel === 'chat') {
      this._rawStop();
      this.chat.isSpeaking = false;
      this.chat.isPaused = false;
      this._notifyChat();
    }

    this._savedLecture = null; // fresh lecture, no saved state
    return this._speakOnChannel('lecture', text).catch(() => {});
  }

  pauseLecture() {
    if (this.activeChannel === 'lecture' && this.lecture.isSpeaking && !this.lecture.isPaused) {
      this.synth.pause();
      this.lecture.isPaused = true;
      this._notifyLecture();
    }
  }

  resumeLecture() {
    if (this.activeChannel === 'lecture' && this.lecture.isPaused) {
      this.synth.resume();
      this.lecture.isPaused = false;
      this._notifyLecture();
    }
  }

  toggleLecture() {
    if (this.lecture.isPaused) {
      this.resumeLecture();
    } else if (this.lecture.isSpeaking) {
      this.pauseLecture();
    }
  }

  stopLecture() {
    if (this.activeChannel === 'lecture') {
      this._rawStop();
    }
    this.lecture.isSpeaking = false;
    this.lecture.isPaused = false;
    this.lecture.text = '';
    this.lecture.charIndex = 0;
    this._savedLecture = null;
    if (this.activeChannel === 'lecture') this.activeChannel = null;
    this._notifyLecture();
  }

  // ════════════════════════════════════════════════════════════════════
  //  CHAT channel
  // ════════════════════════════════════════════════════════════════════

  /**
   * Speak text on the chat channel.
   * If lecture is active, it is interrupted and will auto-resume when chat ends.
   */
  speakChat(text) {
    // Save lecture state if it was active
    if (this.lecture.isSpeaking || this.lecture.isPaused) {
      this._savedLecture = {
        text: this.lecture.text,
        charIndex: this.lecture.charIndex,
        wasSpeaking: this.lecture.isSpeaking && !this.lecture.isPaused,
      };

      // Mark lecture as paused (not stopped) so the button shows correctly
      this.lecture.isSpeaking = false;
      this.lecture.isPaused = true; // "paused by chat"
      this._notifyLecture();
    }

    return this._speakOnChannel('chat', text).catch(() => {});
  }

  stopChat() {
    if (this.activeChannel === 'chat') {
      this._rawStop();
    }
    this.chat.isSpeaking = false;
    this.chat.isPaused = false;
    this.chat.text = '';
    this.chat.charIndex = 0;
    if (this.activeChannel === 'chat') this.activeChannel = null;
    this._notifyChat();

    // Resume lecture if it was interrupted
    this._maybeResumeLectureAfterChat();
  }

  _maybeResumeLectureAfterChat() {
    if (!this._savedLecture) return;

    const saved = this._savedLecture;
    this._savedLecture = null;

    if (saved.wasSpeaking) {
      // Resume lecture from where we left off
      const remainingText = saved.text.substring(saved.charIndex).trim();
      if (remainingText.length > 0) {
        // Small delay to let the synth settle after cancel
        setTimeout(() => {
          this.lecture.isPaused = false;
          this._notifyLecture();
          this._speakOnChannel('lecture', remainingText).catch(() => {});
        }, 200);
        return;
      }
    }

    // Lecture wasn't playing or no text left — just reset
    this.lecture.isSpeaking = false;
    this.lecture.isPaused = false;
    this._notifyLecture();
  }

  // ════════════════════════════════════════════════════════════════════
  //  SPEED — immediate application
  // ════════════════════════════════════════════════════════════════════

  setSpeed(speed) {
    const newSpeed = Math.max(CONFIG.tts.minSpeed, Math.min(CONFIG.tts.maxSpeed, speed));
    const oldSpeed = this.speed;
    this.speed = newSpeed;

    // If currently speaking, restart from tracked position with new speed
    if (this.activeChannel && this[this.activeChannel].isSpeaking && !this[this.activeChannel].isPaused) {
      if (oldSpeed !== newSpeed) {
        this._restartAtCurrentPosition();
      }
    }

    this._notifyLecture();
    this._notifyChat();
  }

  /**
   * Cancel the current utterance and re-speak from the last tracked word boundary.
   */
  _restartAtCurrentPosition() {
    const channel = this.activeChannel;
    if (!channel) return;

    const state = this[channel];
    const remainingText = state.text.substring(state.charIndex).trim();

    if (!remainingText) return;

    this._isRestarting = true;
    this.synth.cancel();

    // Small delay to let the synth clean up
    setTimeout(() => {
      this._isRestarting = false;
      // Re-speak remaining text (state.text stays the full original, but we update charIndex base)
      const fullText = state.text;
      const baseIndex = state.charIndex;

      this._speakOnChannel(channel, remainingText).catch(() => {}).then(() => {
        // After this fragment finishes, charIndex was relative to remainingText.
        // No fixup needed since the utterance will fire its own onend.
      });

      // The new utterance's charIndex will be relative to remainingText.
      // We need to offset it back to the original text for resume correctness.
      // Override the boundary handler to account for the offset.
      if (this.currentUtterance) {
        this.currentUtterance.onboundary = (event) => {
          if (event.name === 'word') {
            state.charIndex = baseIndex + event.charIndex;
          }
        };
      }

      // Keep the original full text for future restarts
      state.text = fullText;
    }, 50);
  }

  // ════════════════════════════════════════════════════════════════════
  //  Utility
  // ════════════════════════════════════════════════════════════════════

  /** Raw cancel — no state changes */
  _rawStop() {
    this.synth.cancel();
    this.currentUtterance = null;
  }

  /** Stop everything on all channels */
  stopAll() {
    this._savedLecture = null;
    this._rawStop();
    this.activeChannel = null;

    this.lecture.isSpeaking = false;
    this.lecture.isPaused = false;
    this.lecture.text = '';
    this.lecture.charIndex = 0;

    this.chat.isSpeaking = false;
    this.chat.isPaused = false;
    this.chat.text = '';
    this.chat.charIndex = 0;

    this._notifyLecture();
    this._notifyChat();
  }

  getAvailableVoices() {
    return this.synth.getVoices().filter((v) => v.lang.startsWith('en'));
  }

  setVoice(voiceName) {
    const voices = this.synth.getVoices();
    const found = voices.find((v) => v.name === voiceName);
    if (found) this.voice = found;
  }

  // ════════════════════════════════════════════════════════════════════
  //  Legacy aliases (backward compat)
  // ════════════════════════════════════════════════════════════════════

  speak(text) { return this.speakLecture(text); }
  pause() { this.pauseLecture(); }
  resume() { this.resumeLecture(); }
  toggle() { this.toggleLecture(); }
  stop() { this.stopAll(); }

  get isSpeaking() { return this.lecture.isSpeaking; }
  get isPaused() { return this.lecture.isPaused; }
}

// Singleton
export const ttsService = new TTSService();
