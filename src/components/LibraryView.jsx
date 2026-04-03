import React from 'react';

export default function LibraryView({ sessions, onOpenSession, onDeleteSession }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="upload-view">
        <div className="upload-content" style={{ textAlign: 'center', marginTop: '10vh' }}>
          <div className="hero-icon">📚</div>
          <h1 className="hero-title">Your <span className="gradient-text">Library</span></h1>
          <p className="hero-subtitle">You haven't saved any study sessions yet. Upload a document to generate your first one!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-view" style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
      <div className="upload-content" style={{ maxWidth: '900px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <h1 className="hero-title">Your <span className="gradient-text">Library</span></h1>
          <p className="hero-subtitle">Revisit your previously generated study sessions without waiting.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
          {sessions.map((session) => (
            <div key={session.id} style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
              transition: 'all var(--transition-base)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.title || 'Untitled Session'}
              </h3>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>📅 {new Date(session.createdAt).toLocaleDateString()}</div>
                <div>📊 {session.slides?.length || 0} Slides generated</div>
                <div>🧠 Mode: <span style={{ textTransform: 'capitalize' }}>{session.mode?.replace('-', ' ') || 'Unknown'}</span></div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
                <button 
                  className="cta-button" 
                  style={{ padding: 'var(--space-sm)', fontSize: '0.9rem', flex: 1 }}
                  onClick={() => onOpenSession(session)}
                >
                  Open
                </button>
                <button 
                  className="header-btn" 
                  style={{ background: 'rgba(252, 92, 92, 0.1)', color: 'var(--accent-4)', borderColor: 'rgba(252, 92, 92, 0.3)' }}
                  onClick={() => onDeleteSession(session.id)}
                  title="Delete Session"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
