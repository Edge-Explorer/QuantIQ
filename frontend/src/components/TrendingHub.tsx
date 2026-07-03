import { useState, useEffect } from 'react';
import { TrendingUp, Newspaper, Plus } from 'lucide-react';
import Logo from './Logo';

interface TrendingHubProps {
  onAddTicker: (ticker: string) => Promise<void>;
}

export default function TrendingHub({ onAddTicker }: TrendingHubProps) {
  const [news, setNews] = useState<any[]>([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

  useEffect(() => {
    let active = true;
    const fetchLiveNews = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/stocks/news`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0 && active) {
            const parsed = data.map((item: any) => ({
              id: item.id || Math.random().toString(),
              title: item.title,
              summary: item.summary || 'Market updates, corporate developments, and global analyst reporting.',
              source: item.source || 'Yahoo Finance',
              time: item.time || 'Recent',
              category: item.category || 'Markets'
            }));
            setNews(parsed);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to fetch live market news:', err);
      }
      if (active) {
        setNews(trendingNews);
      }
    };

    fetchLiveNews();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div 
      className="trending-hub-container animate-fade" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px', 
        width: '100%', 
        maxHeight: 'calc(100vh - 140px)',
        boxSizing: 'border-box',
        position: 'relative',
        overflowY: 'auto',
        padding: '8px 16px 24px 8px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.06) transparent'
      }}
    >
      
      {/* Background Neon Glowing Orbs */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '-10%',
        width: '350px',
        height: '350px',
        background: 'radial-gradient(circle, rgba(0, 242, 254, 0.07) 0%, transparent 70%)',
        filter: 'blur(50px)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(161, 84, 255, 0.05) 0%, transparent 70%)',
        filter: 'blur(60px)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Cyber Grid Pattern Background Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Massive centered Logo watermark behind cards */}
      <div style={{
        position: 'absolute',
        top: '55%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.035, // Balanced readability vs visibility
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap'
      }}>
        <Logo size={360} />
        <span style={{ 
          fontSize: '36px', 
          fontWeight: 900, 
          color: '#fff', 
          opacity: 0.8,
          letterSpacing: '0.3em', 
          marginTop: '20px',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, sans-serif'
        }}>
          QuantIQ
        </span>
      </div>

      {/* Welcome Banner with neon gradient border */}
      <div 
        className="glass-panel welcome-gradient-border" 
        style={{ 
          padding: '28px 24px', 
          background: 'linear-gradient(#0d101b, #0d101b) padding-box, linear-gradient(135deg, rgba(0, 242, 254, 0.3) 0%, rgba(161, 84, 255, 0.3) 100%) border-box',
          border: '1px solid transparent',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          textAlign: 'left',
          position: 'relative',
          zIndex: 1,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}
      >
        <h2 style={{ 
          margin: 0, 
          fontSize: '22px', 
          fontWeight: 800, 
          background: 'linear-gradient(90deg, #fff 0%, #00f2fe 50%, #a154ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em'
        }}>
          QUANTIQ TERMINAL LIVE
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '680px' }}>
          Your watchlist is currently empty. Pin ticker symbols on the left panel to trigger charting and full-scale ReAct agent strategy workflows. Or click <strong style={{ color: 'var(--neon-cyan)' }}>+ Watch</strong> on any hot asset below to instantly spawn live analytics.
        </p>
      </div>

      {/* Main Split Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', position: 'relative', zIndex: 1 }}>
        
        {/* Left Column: Trending Assets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
            <div style={{ width: '6px', height: '18px', background: 'var(--neon-cyan)', borderRadius: '2px' }} />
            <TrendingUp size={16} color="var(--neon-cyan)" />
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trending Assets</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {trendingAssets.map((asset) => {
              const isBull = asset.change >= 0;
              return (
                <div 
                  key={asset.symbol} 
                  className="glass-panel genz-trend-card"
                  style={{ 
                    padding: '18px 16px', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    textAlign: 'left',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid var(--border-glass)',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    background: 'rgba(13, 16, 27, 0.6)',
                    backdropFilter: 'blur(10px)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ 
                        background: asset.category === 'Crypto' ? 'rgba(0, 242, 254, 0.08)' : 'rgba(161, 84, 255, 0.08)', 
                        color: asset.category === 'Crypto' ? 'var(--neon-cyan)' : 'var(--neon-violet)', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontWeight: 700, 
                        textTransform: 'uppercase', 
                        fontSize: '9px',
                        letterSpacing: '0.04em',
                        border: `1px solid ${asset.category === 'Crypto' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(161, 84, 255, 0.15)'}`
                      }}>
                        {asset.category}
                      </span>
                      <h4 style={{ margin: '8px 0 2px', fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{asset.symbol}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{asset.name}</span>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTicker(asset.symbol);
                      }}
                      className="control-toggle-btn active"
                      style={{ 
                        padding: '5px 10px', 
                        borderRadius: '8px', 
                        background: 'rgba(0, 242, 254, 0.1)', 
                        border: '1px solid rgba(0, 242, 254, 0.25)', 
                        color: 'var(--neon-cyan)', 
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        boxShadow: '0 0 10px rgba(0, 242, 254, 0.15)'
                      }}
                      title="Add to Watchlist"
                    >
                      <Plus size={11} /> Watch
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</span>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>${asset.price.toLocaleString()}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span 
                        style={{ 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          color: isBull ? '#10b981' : '#ef4444', 
                          background: isBull ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${isBull ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
            <div style={{ width: '6px', height: '18px', background: 'var(--neon-violet)', borderRadius: '2px' }} />
            <Newspaper size={16} color="var(--neon-violet)" />
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Financial Feed</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {news.map((item) => (
              <div 
                key={item.id} 
                className="glass-panel genz-news-card"
                onClick={() => item.link && window.open(item.link, '_blank')}
                style={{ 
                  padding: '16px', 
                  borderRadius: '12px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px',
                  textAlign: 'left',
                  border: '1px solid var(--border-glass)',
                  transition: 'all 0.2s ease',
                  background: 'rgba(13, 16, 27, 0.5)',
                  backdropFilter: 'blur(10px)',
                  cursor: item.link ? 'pointer' : 'default'
                }}
                title={item.link ? "Click to read full article" : ""}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '9px', 
                    background: 'rgba(255,255,255,0.03)', 
                    color: 'var(--text-secondary)', 
                    padding: '2px 8px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border-glass)', 
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em'
                  }}>
                    {item.category}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.time}</span>
                </div>
                
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff', lineHeight: 1.45 }}>
                  {item.title}
                </h4>
                
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {item.summary}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Source: <strong style={{ color: 'var(--text-secondary)' }}>{item.source}</strong></span>
                  {item.link && <span style={{ color: 'var(--neon-cyan)', fontSize: '10px', fontWeight: 600 }}>Read More →</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
