import { useState, useEffect, useRef } from 'react';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import UpgradePage from './pages/UpgradePage';
import { X } from 'lucide-react';
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
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com';

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
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'upgrade'>(localStorage.getItem('quantiq_jwt') ? 'dashboard' : 'landing');
  
  // Dashboard Core State
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<Record<string, { price: number; changePercent: number }>>({});
  const [activeTicker, setActiveTicker] = useState<string>('');
  const [chartData, setChartData] = useState<any[]>([]);
  const [activeStats, setActiveStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [chartRange, setChartRange] = useState<string>('1d');
  const [indices, setIndices] = useState<any[]>([]);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'alert' }>>([]);

  const alertsRef = useRef<any[]>([]);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  const addToast = (message: string, type: 'success' | 'alert' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };
  
  // AI Insights State
  const [insight, setInsight] = useState<any>(null);
  const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
  const [loadingInsight, setLoadingInsight] = useState<boolean>(false);
  const [insightError, setInsightError] = useState<string | null>(null);



  const fetchWatchlistData = async () => {
    try {
      const watchlistData = await graphqlRequest(`
        query {
          watchlist {
            ticker
            price
            changePercent
          }
        }
      `);
      if (watchlistData && watchlistData.watchlist) {
        const tickers = watchlistData.watchlist.map((w: any) => w.ticker);
        setWatchlist(tickers);
        
        const quotes: Record<string, { price: number; changePercent: number }> = {};
        watchlistData.watchlist.forEach((w: any) => {
          if (w.price !== null && w.price !== undefined) {
            quotes[w.ticker] = { price: w.price, changePercent: w.changePercent || 0.0 };
          }
        });
        setWatchlistQuotes(quotes);
        return tickers;
      }
    } catch (err) {
      console.error('Error fetching watchlist data:', err);
    }
    return [];
  };

  // 1. Load external Razorpay Script on mount
  useEffect(() => {
    // Razorpay Standard Checkout SDK
    const rzpScript = document.createElement('script');
    rzpScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
    rzpScript.async = true;
    document.body.appendChild(rzpScript);

    return () => {
      document.body.removeChild(rzpScript);
    };
  }, []);

  const fetchStrategyHistory = async () => {
    if (!token) return;
    try {
      const data = await graphqlRequest(`
        query {
          savedStrategies {
            id
            ticker
            bullishProbability
            reason
            createdAt
          }
        }
      `);
      setSavedStrategies(data.savedStrategies || []);
    } catch (err) {
      console.error('Failed to load strategy history', err);
    }
  };

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
              createdAt
              subscriptionTier
              messagesRemaining
              monthlyMessagesUsed
              lastBillingDate
            }
          }
        `);
        setUser(profileData.me);

        // Fetch user watchlist
        const tickers = await fetchWatchlistData();
        if (tickers.length > 0) {
          // Default to the first watchlisted item
          setActiveTicker(tickers[0]);
        } else {
          setActiveTicker('');
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
        await fetchStrategyHistory();
      } catch (err: any) {
        console.error('Failed to load profile / user data:', err);
        // Only force-logout on explicit auth errors (invalid/expired token)
        // Do NOT logout on network errors, HF downtime, or 500s — keep the session alive
        const msg = err?.message?.toLowerCase() || '';
        if (msg.includes('unauthorized') || msg.includes('invalid token') || msg.includes('not authenticated')) {
          handleLogout();
        }
        // Otherwise stay logged in — the server may just be temporarily down
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
          query GetHistory($ticker: String!, $range: String!) {
            stockHistory(ticker: $ticker, range: $range) {
              timestamp
              open
              high
              low
              close
              volume
            }
          }
        `, { ticker: activeTicker, range: chartRange });
        
        const history = historyData.stockHistory || [];
        if (history.length > 0) {
          const prices = history.map((h: any) => h.close);
          const high = Math.max(...prices);
          const low = Math.min(...prices);
          const open = history[0].open || prices[0];
          const close = history[history.length - 1].close;
          const volume = history.reduce((sum: number, h: any) => sum + (h.volume || 0), 0);
          const change = close - open;
          const changePercent = (change / open) * 100;
          
          setActiveStats({
            open,
            high,
            low,
            close,
            volume,
            change,
            changePercent
          });
        } else {
          setActiveStats(null);
        }

        const formatted = history.map((h: any) => {
          const dateObj = new Date(h.timestamp);
          let timeLabel = '';
          if (chartRange === '1d') {
            timeLabel = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (chartRange === '5d') {
            timeLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (chartRange === '1y' || chartRange === '5y' || chartRange === 'max') {
            timeLabel = dateObj.toLocaleDateString([], { year: '2-digit', month: 'short' });
          } else {
            timeLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }
          const closeVal = parseFloat(h.close.toFixed(2));
          const openVal = parseFloat((h.open !== null && h.open !== undefined ? h.open : h.close).toFixed(2));
          const highVal = parseFloat((h.high !== null && h.high !== undefined ? h.high : h.close).toFixed(2));
          const lowVal = parseFloat((h.low !== null && h.low !== undefined ? h.low : h.close).toFixed(2));
          return {
            time: timeLabel,
            price: closeVal,
            open: openVal,
            high: highVal,
            low: lowVal,
            close: closeVal,
            range: [openVal, closeVal],
          };
        });
        setChartData(formatted);
      } catch (err) {
        console.error('Failed to load stock history', err);
      }
    };

    fetchHistory();
  }, [token, activeTicker, chartRange]);

  // Reset AI insight only when active stock ticker changes
  useEffect(() => {
    setInsight(null);
    setInsightError(null);
  }, [activeTicker]);

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
        const tick = msg.payload.data?.streamStockTicks;
        if (!tick) return;

        // Evaluate active alerts for this ticker
        const currentPrice = tick.price;
        alertsRef.current.forEach((alert) => {
          if (alert.ticker === tick.ticker && alert.isActive) {
            const isAboveTriggered = alert.condition === 'above' && currentPrice >= alert.targetPrice;
            const isBelowTriggered = alert.condition === 'below' && currentPrice <= alert.targetPrice;

            if (isAboveTriggered || isBelowTriggered) {
              addToast(
                `🔔 Alert Triggered: ${tick.ticker} crossed ${alert.condition.toUpperCase()} $${alert.targetPrice.toFixed(2)} (Current: $${currentPrice.toFixed(2)})`,
                'alert'
              );
              // Call API to deactivate
              handleDeactivateAlert(alert.id);
            }
          }
        });
        
        const tickTime = new Date(tick.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        setChartData((prevData) => {
          const updated = [...prevData];
          const last = updated[updated.length - 1];
          const newPrice = parseFloat(tick.price.toFixed(2));
          
          if (last && last.time === tickTime) {
            const openVal = last.open !== undefined ? last.open : newPrice;
            const highVal = Math.max(last.high !== undefined ? last.high : newPrice, newPrice);
            const lowVal = Math.min(last.low !== undefined ? last.low : newPrice, newPrice);
            
            updated[updated.length - 1] = { 
              time: tickTime, 
              price: newPrice,
              open: openVal,
              high: highVal,
              low: lowVal,
              close: newPrice,
              range: [openVal, newPrice]
            };
            return updated;
          } else {
            const nextList = [
              ...updated, 
              { 
                time: tickTime, 
                price: newPrice,
                open: newPrice,
                high: newPrice,
                low: newPrice,
                close: newPrice,
                range: [newPrice, newPrice]
              }
            ];
            // Cap chart view to last 35 data points
            if (nextList.length > 35) nextList.shift();
            return nextList;
          }
        });
      }
    };

    return () => {
      clearInterval(keepAliveInterval);
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ id: 'stock-tick-sub', type: 'complete' }));
        } catch (_) { /* ignore send errors on cleanup */ }
      }
      ws.close();
    };
  }, [token, activeTicker]);

  // 4b. Fetch global indices and poll every 60s
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/stocks/indices`);
        if (response.ok) {
          const data = await response.json();
          setIndices(data);
        }
      } catch (err) {
        console.error('Failed to fetch global indices:', err);
      }
    };
    
    fetchIndices();
    const interval = setInterval(fetchIndices, 60000);
    return () => clearInterval(interval);
  }, []);

  // 5. Handle Authentication Callbacks (Google Sign-In response)
  const handleAuthSuccess = (accessToken: string) => {
    localStorage.setItem('quantiq_jwt', accessToken);
    setToken(accessToken);
    setCurrentView('dashboard');
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    try {
      const idToken = response.credential;
      // Retry up to 5 times to handle HF dead replica routing
      let res: any = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        const r = await fetch(`${API_URL}/api/v1/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_id: idToken }),
        });
        const ct = r.headers.get('content-type') || '';
        if (r.status >= 500 && attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 800));
          continue;
        }
        if (!ct.includes('application/json')) break;
        res = await r.json();
        break;
      }

      if (res?.access_token) {
        handleAuthSuccess(res.access_token);
      }
    } catch (err) {
      console.error('Google Auth server exchange error:', err);
    }
  };



  const handleLogout = () => {
    localStorage.removeItem('quantiq_jwt');
    setToken(null);
    setUser(null);
    setInsight(null);
    setCurrentView('landing');
  };

  // 6. Watchlist Operations
  const handleAddWatchlist = async (ticker: string) => {
    const tickerUpper = ticker.toUpperCase();
    await graphqlRequest(`
      mutation AddToWatchlist($ticker: String!) {
        addWatchlist(ticker: $ticker) {
          ticker
        }
      }
    `, { ticker: tickerUpper });

    await fetchWatchlistData();
    setActiveTicker(tickerUpper);
  };

  const handleRemoveWatchlist = async (ticker: string) => {
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
  };

  // 7. Alert Operations
  const handleCreateAlert = async (targetPrice: number, condition: string) => {
    if (!activeTicker) return;
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
      targetPrice,
      condition
    });

    setAlerts([alertData.createAlert, ...alerts]);
  };

  const handleDeactivateAlert = async (alertId: string) => {
    await graphqlRequest(`
      mutation DeactivateAlert($id: UUID!) {
        deactivateAlert(alertId: $id)
      }
    `, { id: alertId });

    setAlerts(alerts.map(a => a.id === alertId ? { ...a, isActive: false } : a));
  };

  // 8. Call QuantIQ AI Analyst Agent
  const triggerAIInsight = async (tradingStyle?: string, riskTolerance?: string) => {
    if (!user || (user.credits <= 0 && user.email !== 'karanshelar8775@gmail.com')) {
      setCurrentView('upgrade');
      return;
    }

    setLoadingInsight(true);
    setInsightError(null);
    setInsight(null);

    try {
      const insightData = await graphqlRequest(`
        mutation GetAIInsight($ticker: String!, $tradingStyle: String, $riskTolerance: String) {
          getAiInsight(ticker: $ticker, tradingStyle: $tradingStyle, riskTolerance: $riskTolerance) {
            ticker
            bullishProbability
            reason
            creditsRemaining
          }
        }
      `, { ticker: activeTicker, tradingStyle, riskTolerance });

      setInsight(insightData.getAiInsight);
      setUser({ ...user, credits: insightData.getAiInsight.creditsRemaining });
      await fetchStrategyHistory();
    } catch (err: any) {
      console.error('QuantIQ AI Analyst Agent loop error:', err);
      setInsightError(err.message || 'Error compiling strategy.');
    } finally {
      setLoadingInsight(false);
    }
  };

  // 9. Razorpay Payment Integration
  const handlePayment = async (amountInRupees: number) => {
    if (!user) return;
    try {
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
        description: `Purchase ${amountInRupees} credits for AI Insights`,
        order_id: orderData.createPaymentOrder.orderId,
        handler: async function () {
          // Asynchronously updates credits. Wait 2 seconds and refresh profile
          setTimeout(async () => {
            try {
              const updatedProfile = await graphqlRequest(`
                query {
                  me {
                    credits
                    subscriptionTier
                    messagesRemaining
                    monthlyMessagesUsed
                    lastBillingDate
                  }
                }
              `);
              setUser((prev: any) => prev ? { 
                ...prev, 
                credits: updatedProfile.me.credits,
                subscriptionTier: updatedProfile.me.subscriptionTier,
                messagesRemaining: updatedProfile.me.messagesRemaining,
                monthlyMessagesUsed: updatedProfile.me.monthlyMessagesUsed,
                lastBillingDate: updatedProfile.me.lastBillingDate
              } : null);
            } catch (e) {
              console.error('Refresh credits error:', e);
            }
          }, 2000);
          
          setCurrentView('dashboard');
        },
        prefill: {
          name: user.fullName || 'QuantIQ User',
          email: user.email,
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

  // Auth Router rendering
  if (!token || currentView === 'landing') {
    return (
      <LandingPage
        onGoogleLogin={handleGoogleCredentialResponse}
        googleClientId={GOOGLE_CLIENT_ID}
        onAuthSuccess={handleAuthSuccess}
        apiUrl={API_URL}
        user={user}
        onGoToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  if (currentView === 'upgrade') {
    return (
      <UpgradePage
        user={user}
        onBack={() => setCurrentView('dashboard')}
        onSelectPackage={handlePayment}
      />
    );
  }

  return (
    <>
      <Dashboard
        user={user}
        watchlist={watchlist}
        watchlistQuotes={watchlistQuotes}
        activeTicker={activeTicker}
        chartData={chartData}
        activeStats={activeStats}
        alerts={alerts}
        insight={insight}
        savedStrategies={savedStrategies}
        loadingInsight={loadingInsight}
        insightError={insightError}
        chartRange={chartRange}
        onRangeChange={setChartRange}
        onSelectTicker={setActiveTicker}
        onAddTicker={handleAddWatchlist}
        onRemoveTicker={handleRemoveWatchlist}
        onCreateAlert={handleCreateAlert}
        onDeactivateAlert={handleDeactivateAlert}
        onTriggerInsight={triggerAIInsight}
        onResetInsight={() => { setInsight(null); setInsightError(null); }}
        onOpenRecharge={() => setCurrentView('upgrade')}
        onLogout={handleLogout}
        onLogoClick={() => setCurrentView('landing')}
        onAvatarUpload={(newUrl) => setUser((prev: any) => prev ? { ...prev, pictureUrl: newUrl } : null)}
        indices={indices}
      />

      {/* Toast Notification Stack */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`toast-notification ${toast.type === 'alert' ? 'toast-alert' : 'toast-success'}`}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, flex: 1, textAlign: 'left' }}>{toast.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', outline: 'none' }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
