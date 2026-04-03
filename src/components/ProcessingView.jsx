import { useEffect, useState } from 'react';

const STEPS = [
  { key: 'parsing', label: 'Parsing Document', icon: '📄' },
  { key: 'analyzing', label: 'Analyzing Complexity', icon: '🔍' },
  { key: 'enriching', label: 'Enriching Content', icon: '🌐' },
  { key: 'generating', label: 'Generating Slides', icon: '🎨' },
  { key: 'audio', label: 'Preparing Audio', icon: '🔊' },
  { key: 'complete', label: 'Done!', icon: '✅' },
];

export default function ProcessingView({ progress }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const currentStepIndex = STEPS.findIndex((s) => s.key === progress.step);

  return (
    <div className="processing-view">
      <div className="processing-card">
        {/* Animated brain icon */}
        <div className="processing-brain">
          <div className="brain-pulse" />
          <span className="brain-emoji">🧠</span>
        </div>

        <h2 className="processing-title">
          Crafting Your Study Session{dots}
        </h2>

        <p className="processing-message">{progress.message}</p>

        {/* Progress bar */}
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress.percent}%` }}
          />
          <span className="progress-percent">{Math.round(progress.percent)}%</span>
        </div>

        {/* Steps */}
        <div className="processing-steps">
          {STEPS.map((step, i) => {
            let status = 'pending';
            if (i < currentStepIndex) status = 'done';
            else if (i === currentStepIndex) status = 'active';

            return (
              <div key={step.key} className={`processing-step processing-step--${status}`}>
                <span className="step-icon">
                  {status === 'done' ? '✅' : step.icon}
                </span>
                <span className="step-label">{step.label}</span>
                {status === 'active' && <span className="step-spinner" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
