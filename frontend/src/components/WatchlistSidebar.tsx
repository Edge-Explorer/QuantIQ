import { useState } from 'react';
import { Plus, Trash, Activity } from 'lucide-react';

interface WatchlistSidebarProps {
  watchlist: string[];
  activeTicker: string;
  onSelectTicker: (ticker: string) => void;
  onAddTicker: (ticker: string) => Promise<void>;
  onRemoveTicker: (ticker: string) => Promise<void>;
}

export default function WatchlistSidebar({
  watchlist,
  activeTicker,
  onSelectTicker,
  onAddTicker,
  onRemoveTicker,
}: WatchlistSidebarProps) {
  const [newTicker, setNewTicker] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = newTicker.trim().toUpperCase();
    if (!cleanTicker) return;
    try {
      await onAddTicker(cleanTicker);
      setNewTicker('');
    } catch (err) {
      console.error('Error adding ticker:', err);
    }
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
      
      <form className="watchlist-search" onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Add ticker (e.g. AAPL)..."
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value)}
        />
        <button className="add-btn" type="submit" aria-label="Add ticker">
          <Plus size={18} />
        </button>
      </form>

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
