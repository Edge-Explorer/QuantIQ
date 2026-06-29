
import { Sparkles } from 'lucide-react';

interface AIInsight {
  ticker: string;
  bullishProbability: number;
  reason: string;
  creditsRemaining: number;
}

interface AIAnalystProps {
  activeTicker: string;
  insight: AIInsight | null;
  loadingInsight: boolean;
  insightError: string | null;
  onTriggerInsight: () => void;
}

export default function AIAnalyst({
  activeTicker,
  insight,
  loadingInsight,
  insightError,
  onTriggerInsight,
}: AIAnalystProps) {
  
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

  return (
    <div className="glass-panel insight-panel">
      <div className="panel-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#a154ff" className="glow-violet" />
          <span>QuantIQ AI Analyst</span>
        </div>
      </div>

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
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - insight.bullishProbability / 100)}`}
              ></circle>
            </svg>
            <div className="gauge-text">
              <span className="gauge-percentage">{insight.bullishProbability}%</span>
              <span className="gauge-label">Bullish</span>
            </div>
          </div>

          <div className="insight-text-container">
            <div className={`insight-tag ${insight.bullishProbability >= 50 ? 'tag-bullish' : 'tag-bearish'}`}>
              {insight.bullishProbability >= 50 ? 'BULLISH BIAS' : 'BEARISH BIAS'}
            </div>
            <div className="insight-reason-body">
              {formatReason(insight.reason)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
