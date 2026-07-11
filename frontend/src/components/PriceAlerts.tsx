import { useState } from 'react';
import { Bell, X, ChevronDown } from 'lucide-react';

interface Alert {
  id: string;
  ticker: string;
  targetPrice: number;
  condition: string;
  isActive: boolean;
}

interface PriceAlertsProps {
  activeTicker: string;
  alerts: Alert[];
  onCreateAlert: (targetPrice: number, condition: string) => Promise<void>;
  onDeactivateAlert: (alertId: string) => Promise<void>;
}

export default function PriceAlerts({
  activeTicker,
  alerts,
  onCreateAlert,
  onDeactivateAlert,
}: PriceAlertsProps) {
  const [alertPrice, setAlertPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState('above');
  const [isConditionOpen, setIsConditionOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceVal = parseFloat(alertPrice);
    if (isNaN(priceVal) || !activeTicker) return;

    try {
      await onCreateAlert(priceVal, alertCondition);
      setAlertPrice('');
      setIsConditionOpen(false);
    } catch (err) {
      console.error('Error setting alert:', err);
    }
  };

  // Filter alerts to show all alerts related to the active stock ticker
  const activeStockAlerts = alerts.filter(a => a.ticker === activeTicker);

  return (
    <div className="glass-panel alerts-panel">
      <div className="panel-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} color="#94a3b8" />
          <span>Price Alerts ({activeTicker})</span>
        </div>
      </div>

      <form className="alert-form" onSubmit={handleSubmit}>
        <div className="alert-form-row">
          {/* Custom Glassmorphic Condition Dropdown — matches AI Analyst style */}
          <div style={{ position: 'relative', flex: 1 }}>
            <div
              onClick={() => setIsConditionOpen(!isConditionOpen)}
              className="premium-select"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-glass)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                minHeight: '36px',
                userSelect: 'none',
              }}
            >
              <span>{alertCondition === 'above' ? 'Above Target' : 'Below Target'}</span>
              <ChevronDown
                size={14}
                style={{
                  color: '#94a3b8',
                  transition: 'transform 0.25s ease',
                  transform: isConditionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </div>

            {isConditionOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: '100%',
                  background: 'rgba(13, 16, 27, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                  zIndex: 200,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  boxSizing: 'border-box',
                }}
              >
                {['above', 'below'].map((val) => (
                  <div
                    key={val}
                    className="glass-dropdown-item"
                    onClick={() => { setAlertCondition(val); setIsConditionOpen(false); }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: alertCondition === val ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                      background: alertCondition === val ? 'rgba(0, 242, 254, 0.06)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {val === 'above' ? 'Above Target' : 'Below Target'}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <input 
            type="number" 
            step="0.01"
            placeholder="Price (USD)..."
            value={alertPrice}
            onChange={(e) => setAlertPrice(e.target.value)}
            required
          />
        </div>
        <button className="alert-submit-btn" type="submit">
          Set Alert
        </button>
      </form>

      <div className="alerts-list">
        {activeStockAlerts.length > 0 ? (
          activeStockAlerts.map((alert) => (
            <div key={alert.id} className="alert-item animate-fade">
              <div className="alert-info">
                <span className="alert-ticker">{alert.ticker}</span>
                <span className="alert-condition">
                  {alert.condition.toUpperCase()} ${alert.targetPrice.toFixed(2)}
                </span>
              </div>
              {alert.isActive ? (
                <button 
                  className="deactivate-alert-btn"
                  onClick={() => onDeactivateAlert(alert.id)}
                  aria-label="Deactivate alert"
                >
                  <X size={14} />
                </button>
              ) : (
                <span className="triggered-badge">TRIGGERED</span>
              )}
            </div>
          ))
        ) : (
          <div className="alerts-empty">
            No active alerts for {activeTicker}.
          </div>
        )}
      </div>
    </div>
  );
}
