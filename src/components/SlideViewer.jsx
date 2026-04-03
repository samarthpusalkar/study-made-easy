import { useState, useCallback, useEffect } from 'react';
import { evaluateAnswer } from '../services/ollamaService.js';

export default function SlideViewer({ slides, currentSlide, onSlideChange, onToggleChat }) {
  const [userAnswer, setUserAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    setUserAnswer('');
    setEvaluation(null);
    setIsEvaluating(false);
  }, [currentSlide]);

  const handleCheckAnswer = async (slide) => {
    if (!userAnswer.trim() || isEvaluating) return;
    setIsEvaluating(true);
    try {
      const slideContext = `${slide.title}. ${slide.bullets.join('. ')} ${slide.speakerNotes || ''}`;
      const result = await evaluateAnswer(slide.selfTestQuestion, userAnswer, slideContext);
      setEvaluation(result);
    } catch {
      setEvaluation("Failed to evaluate answer. Please ensure Ollama is running.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const goPrev = useCallback(() => {
    onSlideChange(Math.max(0, currentSlide - 1));
  }, [currentSlide, onSlideChange]);

  const goNext = useCallback(() => {
    onSlideChange(Math.min(slides.length - 1, currentSlide + 1));
  }, [currentSlide, slides.length, onSlideChange]);

  const goTo = useCallback((index) => {
    onSlideChange(index);
  }, [onSlideChange]);

  const slide = slides[currentSlide];

  if (!slide) return null;

  return (
    <div className="slide-viewer">
      {/* Custom navigation bar */}
      <div className="slide-nav">
        <button className="slide-nav-btn" onClick={goPrev} disabled={currentSlide === 0}>
          ←
        </button>
        <div className="slide-counter">
          <span className="slide-current">{currentSlide + 1}</span>
          <span className="slide-sep">/</span>
          <span className="slide-total">{slides.length}</span>
        </div>
        <button className="slide-nav-btn" onClick={goNext} disabled={currentSlide === slides.length - 1}>
          →
        </button>
        <button className="slide-nav-btn slide-chat-toggle" onClick={onToggleChat} title="Toggle Q&A Chat (C)">
          💬
        </button>
      </div>

      {/* Slide display */}
      <div className="slide-stage">
        <div className="slide-content" key={currentSlide}>
          {slide.isGapSlide && (
            <div className="slide-badge">🔍 Gap-Fill Slide</div>
          )}

          <h2 className="slide-title">{slide.title}</h2>

          <div className="slide-bullets">
            {slide.bullets.map((bullet, bi) => (
              <div
                key={bi}
                className="slide-bullet"
                style={{ animationDelay: `${bi * 0.12}s` }}
              >
                {bullet}
              </div>
            ))}
          </div>

          {slide.example && (
            <div className="slide-example">
              <span className="example-label">💡 Example</span>
              <p>{slide.example}</p>
            </div>
          )}

          {slide.selfTestQuestion && (
            <div className="slide-self-test">
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>{slide.selfTestQuestion}</div>
              {!evaluation ? (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input 
                    type="text" 
                    value={userAnswer} 
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="text-input"
                    style={{ minHeight: '40px', padding: '8px', flex: 1 }}
                    onKeyDown={(e) => { if(e.key === 'Enter') handleCheckAnswer(slide); }}
                  />
                  <button 
                    className="header-btn" 
                    onClick={() => handleCheckAnswer(slide)}
                    disabled={isEvaluating || !userAnswer.trim()}
                  >
                    {isEvaluating ? 'Checking...' : 'Check Answer'}
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(124, 92, 252, 0.1)', borderRadius: '8px', borderLeft: '4px solid #7c5cfc' }}>
                  <div style={{ fontSize: '0.9rem' }}>{evaluation}</div>
                  <button className="header-btn" style={{ marginTop: '8px' }} onClick={() => { setEvaluation(null); setUserAnswer(''); }}>Try Again</button>
                </div>
              )}
            </div>
          )}

          {slide.complexity_score != null && (
            <div className="slide-complexity">
              <span className="complexity-label">Complexity</span>
              <div className="complexity-dots">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`complexity-dot ${n <= slide.complexity_score ? 'complexity-dot--filled' : ''}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide mini-map */}
      <div className="slide-minimap">
        {slides.map((s, i) => (
          <button
            key={i}
            className={`minimap-dot ${i === currentSlide ? 'minimap-dot--active' : ''} ${s.isGapSlide ? 'minimap-dot--gap' : ''}`}
            onClick={() => goTo(i)}
            title={s.title}
          />
        ))}
      </div>
    </div>
  );
}
