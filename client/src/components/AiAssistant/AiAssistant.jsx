import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, MessageSquare, Trash2, Bot, User } from 'lucide-react';
import { useAiStore } from '../../store/aiStore';
import { useQueryStore } from '../../store/queryStore';
import './AiAssistant.css';

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, sendMessage, isAiLoading, clearChat } = useAiStore();
  const { schema } = useQueryStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || isAiLoading) return;
    sendMessage(input.trim(), schema);
    setInput('');
  };

  return (
    <div className={`ai-assistant-wrapper ${isOpen ? 'open' : ''}`}>
      {/* Floating Button */}
      <button 
        className="ai-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="QueryFlow AI Assistant"
      >
        <Sparkles size={24} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-chat-window glass-panel">
          <div className="ai-chat-header">
            <div className="ai-chat-title">
              <Sparkles size={18} color="#a78bfa" fill="#a78bfa" style={{ filter: 'drop-shadow(0 0 5px rgba(167, 139, 250, 0.5))' }} />
              <span>QueryFlow AI</span>
            </div>
            <div className="ai-chat-actions">
              <button onClick={() => setIsOpen(false)} title="Close" className="btn btn-ghost btn-icon btn-sm">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="ai-chat-messages" ref={scrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`}>
                <div className="ai-message-avatar">
                  {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                </div>
                <div className="ai-message-bubble">
                  {msg.content}
                </div>
              </div>
            ))}
            {isAiLoading && (
              <div className="ai-message assistant">
                <div className="ai-message-avatar">
                  <Bot size={14} />
                </div>
                <div className="ai-message-bubble loading">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="ai-chat-input-area">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your database..."
              disabled={isAiLoading}
            />
            <button type="submit" disabled={!input.trim() || isAiLoading}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
