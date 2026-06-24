import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Plus, Trash, Bell, LogOut, Wallet, X, Activity, Play
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip 
} from 'recharts';
import './App.css';

// Declare global types for external scripts
declare global {
  interface Window {
    google?: any;
    Razorpay?: any;
  }
}

// Configuration (points to localhost for dev, overridable by environment variables)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const GQL_HTTP_URL = `${API_URL}/graphql`;
const GQL_WS_URL = `${API_URL.replace(/^http/, 'ws')}/graphql`;

// GraphQL Query & Mutation helper
async function graphqlRequest(query: string, variables: any = {}) {
  const token = localStorage.getItem('quantiq_jwt');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(GQL_HTTP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  
  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data;
}

export default function App() {
  // Auth State
  const [token, setToken] = useState<string | null>(localStorage.getItem('quantiq_jwt'));
  const [user, setUser] = useState<any>(null);
  
  // Dashboard Core State
  const [watchlist, setWatchlist] = useState<string[]>(['AAPL', 'TSLA', 'TCS.NS', 'RELIANCE.NS']);
  const [activeTicker, setActiveTicker] = useState<string>('AAPL');
  const [chartData, setChartData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  
  // AI Insights State
  const [insight, setInsight] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState<boolean>(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  // New Input fields state
  const [newTicker, setNewTicker] = useState<string>('');
  const [alertPrice, setAlertPrice] = useState<string>('');
  const [alertCondition, setAlertCondition] = useState<string>('above');

  // Recharge Modal State
  const [showRecharge, setShowRecharge] = useState<boolean>(false);

  // Google OAuth Client Script ref
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // 1. Load external Google OAuth and Razorpay Scripts
  useEffect(() => {
    // Google Sign-In SDK
    const googleScript = document.createElement('script');
    googleScript.src = 'https://accounts.google.com/gsi/client';
    googleScript.async = true;
    googleScript.defer = true;
    document.body.appendChild(googleScript);

    // Razorpay Standard Checkout SDK
    const rzpScript = document.createElement('script');
    rzpScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
    rzpScript.async = true;
    document.body.appendChild(rzpScript);

    googleScript.onload = () => {
      if (window.google && googleButtonRef.current && !token) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'filled_blue',
          size: 'large',
          width: 320,
        });
      }
    };

    return () => {
      document.body.removeChild(googleScript);
      document.body.removeChild(rzpScript);
    };
  }, [token]);

  // 2. Fetch user profile, watchlist, alerts, and historical data once logged in
  useEffect(() => {
    if (!token) return;

    const loadInitialData = async () => {
      try {
        // Fetch profile
        const profileData = await graphqlRequest(`
          query {
            me {
              id
              email
              fullName
              pictureUrl
              credits
            }
          }
        `);
        setUser(profileData.me);

        // Fetch user watchlist
        const watchlistData = await graphqlRequest(`
          query {
            watchlist {
              ticker
            }
          }
        `);
        if (watchlistData.watchlist.length > 0) {
          const tickers = watchlistData.watchlist.map((w: any) => w.ticker);
          setWatchlist(tickers);
          // Default to the first watchlisted item
          setActiveTicker(tickers[0]);
        }

        // Fetch alerts
        const alertsData = await graphqlRequest(`
          query {
            alerts {
              id
              ticker
              targetPrice
              condition
              isActive
            }
          }
        `);
        setAlerts(alertsData.alerts);
      } catch (err) {
        console.error('Failed to load profile / user data', err);
        // If unauthorized or token expired, log out
        handleLogout();
      }
    };

    loadInitialData();
  }, [token]);

  // 3. Fetch historical candles for active ticker
  useEffect(() => {
    if (!token || !activeTicker) return;

    const fetchHistory = async () => {
      try {
        const historyData = await graphqlRequest(`
          query GetHistory($ticker: String!) {
            stockHistory(ticker: $ticker, limit: 30) {
              timestamp
              close
            }
          }
        `, { ticker: activeTicker });
        
        const formatted = historyData.stockHistory.map((h: any) => ({
          time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: parseFloat(h.close.toFixed(2)),
        }));
        setChartData(formatted);
      } catch (err) {
        console.error('Failed to load stock history', err);
      }
    };

    fetchHistory();
    // Reset insight when active stock changes
    setInsight(null);
  }, [token, activeTicker]);

  // 4. WebSocket Live Price Streaming Subscription (graphql-transport-ws protocol)
  useEffect(() => {
    if (!token || !activeTicker) return;

    const ws = new WebSocket(GQL_WS_URL, 'graphql-transport-ws');
    let keepAliveInterval: any;

    ws.onopen = () => {
      // 1. Connection Init
      ws.send(JSON.stringify({ type: 'connection_init', payload: {} }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'connection_ack') {
        // 2. Start Subscription
        ws.send(JSON.stringify({
          id: 'stock-tick-sub',
          type: 'subscribe',
          payload: {
            query: `
              subscription LiveTicks($ticker: String!) {
                streamStockTicks(ticker: $ticker) {
                  ticker
                  price
                  timestamp
                }
              }
            `,
            variables: { ticker: activeTicker }
          }
        }));

        // Send a ping every 20 seconds to keep connection alive
        keepAliveInterval = setInterval(() => {
          ws.send(JSON.stringify({ type: 'ping' }));
        }, 20000);
      }

      if (msg.type === 'next' && msg.id === 'stock-tick-sub') {
        const tick = msg.payload.data.streamStockTicks;
        const tickTime = new Date(tick.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        setChartData((prevData) => {
          // If we already have the timestamp, update price. Else append.
          const updated = [...prevData];
          const last = updated[updated.length - 1];
          const newPrice = parseFloat(tick.price.toFixed(2));
          
          if (last && last.time === tickTime) {
            updated[updated.length - 1] = { time: tickTime, price: newPrice };
            return updated;
          } else {
            const nextList = [...updated, { time: tickTime, price: newPrice }];
            // Cap chart view to last 35 data points
            if (nextList.length > 35) nextList.shift();
            return nextList;
          }
        });
      }
    };

    return () => {
      clearInterval(keepAliveInterval);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.send(JSON.stringify({ id: 'stock-tick-sub', type: 'complete' }));
        ws.close();
      }
    };
  }, [token, activeTicker]);

  // 5. Handle Authentication Callbacks (Google Sign-In response)
  const handleGoogleCredentialResponse = async (response: any) => {
    try {
      const idToken = response.credential;
      const res = await fetch(`${API_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: idToken }),
      }).then(r => r.json());

      if (res.access_token) {
        localStorage.setItem('quantiq_jwt', res.access_token);
        setToken(res.access_token);
      }
    } catch (err) {
      console.error('Google Auth server exchange error:', err);
    }
  };

  // Mock bypass login for local testing
  const handleMockLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: 'mock_token' }),
      }).then(r => r.json());

      if (res.access_token) {
        localStorage.setItem('quantiq_jwt', res.access_token);
        setToken(res.access_token);
      }
    } catch (err) {
      console.error('Local mock login error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('quantiq_jwt');
    setToken(null);
    setUser(null);
    setInsight(null);
  };

  // 6. Watchlist Operations
  const handleAddWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker) return;
    try {
      const tickerUpper = newTicker.trim().toUpperCase();
      await graphqlRequest(`
        mutation AddToWatchlist($ticker: String!) {
          addWatchlist(ticker: $ticker) {
            ticker
          }
        }
      `, { ticker: tickerUpper });

      if (!watchlist.includes(tickerUpper)) {
        setWatchlist([...watchlist, tickerUpper]);
      }
      setActiveTicker(tickerUpper);
      setNewTicker('');
    } catch (err) {
      console.error('Failed to add ticker', err);
    }
  };

  const handleRemoveWatchlist = async (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting as active ticker
    try {
      await graphqlRequest(`
        mutation RemoveFromWatchlist($ticker: String!) {
          removeWatchlist(ticker: $ticker)
        }
      `, { ticker });

      const filtered = watchlist.filter(w => w !== ticker);
      setWatchlist(filtered);
      if (activeTicker === ticker && filtered.length > 0) {
        setActiveTicker(filtered[0]);
      }
    } catch (err) {
      console.error('Failed to delete ticker', err);
    }
  };

  // 7. Alert Operations
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPriceVal = parseFloat(alertPrice);
    if (isNaN(targetPriceVal) || !activeTicker) return;

    try {
      const alertData = await graphqlRequest(`
        mutation CreateAlert($ticker: String!, $targetPrice: Float!, $condition: String!) {
          createAlert(ticker: $ticker, targetPrice: $targetPrice, condition: $condition) {
            id
            ticker
            targetPrice
            condition
            isActive
          }
        }
      `, {
        ticker: activeTicker,
        targetPrice: targetPriceVal,
        condition: alertCondition
      });

      setAlerts([alertData.createAlert, ...alerts]);
      setAlertPrice('');
    } catch (err) {
      console.error('Failed to create price alert', err);
    }
  };

  const handleDeactivateAlert = async (alertId: string) => {
    try {
      await graphqlRequest(`
        mutation DeactivateAlert($id: UUID!) {
          deactivateAlert(alertId: $id)
        }
      `, { id: alertId });

      setAlerts(alerts.map(a => a.id === alertId ? { ...a, isActive: false } : a));
    } catch (err) {
      console.error('Failed to deactivate alert', err);
    }
  };

  // 8. Call Gemini ReAct AI Insights Agent
  const triggerAIInsight = async () => {
    if (user.credits <= 0) {
      setShowRecharge(true);
      return;
    }

    setLoadingInsight(true);
    setInsightError(null);
    setInsight(null);

    try {
      const insightData = await graphqlRequest(`
        mutation GetAIInsight($ticker: String!) {
          getAiInsight(ticker: $ticker) {
            ticker
            bullishProbability
            reason
            creditsRemaining
          }
        }
      `, { ticker: activeTicker });

      setInsight(insightData.getAiInsight);
      setUser({ ...user, credits: insightData.getAiInsight.creditsRemaining });
    } catch (err: any) {
      console.error('Gemini Agent loop error:', err);
      setInsightError(err.message || 'Error compiling strategy.');
    } finally {
      setLoadingInsight(false);
    }
  };

  // 9. Razorpay Payment Integration (Test Mode Webhooks)
  const handlePayment = async (amountInRupees: number) => {
    try {
      // 1. Create order on backend
      const orderData = await graphqlRequest(`
        mutation CreateOrder($amount: Int!) {
          createPaymentOrder(amount: $amount) {
            orderId
            amount
            currency
          }
        }
      `, { amount: amountInRupees });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_dummykeyid123',
        amount: orderData.createPaymentOrder.amount,
        currency: orderData.createPaymentOrder.currency,
        name: 'QuantIQ Platform',
        description: `Purchase ${amountInRupees // 10 credits packages
        } credits for AI Insights`,
        order_id: orderData.createPaymentOrder.orderId,
        handler: async function (_response: any) {
          // Asynchronously updates credits. Wait 2 seconds and refresh profile
          setTimeout(async () => {
            try {
              const updatedProfile = await graphqlRequest(`
                query {
                  me {
                    credits
                  }
                }
              `);
              setUser((prev: any) => prev ? { ...prev, credits: updatedProfile.me.credits } : null);
            } catch (e) {
              console.error('Refresh credits error:', e);
            }
          }, 2000);
          
          setShowRecharge(false);
        },
        prefill: {
          name: user?.fullName || 'QuantIQ User',
          email: user?.email || '',
        },
        theme: {
          color: '#a154ff',
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err) {
      console.error('Payment checkout failed:', err);
    }
  };

  // RENDER LOGIN SCREEN IF UNAUTHENTICATED
  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card glass-panel">
          <div className="logo-glow">
            <Sparkles size={36} color="#00f2fe" />
          </div>
          <h2 className="login-title">QuantIQ</h2>
          <p className="login-subtitle">
            Experience real-time stock intelligence, automated alert parameters, 
            and quantitative market insights served directly by Gemini 2.5 Flash.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div ref={googleButtonRef}></div>
            <button className="mock-btn" onClick={handleMockLogin}>
              <Play size={16} /> Enter with Tester Account (Offline Mode)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER DASHBOARD
  return (
    <div className="app-container animate-fade">
      {/* 1. HEADER */}
      <header className="dashboard-header">
        <div className="header-left">
          <Sparkles size={24} color="#00f2fe" className="glow-cyan" />
          <span className="logo-text">QuantIQ</span>
        </div>
        
        <div className="header-right">
          <div className="credits-badge">
            <Wallet size={16} />
            <span>{user?.credits} Credits</span>
            <button className="recharge-btn" onClick={() => setShowRecharge(true)}>
              RECHARGE
            </button>
          </div>

          <div className="user-profile">
            {user?.pictureUrl && (
              <img src={user.pictureUrl} alt="Avatar" className="avatar" />
            )}
            <span className="profile-name">{user?.fullName || 'User'}</span>
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* 2. GRID CONTENT */}
      <main className="dashboard-grid">
        
        {/* Left Sidebar: Watchlist */}
        <section className="left-sidebar glass-panel watchlist-container">
          <div className="panel-title">
            <span>Watchlist</span>
            <Activity size={18} color="#94a3b8" />
          </div>
          
          <form className="watchlist-search" onSubmit={handleAddWatchlist}>
            <input 
              type="text" 
              placeholder="Add ticker (e.g. AAPL)..."
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
            />
            <button className="add-btn" type="submit">
              <Plus size={18} />
            </button>
          </form>

          <div className="watchlist-items">
            {watchlist.map((ticker) => (
              <div 
                key={ticker}
                className={`watchlist-item ${activeTicker === ticker ? 'active' : ''}`}
                onClick={() => setActiveTicker(ticker)}
              >
                <span className="ticker-symbol">{ticker}</span>
                <button 
                  className="delete-ticker-btn"
                  onClick={(e) => handleRemoveWatchlist(ticker, e)}
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Center: Live Chart & AI Insights */}
        <section className="center-content">
          
          {/* Live Chart */}
          <div className="glass-panel chart-panel">
            <div className="chart-header">
              <div>
                <h2>{activeTicker}</h2>
                <div className="active-stock-info">
                  <span className="active-price">
                    {chartData.length > 0 ? `$${chartData[chartData.length - 1].price}` : 'Loading...'}
                  </span>
                  <div className="live-indicator">
                    <span className="live-dot"></span>
                    <span>Live</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="chart-container">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="time" 
                      stroke="#475569" 
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={11}
                      domain={['auto', 'auto']}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#0d101b', 
                        borderColor: '#2e303a',
                        borderRadius: '8px',
                        color: '#fff' 
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#00f2fe" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#chartGlow)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Waiting for stock ticks from Redpanda...</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Insights Panel */}
          <div className="glass-panel insight-panel">
            <div className="panel-title" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#a154ff" className="glow-violet" />
                <span>Gemini Strategy Insights</span>
              </div>
            </div>

            {!insight && !loadingInsight && (
              <div className="insight-cta">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Analyze indicators, watchlists, alerts, and model prediction in a single ReAct workflow.
                </p>
                <button className="insight-btn" onClick={triggerAIInsight}>
                  Generate strategy for {activeTicker}
                </button>
              </div>
            )}

            {loadingInsight && (
              <div className="insight-loading">
                <div className="spinner"></div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Deducting 1 credit & consulting Gemini ReAct agent...
                </span>
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
                  <p className="insight-explanation">{insight.reason}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar: Alert Controls & Alert List */}
        <section className="right-sidebar">
          
          <div className="glass-panel alerts-panel">
            <div className="panel-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="#94a3b8" />
                <span>Price Alerts ({activeTicker})</span>
              </div>
            </div>

            <form className="alert-form" onSubmit={handleCreateAlert}>
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
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div key={alert.id} className="alert-item animate-fade">
                    <div className="alert-info">
                      <span className="alert-ticker">{alert.ticker}</span>
                      <span className="alert-condition">
                        {alert.condition} {alert.targetPrice}
                      </span>
                    </div>
                    {alert.isActive ? (
                      <button 
                        className="deactivate-alert-btn"
                        onClick={() => handleDeactivateAlert(alert.id)}
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TRIGGERED</span>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No active alerts.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 3. RECHARGE MODAL */}
      {showRecharge && (
        <div className="modal-overlay animate-fade">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Select Credits Package</h2>
              <button className="close-btn" onClick={() => setShowRecharge(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="recharge-packages">
              <div className="package-card" onClick={() => handlePayment(10)}>
                <span className="package-credits">10 Credits</span>
                <span className="package-price">₹10.00</span>
              </div>
              <div className="package-card" onClick={() => handlePayment(50)}>
                <span className="package-credits">50 Credits</span>
                <span className="package-price">₹50.00</span>
              </div>
              <div className="package-card" onClick={() => handlePayment(100)}>
                <span className="package-credits">100 Credits</span>
                <span className="package-price">₹100.00</span>
              </div>
            </div>
            
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Test Mode active. Pay using Razorpay Test UPI.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
