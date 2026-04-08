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
  const [lectureState, setLectureState] = useState({
    isSpeaking: false,
    isPaused: false,
    speed: currentSpeed,
  });

  // Subscribe to lecture channel state only
  useEffect(() => {
    ttsService.onLectureStateChange = setLectureState;
    return () => { ttsService.onLectureStateChange = null; };
  }, []);

  // Sync speed to TTS service when preference changes
  useEffect(() => {
    ttsService.setSpeed(currentSpeed);
  }, [currentSpeed]);

  const _getSlideText = () => {
    const slide = slides[currentSlide];
    if (!slide) return null;
    return slide.speakerNotes || `${slide.title}. ${slide.bullets.join('. ')}`;
  };

  const handlePlayPause = () => {
    if (lectureState.isSpeaking || lectureState.isPaused) {
      // Currently speaking or paused → toggle
      ttsService.toggleLecture();
    } else {
      // Not speaking → start lecture narration
      const text = _getSlideText();
      if (text) {
        ttsService.speakLecture(text);
      }
    }
  };

  const handleStop = () => {
    ttsService.stopLecture();
  };

  const handleSpeedChange = (delta) => {
    const newSpeed = Math.max(
      CONFIG.tts.minSpeed,
      Math.min(CONFIG.tts.maxSpeed, currentSpeed + delta)
    );

    // setSpeed immediately restarts the utterance at the new rate
    ttsService.setSpeed(newSpeed);
    onAudioPreferencesChange?.({ speed: newSpeed });
  };

  // Auto-play narration when slide changes (only on lecture channel)
  useEffect(() => {
    if (autoPlay && slides[currentSlide]) {
      const slide = slides[currentSlide];
      const text = slide.speakerNotes || `${slide.title}. ${slide.bullets.join('. ')}`;
      ttsService.stopLecture();
      setTimeout(() => {
        ttsService.speakLecture(text);
      }, 400);
    }
  }, [currentSlide, autoPlay, slides]);

  // When autoPlay is toggled OFF, stop current lecture narration immediately
  // When toggled ON, start narrating current slide
  const handleAutoPlayToggle = () => {
    const newAutoPlay = !autoPlay;
    onAudioPreferencesChange?.({ autoPlay: newAutoPlay });

    if (!newAutoPlay) {
      // Switching to manual — stop any active lecture narration
      ttsService.stopLecture();
    }
    // If switching to auto, the autoPlay useEffect above will fire and start narration
  };

  // Determine button icon — always reflects lecture state, never chat
  const showPause = lectureState.isSpeaking && !lectureState.isPaused;
  const showPlay = !lectureState.isSpeaking || lectureState.isPaused;
  const isActive = lectureState.isSpeaking || lectureState.isPaused;

  return (
    <div className="audio-controls">
      <div className="audio-controls-inner">
        <div className="audio-controls-group audio-controls-group--transport">
          {/* Play/Pause */}
          <button
            className={`audio-btn audio-btn--play ${isActive ? 'audio-btn--active' : ''}`}
            onClick={handlePlayPause}
            title={showPause ? 'Pause narration' : lectureState.isPaused ? 'Resume narration' : 'Play narration'}
          >
            {showPause ? '⏸' : '▶'}
          </button>

          {/* Stop */}
          <button
            className="audio-btn"
            onClick={handleStop}
            disabled={!isActive}
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
          <div className={`audio-wave ${showPause ? 'audio-wave--active' : ''}`}>
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
          </div>
        </div>

        <div className="audio-controls-group audio-controls-group--preferences">
          {/* Auto-play toggle */}
          <button
            className={`audio-btn audio-btn--mode ${autoPlay ? 'audio-btn--active' : ''}`}
            onClick={handleAutoPlayToggle}
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
    </div>
  );
}
