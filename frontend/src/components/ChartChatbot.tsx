import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Lock, ArrowRight, Loader2 } from 'lucide-react';
import Logo from './Logo';

interface ChartChatbotProps {
  ticker: string;
  markers: Array<{ price: number; label: string; color: string }>;
  activeIndicators: { sma: boolean; ema: boolean; rsi: boolean };
  user: any;
  onOpenRecharge?: () => void;
}

export default function ChartChatbot({ ticker, markers, activeIndicators, user, onOpenRecharge }: ChartChatbotProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(() => {
    const saved = localStorage.getItem(`quantiq_chat_history_${ticker}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse chat history:', e);
      }
    }
    return [
      {
        role: 'assistant',
        content: `Hello! I am your QuantIQ AI Strategy Advisor. I have analyzed the chart for ${ticker} and loaded your custom reference markers. Ask me anything about your entry/exit levels or risk setup!`
      }
    ];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Track chatbot trial message count
  const [trialUsed, setTrialUsed] = useState<boolean>(() => {
    return localStorage.getItem('quantiq_chatbot_trial_used') === 'true';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Check if user is a paid tier (Trader/Pro packs have > 10 credits) or is the test email
  const isPaidUser = user && (user.credits > 10 || user.email === 'karanshelar8775@gmail.com');
  const isTrialLocked = !isPaidUser && trialUsed;

  // Load chat history on ticker change
  useEffect(() => {
    const saved = localStorage.getItem(`quantiq_chat_history_${ticker}`);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
        return;
      } catch (e) {
        console.error('Failed to parse chat history on ticker change:', e);
      }
    }
    setMessages([
      {
        role: 'assistant',
        content: `Hello! I am your QuantIQ AI Strategy Advisor. I have analyzed the chart for ${ticker} and loaded your custom reference markers. Ask me anything about your entry/exit levels or risk setup!`
      }
    ]);
  }, [ticker]);

  // Save chat history to localStorage and scroll to bottom
  useEffect(() => {
    localStorage.setItem(`quantiq_chat_history_${ticker}`, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, ticker]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || isTrialLocked) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message to log
    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(updatedMessages);

    try {
      const response = await fetch(`${API_URL}/api/v1/analyst/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticker,
          message: userMessage,
          history: updatedMessages.slice(0, -1), // Send previous turns
          markers,
          activeIndicators
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        
        // If they are a free user, trigger the 1-time trial limit
        if (!isPaidUser) {
          localStorage.setItem('quantiq_chatbot_trial_used', 'true');
          setTrialUsed(true);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an issue compiling the strategy feedback. Please try again." }]);
      }
    } catch (err) {
      console.error('Failed to chat with AI analyst:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Failed to connect to the AI Strategy engine. Verify your internet connection." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="glass-panel" 
      style={{
        width: '340px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: '1px solid var(--border-glass)',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'rgba(13, 16, 27, 0.85)',
        backdropFilter: 'blur(24px)',
        zIndex: 10,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'linear-gradient(90deg, rgba(0, 242, 254, 0.05) 0%, rgba(161, 84, 255, 0.05) 100%)'
        }}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(0, 242, 254, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(0, 242, 254, 0.2)'
        }}>
          <Logo size={18} />
        </div>
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Quant AI Advisor <Sparkles size={11} color="var(--neon-violet)" />
          </h3>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Live Canvas Interactive Chat</span>
        </div>

        {/* Trial Badge */}
        {!isPaidUser && (
          <span 
            style={{
              marginLeft: 'auto',
              fontSize: '9px',
              fontWeight: 700,
              background: trialUsed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: trialUsed ? '#ef4444' : '#10b981',
              padding: '2px 6px',
              borderRadius: '4px',
              border: `1px solid ${trialUsed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
            }}
          >
            {trialUsed ? '0 Trials Left' : '1 Trial Left'}
          </span>
        )}
      </div>

      {/* Message Feed */}
      <div 
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative'
        }}
      >
        {/* Faint Logo Watermark Background */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.025,
          pointerEvents: 'none',
          zIndex: 0
        }}>
          <Logo size={130} />
        </div>
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div 
              key={index}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: isUser ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isUser ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '10px 12px',
                color: isUser ? '#fff' : 'var(--text-secondary)',
                fontSize: '12px',
                lineHeight: 1.5,
                textAlign: 'left',
                position: 'relative',
                zIndex: 1
              }}
            >
              {msg.content}
            </div>
          );
        })}
        {loading && (
          <div 
            style={{
              alignSelf: 'flex-start',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px 12px 12px 2px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}
          >
            <Loader2 size={12} className="animate-spin" /> Analyzing canvas strategy...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input or Lock overlay */}
      <div 
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(10, 11, 20, 0.5)'
        }}
      >
        {isTrialLocked ? (
          <div 
            className="animate-fade"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '6px 0',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#ef4444', fontSize: '12px', fontWeight: 700 }}>
              <Lock size={12} /> Trial Expired
            </div>
            <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Unlock unlimited interactive chatbot sessions and custom indicator weights.
            </p>
            <button 
              onClick={() => {
                sessionStorage.setItem('quantiq_restore_maximized_chart', 'true');
                onOpenRecharge?.();
              }}
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-violet) 100%)',
                border: 'none',
                color: '#000',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'opacity 0.2s'
              }}
            >
              Upgrade Plan <ArrowRight size={11} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Advisor about markers..."
              disabled={loading}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--neon-cyan)',
                color: '#000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: (!input.trim() || loading) ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              <Send size={14} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
