import { CONFIG } from '../config.js';

export default function Header({ mode, view, onNewSession, onOpenLibrary }) {
  const modeConfig = mode ? CONFIG.modes[mode] : null;

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo">
          <span className="logo-icon">📖✨</span>
          <span className="logo-text">{CONFIG.app.name}</span>
        </div>
      </div>

      <div className="header-center">
        {modeConfig && view === 'presentation' && (
          <div className="header-mode-badge">
            <span>{modeConfig.icon}</span>
            <span>{modeConfig.label}</span>
          </div>
        )}
      </div>

      <div className="header-right">
        {view !== 'library' && (
          <button className="header-btn" onClick={onOpenLibrary}>
            <span style={{ fontSize: '1.2rem' }}>📚</span>
            <span>Library</span>
          </button>
        )}
        {view !== 'upload' && (
          <button className="header-btn" onClick={onNewSession}>
            <span>+</span>
            <span>New Session</span>
          </button>
        )}
      </div>
    </header>
  );
}
