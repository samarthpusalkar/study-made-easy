import { useState, useRef, useCallback } from 'react';
import { CONFIG } from '../config.js';

export default function UploadView({ onSubmit }) {
  const [mode, setMode] = useState('revision');
  const [textInput, setTextInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTextInput('');
    }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTextInput('');
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onSubmit(selectedFile, mode);
    } else if (textInput.trim()) {
      onSubmit(textInput.trim(), mode);
    }
  };

  const canSubmit = selectedFile || textInput.trim().length > 20;
  const modes = Object.entries(CONFIG.modes);

  return (
    <div className="upload-view">
      {/* Animated background */}
      <div className="upload-bg">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <div className="upload-content">
        {/* Hero */}
        <div className="upload-hero">
          <div className="hero-icon">📖✨</div>
          <h1 className="hero-title">
            <span className="gradient-text">Study Smarter</span>
            <br />
            Not Harder
          </h1>
          <p className="hero-subtitle">
            Transform any study material into interactive slides with AI narration & Q&A
          </p>
        </div>

        {/* Upload area */}
        <div className="upload-section">
          <div
            className={`drop-zone ${dragActive ? 'drop-zone--active' : ''} ${selectedFile ? 'drop-zone--file' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.html,.htm,.pdf"
              onChange={handleFileSelect}
              className="file-input-hidden"
            />
            {selectedFile ? (
              <div className="drop-zone-file">
                <span className="file-icon">📄</span>
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
                <button
                  className="file-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="drop-zone-empty">
                <span className="drop-icon">📁</span>
                <p className="drop-text">
                  <strong>Drop your file here</strong> or click to browse
                </p>
                <p className="drop-hint">Supports .txt, .md, .html, .pdf</p>
              </div>
            )}
          </div>

          <div className="upload-divider">
            <span>OR</span>
          </div>

          <div className="text-input-wrapper">
            <textarea
              className="text-input"
              placeholder="Paste your study material here...&#10;&#10;Example: Copy-paste lecture notes, textbook chapters, or any educational content you want to turn into slides."
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value);
                setSelectedFile(null);
              }}
              rows={6}
            />
            {textInput && (
              <span className="text-count">
                {textInput.split(/\s+/).filter(Boolean).length} words
              </span>
            )}
          </div>
        </div>

        {/* Mode selector */}
        <div className="mode-section">
          <h2 className="section-label">Choose your study mode</h2>
          <div className="mode-cards">
            {modes.map(([key, cfg]) => (
              <button
                key={key}
                className={`mode-card ${mode === key ? 'mode-card--active' : ''}`}
                onClick={() => setMode(key)}
              >
                <span className="mode-icon">{cfg.icon}</span>
                <span className="mode-label">{cfg.label}</span>
                <span className="mode-desc">{cfg.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          className="cta-button"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          <span className="cta-icon">🚀</span>
          <span>Generate Study Slides</span>
        </button>
      </div>
    </div>
  );
}
