import { useState, useRef, useEffect } from 'react';
import { Plus, Trash, Activity } from 'lucide-react';

interface WatchlistSidebarProps {
  watchlist: string[];
  activeTicker: string;
  onSelectTicker: (ticker: string) => void;
  onAddTicker: (ticker: string) => Promise<void>;
  onRemoveTicker: (ticker: string) => Promise<void>;
}

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

// Popular global stock suggestions with full names for search helper
const POPULAR_SUGGESTIONS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "GOOGL", name: "Alphabet (Google)" },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "TCS.NS", name: "Tata Consultancy Services" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries" },
  { symbol: "INFY", name: "Infosys Ltd" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "INTC", name: "Intel Corp." },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "ADANIENT.NS", name: "Adani Enterprises" },
  { symbol: "ADANIPORTS.NS", name: "Adani Ports" },
  { symbol: "ADANIPOWER.NS", name: "Adani Power" }
];

export default function WatchlistSidebar({
  watchlist,
  activeTicker,
  onSelectTicker,
  onAddTicker,
  onRemoveTicker,
}: WatchlistSidebarProps) {
  const [newTicker, setNewTicker] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
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

  // Filter popular suggestions dynamically
  const getSuggestions = () => {
    const inputClean = newTicker.trim().toUpperCase();
    if (!inputClean) return [];
    
    return POPULAR_SUGGESTIONS.filter(item => {
      const matchSymbol = item.symbol.toUpperCase().includes(inputClean);
      const matchName = item.name.toUpperCase().includes(inputClean);
      return matchSymbol || matchName;
    });
  };

  const activeSuggestions = getSuggestions();

  const handleAdd = async (ticker: string) => {
    let cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) return;

    // Auto-correct dictionary matching
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
    try {
      await onRemoveTicker(ticker);
    } catch (err) {
      console.error('Error removing ticker:', err);
    }
  };

  return (
    <section className="left-sidebar glass-panel watchlist-container">
      <div className="panel-title">
        <span>Watchlist</span>
        <Activity size={18} color="#94a3b8" />
      </div>
      
      <div style={{ position: 'relative' }} ref={dropdownRef}>
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

        {showDropdown && activeSuggestions.length > 0 && (
          <div className="suggestions-dropdown">
            {activeSuggestions.map((item) => (
              <div 
                key={item.symbol} 
                className="suggestion-item"
                onClick={() => handleAdd(item.symbol)}
              >
                <span className="suggestion-symbol">{item.symbol}</span>
                <span className="suggestion-name">{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="watchlist-items">
        {watchlist.map((ticker) => (
          <div 
            key={ticker}
            className={`watchlist-item ${activeTicker === ticker ? 'active' : ''}`}
            onClick={() => onSelectTicker(ticker)}
          >
            <span className="ticker-symbol">{ticker}</span>
            <button 
              className="delete-ticker-btn"
              onClick={(e) => handleRemove(ticker, e)}
              aria-label={`Remove ${ticker} from watchlist`}
            >
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
