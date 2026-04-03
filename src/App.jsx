import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header.jsx';
import UploadView from './components/UploadView.jsx';
import ProcessingView from './components/ProcessingView.jsx';
import SlideViewer from './components/SlideViewer.jsx';
import ChatSidebar from './components/ChatSidebar.jsx';
import AudioControls from './components/AudioControls.jsx';
import LibraryView from './components/LibraryView.jsx';
import { CONFIG } from './config.js';
import { processDocument } from './pipeline/contentPipeline.js';
import { checkOllamaStatus } from './services/ollamaService.js';
import { ttsService } from './services/ttsService.js';

export default function App() {
  const [view, setView] = useState('upload'); // 'upload' | 'processing' | 'presentation' | 'library'
  const [mode, setMode] = useState(null);
  const [slides, setSlides] = useState([]);
  const [savedSessions, setSavedSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [progress, setProgress] = useState({ step: '', message: '', percent: 0 });
  const [error, setError] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState(null);

  const persistSessions = useCallback((updated) => {
    try {
      localStorage.setItem(CONFIG.app.storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save sessions locally', e);
    }
  }, []);

  // Load sessions from local storage on mount
  useEffect(() => {
    const loadSessions = () => {
      const sessionsJson = localStorage.getItem(CONFIG.app.storageKey);
      if (sessionsJson) {
        try {
          const parsed = JSON.parse(sessionsJson);
          if (Array.isArray(parsed)) {
            setSavedSessions(parsed);
          }
        } catch (e) {
          console.error('Failed to load saved sessions', e);
        }
      }
    };

    loadSessions();
    checkOllamaStatus().then(setOllamaStatus);
  }, []);

  // Save changes to current session if it exists & slides change (e.g., gap slides added)
  useEffect(() => {
    if (slides.length > 0 && currentSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedSessions((prev) => {
        const updated = prev.map(s => s.id === currentSessionId ? { ...s, slides } : s);
        persistSessions(updated);
        return updated;
      });
    }
  }, [slides, currentSessionId, persistSessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (view !== 'presentation') return;

      // Ignore if typing in chat input
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (ttsService.isSpeaking || ttsService.isPaused) {
            ttsService.toggle();
          } else {
            const slide = slides[currentSlide];
            if (slide) {
              const text = slide.speakerNotes || `${slide.title}. ${slide.bullets.join('. ')}`;
              ttsService.speak(text).catch(() => {});
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentSlide((s) => Math.max(0, s - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentSlide((s) => Math.min(slides.length - 1, s + 1));
          break;
        case 'KeyC':
          if (!e.ctrlKey && !e.metaKey) {
            setChatOpen((o) => !o);
          }
          break;
        case 'Escape':
          setChatOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, slides, currentSlide]);

  const handleSubmit = useCallback(async (input, selectedMode) => {
    setMode(selectedMode);
    setView('processing');
    setError(null);
    setProgress({ step: 'parsing', message: 'Starting...', percent: 0 });

    try {
      const result = await processDocument(input, selectedMode, setProgress);
      
      // Save new session
      const newSession = {
        id: Date.now().toString(),
        title: result.slides[0]?.title || result.metadata.fileName || 'Untitled Study Session',
        createdAt: new Date().toISOString(),
        mode: selectedMode,
        slides: result.slides
      };
      
      setSavedSessions(prev => {
        const updated = [newSession, ...prev];
        persistSessions(updated);
        return updated;
      });

      setCurrentSessionId(newSession.id);
      setSlides(result.slides);
      setCurrentSlide(0);
      setView('presentation');
    } catch (err) {
      console.error('Processing error:', err);
      setError(err.message);
      setView('upload');
    }
  }, [persistSessions]);

  const handleInsertSlideBefore = useCallback((newSlide, index) => {
    setSlides((prev) => {
      const updated = [...prev];
      updated.splice(index, 0, newSlide);
      return updated;
    });
    setCurrentSlide(index); // Move to the newly inserted slide before
  }, []);

  const handleInsertSlideAfter = useCallback((newSlide, index) => {
    setSlides((prev) => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newSlide);
      return updated;
    });
    setCurrentSlide(index + 1); // Move to the newly inserted slide after
  }, []);

  const handleNewSession = useCallback(() => {
    ttsService.stop();
    setView('upload');
    setSlides([]);
    setCurrentSessionId(null);
    setCurrentSlide(0);
    setMode(null);
    setChatOpen(false);
    setError(null);
    setProgress({ step: '', message: '', percent: 0 });
  }, []);

  const handleOpenLibrary = useCallback(() => {
    ttsService.stop();
    setView('library');
    setChatOpen(false);
  }, []);

  const handleOpenSession = useCallback((session) => {
    ttsService.stop();
    setSlides(session.slides);
    setMode(session.mode);
    setCurrentSessionId(session.id);
    setCurrentSlide(0);
    setChatOpen(false);
    setView('presentation');
  }, []);

  const handleDeleteSession = useCallback((id) => {
    setSavedSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      persistSessions(updated);
      return updated;
    });
    if (currentSessionId === id && view === 'presentation') {
      handleNewSession();
    }
  }, [currentSessionId, view, handleNewSession, persistSessions]);

  return (
    <div className="app">
      <Header mode={mode} view={view} onNewSession={handleNewSession} onOpenLibrary={handleOpenLibrary} />

      <main className="app-main">
        {/* Ollama status warning */}
        {ollamaStatus && !ollamaStatus.available && view === 'upload' && (
          <div className="status-banner status-banner--error">
            <span>⚠️</span>
            <span>{ollamaStatus.error}</span>
            <span className="status-hint">
              Run <code>ollama serve</code> and <code>ollama pull {CONFIG.ollama.model}</code> to get started.
            </span>
          </div>
        )}
        {ollamaStatus && ollamaStatus.available && !ollamaStatus.hasModel && view === 'upload' && (
          <div className="status-banner status-banner--warning">
            <span>⚠️</span>
            <span>{ollamaStatus.error}</span>
            <span className="status-hint">
              Pull it with <code>ollama pull {CONFIG.ollama.model}</code>.
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="status-banner status-banner--error">
            <span>❌</span>
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Views */}
        {view === 'upload' && <UploadView onSubmit={handleSubmit} />}

        {view === 'library' && (
          <LibraryView 
            sessions={savedSessions} 
            onOpenSession={handleOpenSession} 
            onDeleteSession={handleDeleteSession} 
          />
        )}

        {view === 'processing' && <ProcessingView progress={progress} />}

        {view === 'presentation' && (
          <div className={`presentation-layout ${chatOpen ? 'presentation-layout--chat-open' : ''}`}>
            <SlideViewer
              slides={slides}
              currentSlide={currentSlide}
              onSlideChange={setCurrentSlide}
              onToggleChat={() => setChatOpen((o) => !o)}
            />
            <ChatSidebar
              isOpen={chatOpen}
              currentSlide={currentSlide}
              slides={slides}
              onInsertSlideBefore={(slide) => handleInsertSlideBefore(slide, currentSlide)}
              onInsertSlideAfter={(slide) => handleInsertSlideAfter(slide, currentSlide)}
              onClose={() => setChatOpen(false)}
            />
            <AudioControls
              currentSlide={currentSlide}
              slides={slides}
            />
          </div>
        )}
      </main>
    </div>
  );
}
