import { useEffect, useRef } from 'react';
import { Sparkles, Play, Activity, Cpu, ArrowRight, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface LandingPageProps {
  onGoogleLogin: (response: any) => Promise<void>;
  onMockLogin: () => Promise<void>;
  googleClientId: string;
}

const mockupChartData = [
  { time: '09:30', price: 280 },
  { time: '10:00', price: 284 },
  { time: '10:30', price: 282 },
  { time: '11:00', price: 289 },
  { time: '11:30', price: 287 },
  { time: '12:00', price: 294.3 },
];

export default function LandingPage({ onGoogleLogin, onMockLogin, googleClientId }: LandingPageProps) {
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Append Google Identity Services SDK script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId || 'dummy-client-id.apps.googleusercontent.com',
          callback: onGoogleLogin,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'filled_blue',
          size: 'large',
          width: 320,
        });
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [onGoogleLogin, googleClientId]);

  return (
    <div className="landing-page-container">
      {/* Mesh glowing grid background elements */}
      <div className="bg-glow-mesh">
        <div className="mesh-dot mesh-cyan"></div>
        <div className="mesh-dot mesh-violet"></div>
      </div>
      {/* Landing Header */}
      <header className="landing-header">
        <div className="brand">
          <Sparkles size={28} color="#00f2fe" className="glow-cyan animate-pulse" />
          <span className="brand-logo-text">QuantIQ</span>
        </div>
      </header>      {/* Main Content Sections */}
      <main className="landing-main">
        {/* HERO SECTION */}
        <section className="landing-hero animate-slide">
          <div className="hero-badge">
            <Zap size={14} color="#00f2fe" />
            <span>Next-Gen Stock Intelligence</span>
          </div>
          
          <h1 className="hero-title">
            Real-Time Stock Intelligence <br />
            <span>Powered by AI & Quant Models</span>
          </h1>
          
          <p className="hero-subtitle">
            Experience event-driven stock analysis. Combine live technical indicators, 
            local ONNX machine learning model signals, and Price Alerts in a unified ReAct agent loop.
          </p>

          {/* Interactive Dashboard Preview Mockup */}
          <div className="dashboard-mockup glass-panel">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="mockup-url">https://app.quantiq.io/AAPL</div>
            </div>
            
            <div className="mockup-body">
              <div className="mockup-chart-preview">
                <div className="preview-info">
                  <span className="preview-ticker">AAPL</span>
                  <span className="preview-price">$294.30 <span className="live-pill">LIVE</span></span>
                </div>
                <div className="mini-chart-container">
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={mockupChartData}>
                      <defs>
                        <linearGradient id="mockupGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#00f2fe" 
                        strokeWidth={2} 
                        fill="url(#mockupGlow)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="mockup-agent-preview glass-panel">
                <div className="preview-agent-title">
                  <Sparkles size={14} color="#a154ff" />
                  <span>QuantIQ AI Analyst</span>
                  <span className="preview-agent-badge">BULLISH BIAS (75%)</span>
                </div>
                <p className="preview-agent-reason">
                  The **QuantIQ ML Signal Engine** indicates strong upward momentum for AAPL. 
                  RSI is steady at **58.2** with a bullish crossover on the MACD.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECURE AUTHENTICATION PANEL */}
        <section className="landing-auth-panel animate-fade">
          <div className="auth-card glass-panel">
            <h3 className="auth-card-title">Get Started</h3>
            <p className="auth-card-subtitle">
              Sign up today and receive <strong>5 free credits</strong> automatically to analyze stock strategies.
            </p>
            
            <div className="auth-actions">
              {/* Google OAuth Button Container */}
              <div className="google-btn-wrapper">
                <div ref={googleButtonRef}></div>
              </div>

              <div className="auth-divider">
                <span>OR</span>
              </div>

              {/* Mock Tester Sandbox Account */}
              <button className="sandbox-btn" onClick={onMockLogin}>
                <Play size={16} />
                <span>Enter with Tester Account (Sandbox)</span>
              </button>
            </div>

            <div className="auth-features-list">
              <div className="auth-feature-item">
                <ArrowRight size={14} color="#00f2fe" />
                <span>Test Mode Razorpay Checkout Enabled</span>
              </div>
              <div className="auth-feature-item">
                <ArrowRight size={14} color="#00f2fe" />
                <span>Real-Time WebSocket streams on watchlist</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* CORE FEATURES LIST */}
      <section className="landing-features">
        <div className="features-grid">
          <div className="feature-card glass-panel">
            <div className="feature-icon">
              <Cpu size={24} color="#00f2fe" />
            </div>
            <h4>QuantIQ ML Signal Engine</h4>
            <p>
              Serves localized stock price predictions using an optimized, lightweight ONNX neural model.
            </p>
          </div>

          <div className="feature-card glass-panel">
            <div className="feature-icon">
              <Sparkles size={24} color="#a154ff" />
            </div>
            <h4>QuantIQ AI Analyst</h4>
            <p>
              Consult a native Gemini ReAct agent checking watchlists, active indicators, and alerts.
            </p>
          </div>

          <div className="feature-card glass-panel">
            <div className="feature-icon">
              <Activity size={24} color="#ff007f" />
            </div>
            <h4>Event-Driven Streaming</h4>
            <p>
              Live stock tick ingestion powered by Redpanda (Kafka) streamed directly via WebSockets.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <p>© 2026 QuantIQ Platform. Developed for Next-Gen Financial Intelligence.</p>
      </footer>
    </div>
  );
}
