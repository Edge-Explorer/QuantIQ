import { useState } from 'react';
import Logo from './Logo';

interface AIInsight {
  ticker: string;
  bullishProbability: number;
  reason: string;
  creditsRemaining: number;
}

interface AIAnalystProps {
  activeTicker: string;
  insight: AIInsight | null;
  savedStrategies: any[];
  loadingInsight: boolean;
  insightError: string | null;
  onTriggerInsight: (tradingStyle: string, riskTolerance: string) => void;
}

export default function AIAnalyst({
  activeTicker,
  insight,
  savedStrategies,
  loadingInsight,
  insightError,
  onTriggerInsight,
}: AIAnalystProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'history'>('analysis');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [tradingStyle, setTradingStyle] = useState('swing_trading');
  const [riskTolerance, setRiskTolerance] = useState('moderate');
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [isRiskOpen, setIsRiskOpen] = useState(false);

  // Parse inline markdown: **bold**, *italic*
  const parseInline = (text: string, keyPrefix: string) => {
    // Handle **bold** and *italic* (in that order, bold first)
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`${keyPrefix}-b${j}`} style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={`${keyPrefix}-i${j}`} style={{ color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  // Full markdown formatter — handles headings, bullets, bold, italic
  const formatReason = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let bulletBuffer: string[] = [];

    const flushBullets = (keyBase: string) => {
      if (bulletBuffer.length === 0) return;
      elements.push(
        <ul key={`ul-${keyBase}`} style={{ margin: '6px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {bulletBuffer.map((item, bi) => (
            <li key={`li-${keyBase}-${bi}`} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, listStyleType: 'disc' }}>
              {parseInline(item, `li-${keyBase}-${bi}`)}
            </li>
          ))}
        </ul>
      );
      bulletBuffer = [];
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushBullets(`${i}`);
        return;
      }

      // ### Heading 3
      if (trimmed.startsWith('### ')) {
        flushBullets(`${i}`);
        elements.push(
          <h4 key={`h3-${i}`} style={{ margin: '14px 0 6px', fontSize: '13px', fontWeight: 700, color: 'var(--neon-cyan)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,242,254,0.15)', paddingBottom: '4px' }}>
            {trimmed.slice(4)}
          </h4>
        );
        return;
      }

      // ## Heading 2
      if (trimmed.startsWith('## ')) {
        flushBullets(`${i}`);
        elements.push(
          <h3 key={`h2-${i}`} style={{ margin: '14px 0 6px', fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
            {parseInline(trimmed.slice(3), `h2-${i}`)}
          </h3>
        );
        return;
      }

      // # Heading 1
      if (trimmed.startsWith('# ')) {
        flushBullets(`${i}`);
        elements.push(
          <h2 key={`h1-${i}`} style={{ margin: '14px 0 8px', fontSize: '15px', fontWeight: 800, color: '#fff' }}>
            {parseInline(trimmed.slice(2), `h1-${i}`)}
          </h2>
        );
        return;
      }

      // * bullet or - bullet
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        bulletBuffer.push(trimmed.slice(2));
        return;
      }

      // Plain paragraph
      flushBullets(`${i}`);
      elements.push(
        <p key={`p-${i}`} className="insight-explanation">
          {parseInline(trimmed, `p-${i}`)}
        </p>
      );
    });

    flushBullets('end');
    return elements;
  };

  const renderGauge = (probability: number) => (
    <div className="probability-gauge">
      <svg className="gauge-svg" width="120" height="120">
        <defs>
          <linearGradient id="cyan-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2fe" />
            <stop offset="100%" stopColor="#a154ff" />
          </linearGradient>
        </defs>
        <circle className="gauge-bg" cx="60" cy="60" r="50"></circle>
        <circle 
          className="gauge-fill" 
          cx="60" 
          cy="60" 
          r="50"
          strokeDasharray={`${2 * Math.PI * 50}`}
          strokeDashoffset={`${2 * Math.PI * 50 * (1 - probability / 100)}`}
        ></circle>
      </svg>
      <div className="gauge-text">
        <span className="gauge-percentage">{probability}%</span>
        <span className="gauge-label">Bullish</span>
      </div>
    </div>
  );

  return (
    <div className="glass-panel insight-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px', height: 'auto' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Logo size={18} className="glow-cyan" />
          <span>QuantIQ AI Analyst</span>
        </div>
        <div className="analyst-tabs" style={{ display: 'flex', gap: '16px' }}>
          <button 
            className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analysis'); setSelectedHistoryItem(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'analysis' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderBottom: activeTab === 'analysis' ? '2px solid var(--neon-cyan)' : 'none',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            Analysis
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'history' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderBottom: activeTab === 'history' ? '2px solid var(--neon-cyan)' : 'none',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            History ({savedStrategies.length})
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'analysis' ? (
          <>
            {!insight && !loadingInsight && (
              <div className="insight-cta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <p className="insight-cta-description" style={{ margin: 0 }}>
                  Analyze indicators, watchlists, alerts, and model prediction in a single ReAct workflow.
                </p>
                
                {/* Style & Risk selectors */}
                {/* Style & Risk selectors */}
                <div className="ai-param-selectors" style={{ display: 'flex', gap: '16px', justifyContent: 'center', width: '100%', maxWidth: '400px', marginBottom: '8px' }}>
                  {/* Trading Style Custom Select */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', position: 'relative' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trading Style</label>
                    <div 
                      onClick={() => {
                        setIsStyleOpen(!isStyleOpen);
                        setIsRiskOpen(false);
                      }}
                      className="premium-select"
                      style={{ 
                        width: '100%', 
                        padding: '10px 14px', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid var(--border-glass)', 
                        borderRadius: '10px', 
                        color: 'var(--text-primary)', 
                        cursor: 'pointer', 
                        fontSize: '12px', 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box',
                        minHeight: '38px'
                      }}
                    >
                      <span>
                        {tradingStyle === 'day_trading' && 'Day Trading'}
                        {tradingStyle === 'swing_trading' && 'Swing Trading'}
                        {tradingStyle === 'investing' && 'Long-term Investing'}
                      </span>
                    </div>

                    {isStyleOpen && (
                      <div 
                        className="glass-dropdown-menu"
                        style={{
                          position: 'absolute',
                          top: '65px',
                          left: 0,
                          width: '100%',
                          background: 'rgba(13, 16, 27, 0.85)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                          zIndex: 100,
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div 
                          className="glass-dropdown-item"
                          onClick={() => {
                            setTradingStyle('day_trading');
                            setIsStyleOpen(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: tradingStyle === 'day_trading' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                            background: tradingStyle === 'day_trading' ? 'rgba(0, 242, 254, 0.06)' : 'none',
                            fontSize: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Day Trading
                        </div>
                        <div 
                          className="glass-dropdown-item"
                          onClick={() => {
                            setTradingStyle('swing_trading');
                            setIsStyleOpen(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: tradingStyle === 'swing_trading' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                            background: tradingStyle === 'swing_trading' ? 'rgba(0, 242, 254, 0.06)' : 'none',
                            fontSize: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Swing Trading
                        </div>
                        <div 
                          className="glass-dropdown-item"
                          onClick={() => {
                            setTradingStyle('investing');
                            setIsStyleOpen(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: tradingStyle === 'investing' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                            background: tradingStyle === 'investing' ? 'rgba(0, 242, 254, 0.06)' : 'none',
                            fontSize: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Long-term Investing
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Risk Profile Custom Select */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', position: 'relative' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Profile</label>
                    <div 
                      onClick={() => {
                        setIsRiskOpen(!isRiskOpen);
                        setIsStyleOpen(false);
                      }}
                      className="premium-select"
                      style={{ 
                        width: '100%', 
                        padding: '10px 14px', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid var(--border-glass)', 
                        borderRadius: '10px', 
                        color: 'var(--text-primary)', 
                        cursor: 'pointer', 
                        fontSize: '12px', 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box',
                        minHeight: '38px'
                      }}
                    >
                      <span>
                        {riskTolerance === 'conservative' && 'Conservative'}
                        {riskTolerance === 'moderate' && 'Moderate'}
                        {riskTolerance === 'aggressive' && 'Aggressive'}
                      </span>
                    </div>

                    {isRiskOpen && (
                      <div 
                        className="glass-dropdown-menu"
                        style={{
                          position: 'absolute',
                          top: '65px',
                          left: 0,
                          width: '100%',
                          background: 'rgba(13, 16, 27, 0.85)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                          zIndex: 100,
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div 
                          className="glass-dropdown-item"
                          onClick={() => {
                            setRiskTolerance('conservative');
                            setIsRiskOpen(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: riskTolerance === 'conservative' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                            background: riskTolerance === 'conservative' ? 'rgba(0, 242, 254, 0.06)' : 'none',
                            fontSize: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Conservative
                        </div>
                        <div 
                          className="glass-dropdown-item"
                          onClick={() => {
                            setRiskTolerance('moderate');
                            setIsRiskOpen(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: riskTolerance === 'moderate' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                            background: riskTolerance === 'moderate' ? 'rgba(0, 242, 254, 0.06)' : 'none',
                            fontSize: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Moderate
                        </div>
                        <div 
                          className="glass-dropdown-item"
                          onClick={() => {
                            setRiskTolerance('aggressive');
                            setIsRiskOpen(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: riskTolerance === 'aggressive' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                            background: riskTolerance === 'aggressive' ? 'rgba(0, 242, 254, 0.06)' : 'none',
                            fontSize: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Aggressive
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button className="insight-btn" onClick={() => onTriggerInsight(tradingStyle, riskTolerance)} style={{ marginTop: '4px' }}>
                  Generate strategy for {activeTicker}
                </button>
              </div>
            )}

            {loadingInsight && (
              <div className="insight-loading">
                <div className="spinner"></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>
                    QuantIQ AI is analyzing {activeTicker}...
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    Running ReAct workflow · Scanning indicators · Generating strategy
                  </span>
                </div>
              </div>
            )}

            {insightError && (
              <div style={{ padding: '20px', color: 'var(--bear-red)', textAlign: 'center' }}>
                {insightError}
              </div>
            )}

            {insight && !loadingInsight && (
              <div className="insight-result">
                {renderGauge(insight.bullishProbability)}
                <div className="insight-text-container">
                  <div className={`insight-tag ${insight.bullishProbability >= 50 ? 'tag-bullish' : 'tag-bearish'}`}>
                    {insight.bullishProbability >= 50 ? 'BULLISH BIAS' : 'BEARISH BIAS'}
                  </div>
                  <div className="insight-reason-body">
                    {formatReason(insight.reason)}
                  </div>
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', lineHeight: '140%', textAlign: 'left' }}>
                    <span style={{ color: 'var(--neon-cyan)', fontWeight: 600 }}>Disclaimer:</span>
                    <span>QuantIQ AI is an automated strategy assistant and can make mistakes. All analysis is for informational purposes only and should not be considered financial advice. Please verify financial data independently.</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Strategy History View */
          <div>
            {selectedHistoryItem ? (
              /* Expanded Historical Report Details */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    Report for <strong style={{ color: 'var(--text-primary)' }}>{selectedHistoryItem.ticker}</strong> generated on {new Date(selectedHistoryItem.createdAt).toLocaleString()}
                  </span>
                  <button 
                    onClick={() => setSelectedHistoryItem(null)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      padding: '4px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    Back to History
                  </button>
                </div>
                
                <div className="insight-result">
                  {renderGauge(selectedHistoryItem.bullishProbability)}
                  <div className="insight-text-container">
                    <div className={`insight-tag ${selectedHistoryItem.bullishProbability >= 50 ? 'tag-bullish' : 'tag-bearish'}`}>
                      {selectedHistoryItem.bullishProbability >= 50 ? 'BULLISH BIAS' : 'BEARISH BIAS'}
                    </div>
                    <div className="insight-reason-body">
                      {formatReason(selectedHistoryItem.reason)}
                    </div>
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', lineHeight: '140%', textAlign: 'left' }}>
                      <span style={{ color: 'var(--neon-cyan)', fontWeight: 600 }}>Disclaimer:</span>
                      <span>QuantIQ AI is an automated strategy assistant and can make mistakes. All analysis is for informational purposes only and should not be considered financial advice. Please verify financial data independently.</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* List of historical reports */
              <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {savedStrategies.length === 0 ? (
                  <div style={{ padding: '40px 20px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '13px' }}>
                    No saved strategies found. Generate your first strategy analysis to build your history!
                  </div>
                ) : (
                  savedStrategies.map((item) => {
                    const dateStr = new Date(item.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const isPositive = item.bullishProbability >= 50;
                    return (
                      <div 
                        key={item.id} 
                        className="history-item"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.ticker}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dateStr}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className={`insight-tag ${isPositive ? 'tag-bullish' : 'tag-bearish'}`} style={{ transform: 'none', animation: 'none', margin: 0, fontSize: '10px', padding: '2px 8px' }}>
                            {item.bullishProbability}% Bullish
                          </span>
                          <button 
                            className="view-history-report-btn"
                            onClick={() => setSelectedHistoryItem(item)}
                            style={{
                              background: 'none',
                              border: '1px solid var(--neon-cyan)',
                              borderRadius: '6px',
                              color: 'var(--neon-cyan)',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                          >
                            View Report
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
