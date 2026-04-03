import { useState, useEffect } from 'react';
import { ttsService } from '../services/ttsService.js';
import { CONFIG } from '../config.js';

export default function AudioControls({
  currentSlide,
  slides,
  audioPreferences,
  onAudioPreferencesChange,
}) {
  const autoPlay = audioPreferences?.autoPlay ?? CONFIG.preferences.audio.autoPlay;
  const currentSpeed = audioPreferences?.speed ?? CONFIG.preferences.audio.speed;
  const [ttsState, setTtsState] = useState({
    isSpeaking: false,
    isPaused: false,
    speed: currentSpeed,
  });

  useEffect(() => {
    ttsService.onStateChange = setTtsState;
    return () => { ttsService.onStateChange = null; };
  }, []);

  useEffect(() => {
    ttsService.setSpeed(currentSpeed);
  }, [currentSpeed]);

  const handlePlayPause = () => {
    if (ttsState.isSpeaking) {
      ttsService.toggle();
    } else {
      // Start speaking current slide
      const slide = slides[currentSlide];
      if (slide) {
        const text = slide.speakerNotes || `${slide.title}. ${slide.bullets.join('. ')}`;
        ttsService.speak(text).catch(() => {});
      }
    }
  };

  const handleStop = () => {
    ttsService.stop();
  };

  const handleSpeedChange = (delta) => {
    const newSpeed = Math.max(
      CONFIG.tts.minSpeed,
      Math.min(CONFIG.tts.maxSpeed, currentSpeed + delta)
    );

    ttsService.setSpeed(newSpeed);
    onAudioPreferencesChange?.({ speed: newSpeed });
  };

  // Auto-play narration when slide changes
  useEffect(() => {
    if (autoPlay && slides[currentSlide]) {
      const slide = slides[currentSlide];
      const text = slide.speakerNotes || `${slide.title}. ${slide.bullets.join('. ')}`;
      ttsService.stop();
      setTimeout(() => {
        ttsService.speak(text).catch(() => {});
      }, 400);
    }
  }, [currentSlide, autoPlay, slides]);

  return (
    <div className="audio-controls">
      <div className="audio-controls-inner">
        {/* Play/Pause */}
        <button
          className={`audio-btn audio-btn--play ${ttsState.isSpeaking ? 'audio-btn--active' : ''}`}
          onClick={handlePlayPause}
          title={ttsState.isSpeaking ? (ttsState.isPaused ? 'Resume' : 'Pause') : 'Play narration'}
        >
          {ttsState.isSpeaking ? (ttsState.isPaused ? '▶' : '⏸') : '▶'}
        </button>

        {/* Stop */}
        <button
          className="audio-btn"
          onClick={handleStop}
          disabled={!ttsState.isSpeaking}
          title="Stop"
        >
          ⏹
        </button>

        {/* Speed controls */}
        <div className="audio-speed">
          <button
            className="audio-btn audio-btn--sm"
            onClick={() => handleSpeedChange(-CONFIG.tts.speedStep)}
            disabled={currentSpeed <= CONFIG.tts.minSpeed}
          >
            −
          </button>
          <span className="audio-speed-label">{currentSpeed.toFixed(2)}×</span>
          <button
            className="audio-btn audio-btn--sm"
            onClick={() => handleSpeedChange(CONFIG.tts.speedStep)}
            disabled={currentSpeed >= CONFIG.tts.maxSpeed}
          >
            +
          </button>
        </div>

        {/* Waveform animation */}
        <div className={`audio-wave ${ttsState.isSpeaking && !ttsState.isPaused ? 'audio-wave--active' : ''}`}>
          <span className="wave-bar" />
          <span className="wave-bar" />
          <span className="wave-bar" />
          <span className="wave-bar" />
          <span className="wave-bar" />
        </div>

        {/* Auto-play toggle */}
        <button
          className={`audio-btn audio-btn--mode ${autoPlay ? 'audio-btn--active' : ''}`}
          onClick={() => onAudioPreferencesChange?.({ autoPlay: !autoPlay })}
          title={
            autoPlay
              ? 'Narration starts automatically on each slide. Click to switch to manual mode.'
              : 'Narration starts only when you press play. Click to switch to auto mode.'
          }
        >
          <span className="audio-mode-icon" aria-hidden="true">
            {autoPlay ? '🔊' : '▶'}
          </span>
          <span className="audio-mode-label">
            {autoPlay ? 'Auto Narration' : 'Manual Start'}
          </span>
        </button>

        {/* Keyboard hint */}
        <span className="audio-hint">Press <kbd>Space</kbd> to play/pause</span>
      </div>
    </div>
  );
}
