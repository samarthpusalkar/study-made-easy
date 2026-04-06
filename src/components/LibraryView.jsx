import React from 'react';

export default function LibraryView({ sessions, onOpenSession, onDeleteSession }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="upload-view library-view">
        <div className="upload-content library-empty">
          <div className="hero-icon">📚</div>
          <h1 className="hero-title">Your <span className="gradient-text">Library</span></h1>
          <p className="hero-subtitle">You haven't saved any study sessions yet. Upload a document to generate your first one!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-view library-view">
      <div className="upload-content library-content">
        <div className="library-header">
          <h1 className="hero-title">Your <span className="gradient-text">Library</span></h1>
          <p className="hero-subtitle">Revisit your previously generated study sessions without waiting.</p>
        </div>

        <div className="library-grid">
          {sessions.map((session) => (
            <article key={session.id} className="library-card">
              <h3 className="library-card-title" title={session.title || 'Untitled Session'}>
                {session.title || 'Untitled Session'}
              </h3>

              <div className="library-card-meta">
                <div>📅 {new Date(session.createdAt).toLocaleDateString()}</div>
                <div>📊 {session.slides?.length || 0} Slides generated</div>
                <div>🧠 Mode: <span className="library-card-mode">{session.mode?.replace('-', ' ') || 'Unknown'}</span></div>
              </div>

              <div className="library-card-actions">
                <button
                  className="cta-button library-open-btn"
                  onClick={() => onOpenSession(session)}
                >
                  Open
                </button>
                <button
                  className="header-btn library-delete-btn"
                  onClick={() => onDeleteSession(session.id)}
                  title="Delete Session"
                  aria-label={`Delete ${session.title || 'session'}`}
                >
                  🗑️
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
