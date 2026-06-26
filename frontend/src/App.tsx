import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
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
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>(localStorage.getItem('quantiq_jwt') ? 'dashboard' : 'landing');
  
  // Dashboard Core State
  const [watchlist, setWatchlist] = useState<string[]>(['AAPL', 'TSLA', 'TCS.NS', 'RELIANCE.NS']);
  const [activeTicker, setActiveTicker] = useState<string>('AAPL');
  const [chartData, setChartData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  
  // AI Insights State
  const [insight, setInsight] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState<boolean>(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  // Recharge Modal State
  const [showRecharge, setShowRecharge] = useState<boolean>(false);

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
        const tick = msg.payload.data?.streamStockTicks;
        if (!tick) return;
        
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
  const handleAuthSuccess = (accessToken: string) => {
    localStorage.setItem('quantiq_jwt', accessToken);
    setToken(accessToken);
    setCurrentView('dashboard');
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    try {
      const idToken = response.credential;
      const res = await fetch(`${API_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: idToken }),
      }).then(r => r.json());

      if (res.access_token) {
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

    if (!watchlist.includes(tickerUpper)) {
      setWatchlist([...watchlist, tickerUpper]);
    }
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
  const triggerAIInsight = async () => {
    if (!user || (user.credits <= 0 && user.email !== 'karanshelar8775@gmail.com')) {
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

  return (
    <Dashboard
      user={user}
      watchlist={watchlist}
      activeTicker={activeTicker}
      chartData={chartData}
      alerts={alerts}
      insight={insight}
      loadingInsight={loadingInsight}
      insightError={insightError}
      showRecharge={showRecharge}
      onSelectTicker={setActiveTicker}
      onAddTicker={handleAddWatchlist}
      onRemoveTicker={handleRemoveWatchlist}
      onCreateAlert={handleCreateAlert}
      onDeactivateAlert={handleDeactivateAlert}
      onTriggerInsight={triggerAIInsight}
      onCloseRecharge={() => setShowRecharge(false)}
      onOpenRecharge={() => setShowRecharge(true)}
      onSelectPackage={handlePayment}
      onLogout={handleLogout}
      onLogoClick={() => setCurrentView('landing')}
    />
  );
}
