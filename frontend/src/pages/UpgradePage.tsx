import { Check, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';

interface UpgradePageProps {
  user: any;
  onBack: () => void;
  onSelectPackage: (amountInRupees: number) => Promise<void>;
}

export default function UpgradePage({ user, onBack, onSelectPackage }: UpgradePageProps) {
  // Check if account age is under 3 days (3 * 24 * 60 * 60 * 1000 = 259200000 ms)
  const isNewUser = (() => {
    if (!user || !user.createdAt) return false;
    try {
      const createdDate = new Date(user.createdAt).getTime();
      const currentDate = new Date().getTime();
      const ageDiff = currentDate - createdDate;
      return ageDiff <= 3 * 24 * 60 * 60 * 1000;
    } catch (e) {
      return false;
    }
  })();

  return (
    <div className="upgrade-page-container" style={{ minHeight: '100vh', background: '#07090e', color: 'var(--text-primary)', padding: '40px 24px', position: 'relative', overflowY: 'auto' }}>
      
      {/* Header / Nav */}
      <header style={{ maxWidth: '1200px', margin: '0 auto 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={onBack}
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          className="back-dashboard-btn"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Logo size={28} className="glow-cyan" />
          <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.05em', color: '#fff' }}>QuantIQ</span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ fontSize: '40px', fontWeight: 900, background: 'linear-gradient(90deg, #00f2fe, #a154ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '12px' }}>
            Plans that grow with you
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
            Whether you want to test the waters or build algorithmic trading strategies, choose the plan that fits your ambition.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="pricing-full-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', alignItems: 'stretch', marginBottom: '40px' }}>
          
          {/* Card 0: Free Tier */}
          <div className="pricing-full-card free-tier-card" style={{ display: 'flex', flexDirection: 'column', padding: '32px 24px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', textAlign: 'left', transition: 'all 0.3s ease', position: 'relative' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Starter</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>Free Tier</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', minHeight: '38px' }}>Essential market data & basic analytics.</p>
            <div style={{ margin: '24px 0' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)' }}>₹0</span>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '4px' }}>/ week</span>
            </div>
            
            <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>5 weekly AI strategies</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Basic candlestick charts</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Active alerts (Limit: 2)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Live stream ticker tape</span>
              </li>
            </ul>

            <button disabled style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 700, cursor: 'not-allowed', textAlign: 'center' }}>
              Active Plan
            </button>
          </div>

          {/* Card 1: 10 Credits */}
          <div className="pricing-full-card" onClick={() => onSelectPackage(500)} style={{ display: 'flex', flexDirection: 'column', padding: '32px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '16px', textAlign: 'left', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative' }}>
            <span style={{ fontSize: '12px', color: 'var(--neon-cyan)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Analyst Pack</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>10 Credits</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', minHeight: '38px' }}>Great for casual traders looking for reliable market strategies.</p>
            <div style={{ margin: '24px 0' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)' }}>₹500</span>
            </div>
            
            <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>10 Strategy Generations</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Advanced indicators scanning</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Active alerts (Limit: 10)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Standard processing queue</span>
              </li>
            </ul>

            <button className="insight-btn" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--neon-cyan)', color: 'var(--bg-black)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' }}>
              Purchase Credits
            </button>
          </div>

          {/* Card 2: 50 Credits */}
          <div className="pricing-full-card hot-deal-card" onClick={() => onSelectPackage(1500)} style={{ display: 'flex', flexDirection: 'column', padding: '32px 24px', background: 'rgba(161, 84, 255, 0.05)', border: '1px solid rgba(161, 84, 255, 0.3)', borderRadius: '16px', textAlign: 'left', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative', boxShadow: '0 12px 48px rgba(161, 84, 255, 0.15)' }}>
            <div style={{ position: 'absolute', top: '-12px', right: '20px', background: 'var(--neon-violet)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Most Popular</div>
            <span style={{ fontSize: '12px', color: 'var(--neon-violet)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Trader Pack</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>50 Credits</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', minHeight: '38px' }}>Designed for active traders seeking deep market intelligence.</p>
            <div style={{ margin: '24px 0' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)' }}>₹1,500</span>
            </div>
            
            <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                <span>50 Strategy Generations</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                <span>Priority processing queue</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                <span>Active alerts (Limit: 50)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                <span>Historical strategy history</span>
              </li>
            </ul>

            <button className="insight-btn" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--neon-violet)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(161, 84, 255, 0.3)' }}>
              Purchase Credits
            </button>
          </div>

          {/* Card 3: 100 Credits / Lifetime Offer */}
          {isNewUser ? (
            /* Special Lifetime Offer (Age <= 3 days) */
            <div className="pricing-full-card lifetime-deal-card" onClick={() => onSelectPackage(10500)} style={{ display: 'flex', flexDirection: 'column', padding: '32px 24px', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.5)', borderRadius: '16px', textAlign: 'left', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative', boxShadow: '0 12px 48px rgba(0, 242, 254, 0.2)' }}>
              <div style={{ position: 'absolute', top: '-12px', right: '20px', background: 'var(--neon-cyan)', color: 'var(--bg-black)', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Limited Special Offer</div>
              <span style={{ fontSize: '12px', color: 'var(--neon-cyan)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Lifetime Plan</span>
              <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>Unlimited AI</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', minHeight: '38px' }}>Ultimate freedom. Unlimited AI chat generations forever without ever paying again.</p>
              <div style={{ margin: '24px 0' }}>
                <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)' }}>₹10,500</span>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '4px' }}>once</span>
              </div>
              
              <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                  <strong style={{ color: 'var(--text-primary)' }}>Lifetime Unlimited AI chats</strong>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                  <span>Instant strategy reports</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                  <span>Unlimited watchlist & alerts</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                  <span>Exclusive developer features</span>
                </li>
              </ul>

              <button className="insight-btn" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(90deg, #00f2fe, #a154ff)', color: 'var(--bg-black)', fontSize: '14px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(0, 242, 254, 0.4)' }}>
                Claim Lifetime Deal
              </button>
            </div>
          ) : (
            /* Standard 100 Credits Card */
            <div className="pricing-full-card" onClick={() => onSelectPackage(2500)} style={{ display: 'flex', flexDirection: 'column', padding: '32px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '16px', textAlign: 'left', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Pro Pack</span>
              <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>100 Credits</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', minHeight: '38px' }}>Best suited for quantitative researchers and serious day-traders.</p>
              <div style={{ margin: '24px 0' }}>
                <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)' }}>₹2,500</span>
              </div>
              
              <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>100 Strategy Generations</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Dedicated priority agent queue</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Unlimited price alerts</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Custom indicator weights</span>
                </li>
              </ul>

              <button className="insight-btn" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                Purchase Credits
              </button>
            </div>
          )}

        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '20px', marginTop: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Test Mode active. Pay securely using Razorpay Test UPI / Cards.
          </p>
          {isNewUser && (
            <p style={{ fontSize: '13px', color: 'var(--neon-cyan)', margin: 0, fontWeight: 700 }} className="offer-countdown">
              ⚡ Exclusive Lifetime Purchase offer ends in 3 days!
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
