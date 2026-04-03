import { useState, useRef, useEffect } from 'react';
import { answerQuestion, generateGapSlide } from '../services/ollamaService.js';
import { ttsService } from '../services/ttsService.js';
import { CONFIG } from '../config.js';

export default function ChatSidebar({ isOpen, currentSlide, slides, onInsertSlideBefore, onInsertSlideAfter, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! 👋 I'm your study buddy. Ask me anything about the current slide or topic. I'll explain it in simple terms!",
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isThinking) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setIsThinking(true);

    try {
      const slide = slides[currentSlide] || {};
      const result = await answerQuestion(question, slide, messages);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer,
          shouldCreateSlide: result.shouldCreateSlide,
          confidence: result.confidence,
        },
      ]);

      // Read answer aloud if TTS is enabled
      if (ttsEnabled) {
        ttsService.speak(result.answer).catch(() => {});
      }

      // Offer to insert new slide if LLM recommends it
      if (result.shouldCreateSlide) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            proposal: {
              question,
              slideTitle: slide.title || '',
            },
            content: `📌 It looks like we hit a new concept! Should I create a slide for it before or after the current one?`,
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I couldn't process that. Make sure Ollama is running. Error: ${error.message}`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleInsertGapSlide = async (proposal, msgIndex, direction) => {
    setIsThinking(true);
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, content: 'Generating slide...', proposal: null } : m));
    
    try {
      const gapSlide = await generateGapSlide(proposal.question, proposal.slideTitle);
      if (direction === 'before') {
        onInsertSlideBefore(gapSlide);
      } else {
        onInsertSlideAfter(gapSlide);
      }
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, content: `📌 Gap slide inserted ${direction} the current slide.` } : m));
    } catch (err) {
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, content: 'Failed to generate slide. ' + err.message } : m));
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-sidebar">
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-icon">💬</span>
          <span className="chat-title">Study Q&A</span>
        </div>
        <div className="chat-header-right">
          <button
            className={`tts-toggle ${ttsEnabled ? 'tts-toggle--on' : ''}`}
            onClick={() => setTtsEnabled(!ttsEnabled)}
            title={ttsEnabled ? 'Mute responses' : 'Read responses aloud'}
          >
            {ttsEnabled ? '🔊' : '🔇'}
          </button>
          <button className="chat-close" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
            <div className="chat-msg-bubble">
              {msg.content}
              {msg.shouldCreateSlide && !msg.proposal && (
                <span className="chat-msg-badge">📌 New slide added</span>
              )}
              {msg.proposal && (
                <div className="chat-proposal-actions" style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button className="header-btn" onClick={() => handleInsertGapSlide(msg.proposal, i, 'before')}>Insert Before</button>
                  <button className="header-btn" onClick={() => handleInsertGapSlide(msg.proposal, i, 'after')}>Insert After</button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-msg-bubble chat-thinking">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Ask a question about this slide..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isThinking}
        />
        <button
          className="chat-send"
          onClick={handleSend}
          disabled={!input.trim() || isThinking}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
