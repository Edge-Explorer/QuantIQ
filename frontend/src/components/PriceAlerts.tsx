import { useState } from 'react';
import { Bell, X } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceVal = parseFloat(alertPrice);
    if (isNaN(priceVal) || !activeTicker) return;

    try {
      await onCreateAlert(priceVal, alertCondition);
      setAlertPrice('');
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <select 
            value={alertCondition} 
            onChange={(e) => setAlertCondition(e.target.value)}
          >
            <option value="above">Above Target</option>
            <option value="below">Below Target</option>
          </select>
          
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
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No active alerts for {activeTicker}.
          </div>
        )}
      </div>
    </div>
  );
}
