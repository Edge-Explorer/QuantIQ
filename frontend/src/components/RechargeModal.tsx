import { X, Check } from 'lucide-react';

interface RechargeModalProps {
  user: any;
  onClose: () => void;
  onSelectPackage: (amountInRupees: number) => Promise<void>;
}

export default function RechargeModal({ user, onClose, onSelectPackage }: RechargeModalProps) {
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
    <div className="modal-overlay animate-fade">
      <div className="modal-content glass-panel pricing-modal-content" style={{ maxWidth: isNewUser ? '1000px' : '850px', width: '90%', padding: '24px 32px' }}>
        <div className="modal-header" style={{ marginBottom: '8px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, background: 'linear-gradient(90deg, #00f2fe, #a154ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Choose Your Plan
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Unlock high-fidelity AI Strategy generations & local ML market predictions.
            </p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="recharge-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${isNewUser ? 4 : 3}, minmax(0, 1fr))`, gap: '16px', margin: '20px 0' }}>
          
          {/* Card 0: Free Tier */}
          <div className="pricing-card free-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', transition: 'all 0.3s ease', position: 'relative' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Starter</span>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>Free Tier</h3>
            <div style={{ margin: '16px 0 20px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>₹0</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>/ week</span>
            </div>
            
            <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>5 weekly AI strategies</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Basic candlestick charts</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Active alerts (Limit: 2)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Live stream ticker tape</span>
              </li>
            </ul>

            <button disabled style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'not-allowed' }}>
              Active Free Tier
            </button>
          </div>

          {/* Card 1: 10 Credits */}
          <div className="pricing-card package-card-pro" onClick={() => onSelectPackage(500)} style={{ display: 'flex', flexDirection: 'column', padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '12px', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative' }}>
            <span style={{ fontSize: '12px', color: 'var(--neon-cyan)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Analyst Pack</span>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>10 Credits</h3>
            <div style={{ margin: '16px 0 20px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>₹500</span>
            </div>
            
            <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>10 Strategy Generations</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Advanced indicators scanning</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Active alerts (Limit: 10)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span>Standard processing queue</span>
              </li>
            </ul>

            <button className="insight-btn" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--neon-cyan)', color: 'var(--bg-black)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}>
              Select Pack
            </button>
          </div>

          {/* Card 2: 50 Credits */}
          <div className="pricing-card package-card-pro hot-deal-card" onClick={() => onSelectPackage(1500)} style={{ display: 'flex', flexDirection: 'column', padding: '20px', background: 'rgba(161, 84, 255, 0.05)', border: '1px solid rgba(161, 84, 255, 0.3)', borderRadius: '12px', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative', boxShadow: '0 8px 32px rgba(161, 84, 255, 0.1)' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '12px', background: 'var(--neon-violet)', color: 'var(--text-primary)', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '20px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Best Value</div>
            <span style={{ fontSize: '12px', color: 'var(--neon-violet)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Trader Pack</span>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>50 Credits</h3>
            <div style={{ margin: '16px 0 20px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>₹1,500</span>
            </div>
            
            <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                <span>50 Strategy Generations</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                <span>Priority processing queue</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                <span>Active alerts (Limit: 50)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                <span>Historical strategy history</span>
              </li>
            </ul>

            <button className="insight-btn" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--neon-violet)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(161, 84, 255, 0.3)' }}>
              Select Pack
            </button>
          </div>

          {/* Card 3: 100 Credits / Lifetime Offer */}
          {isNewUser ? (
            /* Special Lifetime Offer for New Users (Age <= 3 days) */
            <div className="pricing-card package-card-pro lifetime-deal-card" onClick={() => onSelectPackage(10500)} style={{ display: 'flex', flexDirection: 'column', padding: '20px', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.5)', borderRadius: '12px', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative', boxShadow: '0 8px 32px rgba(0, 242, 254, 0.15)' }}>
              <div style={{ position: 'absolute', top: '-10px', right: '12px', background: 'var(--neon-cyan)', color: 'var(--bg-black)', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '20px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Limited Offer</div>
              <span style={{ fontSize: '12px', color: 'var(--neon-cyan)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Lifetime Plan</span>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>Unlimited AI</h3>
              <div style={{ margin: '16px 0 20px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>₹10,500</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>once</span>
              </div>
              
              <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                  <strong style={{ color: 'var(--text-primary)' }}>Lifetime Unlimited AI chats</strong>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                  <span>Instant strategy reports</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                  <span>Unlimited watchlist & alerts</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                  <span>Exclusive developer features</span>
                </li>
              </ul>

              <button className="insight-btn" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(90deg, #00f2fe, #a154ff)', color: 'var(--bg-black)', fontSize: '13px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(0, 242, 254, 0.4)' }}>
                Claim Offer
              </button>
            </div>
          ) : (
            /* Standard 100 Credits Card */
            <div className="pricing-card package-card-pro" onClick={() => onSelectPackage(2500)} style={{ display: 'flex', flexDirection: 'column', padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '12px', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Pro Pack</span>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>100 Credits</h3>
              <div style={{ margin: '16px 0 20px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>₹2,500</span>
              </div>
              
              <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>100 Strategy Generations</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Dedicated priority agent queue</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Unlimited price alerts</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Custom indicator weights</span>
                </li>
              </ul>

              <button className="insight-btn" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                Select Pack
              </button>
            </div>
          )}

        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '16px', marginTop: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            Test Mode active. Pay using Razorpay Test UPI / cards.
          </p>
          {isNewUser && (
            <p style={{ fontSize: '11px', color: 'var(--neon-cyan)', margin: 0, fontWeight: 600 }} className="offer-countdown">
              ⚡ New User Special Offer ends in 3 days!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
