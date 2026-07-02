import { TrendingUp, Newspaper, Plus } from 'lucide-react';

interface TrendingHubProps {
  onAddTicker: (ticker: string) => Promise<void>;
}

export default function TrendingHub({ onAddTicker }: TrendingHubProps) {
  const trendingAssets = [
    { symbol: 'BTC-USD', name: 'Bitcoin', price: 60534.05, change: 1.82, volume: '28.4B', category: 'Crypto' },
    { symbol: 'ETH-USD', name: 'Ethereum', price: 3421.10, change: 0.54, volume: '14.1B', category: 'Crypto' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 121.40, change: -1.25, volume: '42.8B', category: 'Stock' },
    { symbol: 'AAPL', name: 'Apple Inc.', price: 210.62, change: 0.95, volume: '29.3B', category: 'Stock' },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 187.30, change: 4.12, volume: '18.7B', category: 'Stock' },
    { symbol: 'SOL-USD', name: 'Solana', price: 142.15, change: 3.85, volume: '3.9B', category: 'Crypto' },
  ];

  const trendingNews = [
    {
      id: 1,
      title: 'Federal Reserve Signals Potential Rate Cuts Later This Year',
      summary: 'Fed Chair Jerome Powell indicated inflation is returning to the 2% target path, hinting at upcoming rate adjustments that could fuel market momentum.',
      source: 'Bloomberg',
      time: '12m ago',
      category: 'Macroeconomics'
    },
    {
      id: 2,
      title: 'NVIDIA Demand Outstrips Supply as Tech Giants Expand AI Infrastructure',
      summary: 'Top cloud providers continue to place record-breaking chip orders. Financial firms hike price targets as AI hardware revenues reach unprecedented highs.',
      source: 'Reuters',
      time: '35m ago',
      category: 'Technology'
    },
    {
      id: 3,
      title: 'Bitcoin Solidifies Base Around $60K; On-Chain Accumulation Spikes',
      summary: 'Market intelligence data shows heavy whale wallet accumulation at current support levels, indicating solid long-term investor conviction.',
      source: 'CoinDesk',
      time: '1h ago',
      category: 'Crypto'
    },
    {
      id: 4,
      title: 'Global Tech Stock Indexes Experience Rotational Capital Inflows',
      summary: 'Defensive sector gains support stock index benchmarks as fund managers rebalance portfolios ahead of upcoming consumer price index (CPI) updates.',
      source: 'CNBC',
      time: '2h ago',
      category: 'Markets'
    }
  ];

  return (
    <div className="trending-hub-container animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Welcome Banner */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '24px', 
          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.05) 0%, rgba(161, 84, 255, 0.05) 100%)', 
          border: '1px solid var(--border-glass)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          textAlign: 'left'
        }}
      >
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
          Welcome to QuantIQ Terminal
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '600px' }}>
          Your watchlist is currently empty. Add ticker symbols on the left sidebar to start live streaming charts and utilizing the Quant ReAct AI strategy generator. Or, quickly add a trending asset below to begin.
        </p>
      </div>

      {/* Main Split Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Left Column: Trending Assets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
            <TrendingUp size={18} color="var(--neon-cyan)" />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trending Assets</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {trendingAssets.map((asset) => {
              const isBull = asset.change >= 0;
              return (
                <div 
                  key={asset.symbol} 
                  className="glass-panel trend-card"
                  style={{ 
                    padding: '16px', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px',
                    textAlign: 'left',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid var(--border-glass)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ background: asset.category === 'Crypto' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(161, 84, 255, 0.1)', color: asset.category === 'Crypto' ? 'var(--neon-cyan)' : 'var(--neon-violet)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase', fontSize: '9px' }}>
                        {asset.category}
                      </span>
                      <h4 style={{ margin: '6px 0 2px', fontSize: '14px', fontWeight: 700, color: '#fff' }}>{asset.symbol}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{asset.name}</span>
                    </div>
                    
                    <button 
                      onClick={() => onAddTicker(asset.symbol)}
                      className="control-toggle-btn active"
                      style={{ 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: 'rgba(0, 242, 254, 0.08)', 
                        border: '1px solid rgba(0, 242, 254, 0.2)', 
                        color: 'var(--neon-cyan)', 
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      title="Add to Watchlist"
                    >
                      <Plus size={11} /> Watch
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Price</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>${asset.price.toLocaleString()}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span 
                        style={{ 
                          fontSize: '11px', 
                          fontWeight: 600, 
                          color: isBull ? '#10b981' : '#ef4444', 
                          background: isBull ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          padding: '2px 6px',
                          borderRadius: '6px'
                        }}
                      >
                        {isBull ? '+' : ''}{asset.change}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Trending News */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
            <Newspaper size={18} color="var(--neon-violet)" />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fresh Financial News</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {trendingNews.map((news) => (
              <div 
                key={news.id} 
                className="glass-panel news-card"
                style={{ 
                  padding: '16px', 
                  borderRadius: '12px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px',
                  textAlign: 'left',
                  border: '1px solid var(--border-glass)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-glass)', fontWeight: 600 }}>
                    {news.category}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{news.time}</span>
                </div>
                
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>
                  {news.title}
                </h4>
                
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {news.summary}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>Source: {news.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
