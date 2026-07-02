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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Helper to format text markdown bold/italics, headers, bullets, and clean up stray symbols
  const formatMessageContent = (text: string) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      let cleanedLine = line;
      
      // 1. Convert headers (e.g., #### Header or ### Header) to clean bold blocks
      const headerMatch = cleanedLine.match(/^(#{1,6})\s*(.*)$/);
      let isHeader = false;
      if (headerMatch) {
        cleanedLine = headerMatch[2];
        isHeader = true;
      }
      
      // 2. Convert bullet list points into clean lists
      const bulletMatch = cleanedLine.match(/^(\*|-)\s+(.*)$/);
      let isBullet = false;
      if (bulletMatch) {
        cleanedLine = bulletMatch[2];
        isBullet = true;
      }
      
      // 3. Parse inline bold (**text**) and italic (*text*) segments
      const parts = cleanedLine.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      const parsedInline = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ color: '#fff', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        } else if (part.startsWith('*') && part.endsWith('*')) {
          return <span key={i} style={{ color: 'var(--neon-cyan)', fontWeight: 500 }}>{part.slice(1, -1)}</span>;
        }
        // Remove any leftover stray asterisks in plain text segments
        return part.replace(/\*/g, '');
      });

      // Render line structure
      if (isHeader) {
        return (
          <h4 key={lineIdx} style={{ margin: '14px 0 6px 0', fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>
            {parsedInline}
          </h4>
        );
      }
      
      if (isBullet) {
        return (
          <div key={lineIdx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', margin: '4px 0 4px 8px' }}>
            <span style={{ color: 'var(--neon-cyan)', fontSize: '12px', lineHeight: '18px' }}>•</span>
            <div style={{ flex: 1 }}>{parsedInline}</div>
          </div>
        );
      }
      
      return (
        <p key={lineIdx} style={{ margin: cleanedLine.trim() === '' ? '0' : '0 0 8px 0', minHeight: cleanedLine.trim() === '' ? '8px' : 'auto' }}>
          {parsedInline}
        </p>
      );
    });
  };

  // Auto adjust textarea height on input change
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

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

  const handleSendMessage = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading || isTrialLocked) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '38px';
    }
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
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'rgba(8, 9, 16, 0.9)',
        backdropFilter: 'blur(30px)',
        zIndex: 10,
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 242, 254, 0.02)',
        position: 'relative'
      }}
    >
      {/* Background Cyber Glowing Orbs */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '160px',
        height: '160px',
        background: 'radial-gradient(circle, rgba(161, 84, 255, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '60px',
        left: '-40px',
        width: '160px',
        height: '160px',
        background: 'radial-gradient(circle, rgba(0, 242, 254, 0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
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
                background: isUser 
                  ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(0, 242, 254, 0.02) 100%)' 
                  : 'linear-gradient(135deg, rgba(161, 84, 255, 0.1) 0%, rgba(161, 84, 255, 0.02) 100%)',
                border: isUser 
                  ? '1px solid rgba(0, 242, 254, 0.25)' 
                  : '1px solid rgba(161, 84, 255, 0.18)',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px',
                color: isUser ? '#fff' : 'rgba(255, 255, 255, 0.9)',
                fontSize: '12px',
                lineHeight: 1.5,
                textAlign: 'left',
                position: 'relative',
                zIndex: 1,
                boxShadow: isUser 
                  ? '0 0 12px rgba(0, 242, 254, 0.1)' 
                  : '0 0 12px rgba(161, 84, 255, 0.05)'
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {formatMessageContent(msg.content)}
              </div>
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
            <Loader2 size={12} className="animate-spin" /> Analyzing Quant AI Strategy...
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
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <textarea 
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Ask Advisor about markers..."
              disabled={loading}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.4,
                maxHeight: '120px',
                minHeight: '38px',
                height: '38px',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(0, 242, 254, 0.4)';
                e.target.style.boxShadow = '0 0 12px rgba(0, 242, 254, 0.15), inset 0 1px 2px rgba(0,0,0,0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2)';
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: (!input.trim() || loading) 
                  ? 'rgba(255, 255, 255, 0.05)' 
                  : 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-violet) 100%)',
                color: (!input.trim() || loading) ? 'rgba(255,255,255,0.3)' : '#000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: (!input.trim() || loading) ? 'none' : '0 4px 12px rgba(0, 242, 254, 0.3)',
                transform: 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (input.trim() && !loading) {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 242, 254, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = (!input.trim() || loading) ? 'none' : '0 4px 12px rgba(0, 242, 254, 0.3)';
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
