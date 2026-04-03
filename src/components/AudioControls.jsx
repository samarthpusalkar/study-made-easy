import { useState, useEffect } from 'react';
import { ttsService } from '../services/ttsService.js';
import { CONFIG } from '../config.js';

export default function AudioControls({ currentSlide, slides }) {
  const [ttsState, setTtsState] = useState({
    isSpeaking: false,
    isPaused: false,
    speed: CONFIG.tts.defaultSpeed,
  });
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    ttsService.onStateChange = setTtsState;
    return () => { ttsService.onStateChange = null; };
  }, []);

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
    const newSpeed = ttsState.speed + delta;
    ttsService.setSpeed(newSpeed);
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
            disabled={ttsState.speed <= CONFIG.tts.minSpeed}
          >
            −
          </button>
          <span className="audio-speed-label">{ttsState.speed.toFixed(2)}×</span>
          <button
            className="audio-btn audio-btn--sm"
            onClick={() => handleSpeedChange(CONFIG.tts.speedStep)}
            disabled={ttsState.speed >= CONFIG.tts.maxSpeed}
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
          className={`audio-btn audio-btn--auto ${autoPlay ? 'audio-btn--active' : ''}`}
          onClick={() => setAutoPlay(!autoPlay)}
          title={autoPlay ? 'Disable auto-narration' : 'Enable auto-narration'}
        >
          {autoPlay ? '🔄' : '🔁'}
          <span className="audio-btn-label">Auto</span>
        </button>

        {/* Keyboard hint */}
        <span className="audio-hint">Press <kbd>Space</kbd> to play/pause</span>
      </div>
    </div>
  );
}
