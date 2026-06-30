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
  onTriggerInsight: () => void;
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

  // Custom parser to format **bold** words in neon-cyan and support paragraph newlines
  const formatReason = (text: string) => {
    if (!text) return null;
    const paragraphs = text.split('\n');
    return paragraphs.map((para, i) => {
      if (!para.trim()) return null;
      const parts = para.split(/\*\*([^*]+)\*\*/g);
      return (
        <p key={i} className="insight-explanation">
          {parts.map((part, j) => {
            if (j % 2 === 1) {
              return (
                <strong key={j} style={{ color: 'var(--neon-cyan)', fontWeight: 600 }}>
                  {part}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
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
    <div className="glass-panel insight-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              <div className="insight-cta">
                <p className="insight-cta-description">
                  Analyze indicators, watchlists, alerts, and model prediction in a single ReAct workflow.
                </p>
                <button className="insight-btn" onClick={onTriggerInsight}>
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
