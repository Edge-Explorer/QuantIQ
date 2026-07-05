import { useState, useRef, useEffect } from 'react';
import { Plus, Trash, Activity } from 'lucide-react';
import Sparkline from './Sparkline';
import Logo from './Logo';

interface WatchlistSidebarProps {
  watchlist: string[];
  watchlistQuotes: Record<string, { price: number; changePercent: number }>;
  activeTicker: string;
  onSelectTicker: (ticker: string) => void;
  onAddTicker: (ticker: string) => Promise<void>;
  onRemoveTicker: (ticker: string) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Typo mapping to automatically resolve company names to correct tickers
const TYPO_MAP: Record<string, string> = {
  "GOOGLE": "GOOGL",
  "ALPHABET": "GOOGL",
  "FACEBOOK": "META",
  "META PLATFORMS": "META",
  "APPLE": "AAPL",
  "AMAZON": "AMZN",
  "MICROSOFT": "MSFT",
  "NETFLIX": "NFLX",
  "TESLA": "TSLA",
  "RELIANCE": "RELIANCE.NS",
  "TCS": "TCS.NS",
  "TATA CONSULTANCY": "TCS.NS",
  "INFOSYS": "INFY",
  "NVIDIA": "NVDA",
  "AMD": "AMD",
  "INTEL": "INTC",
  "ADOBE": "ADBE",
  "SALESFORCE": "CRM",
  "COCA COLA": "KO",
  "PEPSI": "PEP",
  "ADANI": "ADANIENT.NS",
  "ADANI ENTERPRISES": "ADANIENT.NS",
  "ADANIENT": "ADANIENT.NS",
  "ADANIPORTS": "ADANIPORTS.NS",
  "ADANIPOWER": "ADANIPOWER.NS"
};

// Popular default suggestions to show when search is empty
const DEFAULT_SUGGESTIONS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "GOOGL", name: "Alphabet (Google)" },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "ADANIENT.NS", name: "Adani Enterprises" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries" }
];

export default function WatchlistSidebar({
  watchlist,
  watchlistQuotes,
  activeTicker,
  onSelectTicker,
  onAddTicker,
  onRemoveTicker,
}: WatchlistSidebarProps) {
  const [newTicker, setNewTicker] = useState('');
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tickerToDelete, setTickerToDelete] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced dynamic search from Yahoo Finance proxy API
  useEffect(() => {
    const query = newTicker.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/v1/stocks/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setSuggestions(data);
          } else {
            setSuggestions([]);
          }
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error('Error fetching stock suggestions:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [newTicker]);

  // Determine what suggestions to display
  const displaySuggestions = (newTicker.trim().length >= 2 && Array.isArray(suggestions)) ? suggestions : DEFAULT_SUGGESTIONS;

  const handleAdd = async (ticker: string) => {
    let cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) return;

    // Apply auto-correct map if matched
    if (TYPO_MAP[cleanTicker]) {
      cleanTicker = TYPO_MAP[cleanTicker];
    }

    try {
      await onAddTicker(cleanTicker);
      setNewTicker('');
      setShowDropdown(false);
    } catch (err) {
      console.error('Error adding ticker:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAdd(newTicker);
  };

  const handleRemove = async (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting as active ticker
    setTickerToDelete(ticker);
  };

  return (
    <section className="left-sidebar glass-panel watchlist-container" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="panel-title" style={{ position: 'relative', zIndex: 2 }}>
        <span>Watchlist</span>
        <Activity size={18} color="#94a3b8" />
      </div>
      
      <div style={{ position: 'relative', zIndex: 2 }} ref={dropdownRef}>
        <form className="watchlist-search" onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="Add ticker (e.g. AAPL)..."
            value={newTicker}
            onChange={(e) => {
              setNewTicker(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
          <button className="add-btn" type="submit" aria-label="Add ticker">
            <Plus size={18} />
          </button>
        </form>

        {showDropdown && displaySuggestions.length > 0 && (
          <div className="suggestions-dropdown">
            {loading && (
              <div style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Searching global markets...
              </div>
            )}
            {displaySuggestions.map((item) => (
              <div 
                key={item.symbol} 
                className="suggestion-item"
                onMouseDown={(e) => {
                  // prevent blur event from closing the dropdown before state is updated
                  e.preventDefault();
                }}
                onClick={() => {
                  setNewTicker(item.symbol);
                  setShowDropdown(false);
                }}
              >
                <span className="suggestion-symbol">{item.symbol}</span>
                <span className="suggestion-name">{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subtle background Logo watermark */}
      <div style={{
        position: 'absolute',
        top: '60%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.035,
        pointerEvents: 'none',
        zIndex: 1,
        userSelect: 'none'
      }}>
        <Logo size={180} />
      </div>

      <div className="watchlist-items" style={{ position: 'relative', zIndex: 2 }}>
        {watchlist.map((ticker) => {
          const quote = watchlistQuotes ? watchlistQuotes[ticker] : null;
          const isPositive = quote ? quote.changePercent >= 0 : true;
          return (
            <div 
              key={ticker}
              className={`watchlist-item ${activeTicker === ticker ? 'active' : ''}`}
              onClick={() => onSelectTicker(ticker)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start', flex: 1 }}>
                <span className="ticker-symbol">{ticker}</span>
                {quote && (
                  <span className={`ticker-quote-badge ${isPositive ? 'text-bull' : 'text-bear'}`} style={{ fontSize: '11px', fontWeight: 500 }}>
                    ${quote.price.toFixed(2)} ({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>

              {quote && (
                <div style={{ marginRight: '6px', display: 'flex', alignItems: 'center' }}>
                  <Sparkline symbol={ticker} change={quote.changePercent} width={60} height={20} />
                </div>
              )}

              <button 
                className="delete-ticker-btn"
                onClick={(e) => handleRemove(ticker, e)}
                aria-label={`Remove ${ticker} from watchlist`}
              >
                <Trash size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {tickerToDelete && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content glass-panel liquid-glass animate-fade-rise" style={{ border: '1px solid rgba(255, 23, 68, 0.3)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Confirm Deletion
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '150%' }}>
              Are you sure you want to remove <strong style={{ color: 'var(--neon-cyan)' }}>{tickerToDelete}</strong> from your watchlist?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setTickerToDelete(null)}
                className="modal-cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const ticker = tickerToDelete;
                  setTickerToDelete(null);
                  try {
                    await onRemoveTicker(ticker);
                  } catch (err) {
                    console.error('Error removing ticker:', err);
                  }
                }}
                className="modal-confirm-btn"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
