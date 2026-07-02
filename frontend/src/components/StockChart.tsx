import { useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Bar, Line, XAxis, YAxis, Tooltip, ReferenceLine, LineChart } from 'recharts';
import { AreaChart as AreaIcon, BarChart2 as CandleIcon, Activity, Eye, EyeOff } from 'lucide-react';

interface ChartDataPoint {
  time: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  range?: [number, number];
}

interface StockChartProps {
  activeTicker: string;
  chartData: ChartDataPoint[];
  activeStats: any;
  chartRange: string;
  onRangeChange: (range: string) => void;
}

// Custom SVG component to draw wicks and body for candlestick bars
const CandlestickBar = (props: any) => {
  const { x, y, width, height, minPrice } = props;
  
  // Extract values safely from props or nested payload
  const open = props.open !== undefined ? props.open : props.payload?.open;
  const close = props.close !== undefined ? props.close : props.payload?.close;
  const high = props.high !== undefined ? props.high : props.payload?.high;
  const low = props.low !== undefined ? props.low : props.payload?.low;

  if (open === undefined || close === undefined || high === undefined || low === undefined || minPrice === undefined) return null;

  const isUp = close >= open;
  const color = isUp ? '#10b981' : '#ef4444'; // green or red
  

  // Calculate scale: pixels per unit price
  // The bottom of the bar corresponds to minPrice. The top of the bar (y) corresponds to close.
  const priceRange = close - minPrice;
  const scale = priceRange > 0 ? height / priceRange : 1;
  
  // Project prices to SVG coordinates
  const yClose = y;
  const yOpen = y + (close - open) * scale;
  const yHigh = y + (close - high) * scale;
  const yLow = y + (close - low) * scale;
  
  const cx = x + width / 2;
  const rectY = Math.min(yClose, yOpen);
  const rectHeight = Math.max(Math.abs(yClose - yOpen), 2); // Ensure at least 2px height for body
  
  // For dense charts (like MAX range), bars can become less than 1px. We cap the minimum body width to 2px so it remains visible.
  const bodyWidth = Math.max(width, 2);
  const bodyX = x - (bodyWidth - width) / 2; // Center the body

  return (
    <g>
      {/* Wick / Shadow (vertical line from high to low) */}
      <line 
        x1={cx} 
        y1={yHigh} 
        x2={cx} 
        y2={yLow} 
        stroke={color} 
        strokeWidth={1.5} 
      />
      {/* Candle Body */}
      <rect 
        x={bodyX} 
        y={rectY} 
        width={bodyWidth} 
        height={rectHeight} 
        fill={color} 
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

export default function StockChart({ activeTicker, chartData, activeStats, chartRange, onRangeChange }: StockChartProps) {
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : null;

  // Chart States
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');
  const [showSMA, setShowSMA] = useState<boolean>(false);
  const [showEMA, setShowEMA] = useState<boolean>(false);
  const [showRSI, setShowRSI] = useState<boolean>(false);

  const ranges = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '1M', value: '1m' },
    { label: '6M', value: '6m' },
    { label: 'YTD', value: 'ytd' },
    { label: '1Y', value: '1y' },
    { label: '5Y', value: '5y' },
    { label: 'MAX', value: 'max' }
  ];

  // Helper: compute SMA 20
  const computeSMA = (data: any[], period: number = 20) => {
    return data.map((d, i) => {
      if (i < period - 1) return { ...d, sma: null };
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((acc, curr) => acc + curr.price, 0);
      return { ...d, sma: parseFloat((sum / period).toFixed(2)) };
    });
  };

  // Helper: compute EMA 20
  const computeEMA = (data: any[], period: number = 20) => {
    const k = 2 / (period + 1);
    let prevEma = data.length > 0 ? data[0].price : 0;
    return data.map((d, i) => {
      if (i === 0) return { ...d, ema: prevEma };
      const ema = d.price * k + prevEma * (1 - k);
      prevEma = ema;
      return { ...d, ema: parseFloat(ema.toFixed(2)) };
    });
  };

  // Helper: compute RSI 14
  const computeRSI = (data: any[], period: number = 14) => {
    if (data.length === 0) return [];
    
    let gains = 0;
    let losses = 0;
    
    // Initial gains/losses
    for (let i = 1; i <= period && i < data.length; i++) {
      const diff = data[i].price - data[i - 1].price;
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    return data.map((d, i) => {
      if (i <= period) return { ...d, rsi: 50 }; // default neutral
      
      const diff = d.price - data[i - 1].price;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      if (avgLoss === 0) return { ...d, rsi: 100 };
      const rs = avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      return { ...d, rsi: parseFloat(rsi.toFixed(2)) };
    });
  };

  // Pipeline processed chart data
  let processedData = [...chartData];
  if (showSMA) processedData = computeSMA(processedData, 20);
  if (showEMA) processedData = computeEMA(processedData, 20);
  
  const rsiData = showRSI ? computeRSI(chartData, 14) : [];

  // Calculate global Y-axis domain bounds dynamically to prevent clipping
  const prices = processedData.map(d => d.price);
  const highs = processedData.map(d => d.high ?? d.price);
  const lows = processedData.map(d => d.low ?? d.price);

  const rawMinPrice = Math.min(...lows, ...prices);
  const rawMaxPrice = Math.max(...highs, ...prices);

  // Add 5% padding to top/bottom to prevent lines touching borders
  const yMin = rawMinPrice === rawMaxPrice ? rawMinPrice * 0.95 : (rawMinPrice > 0 ? rawMinPrice * 0.95 : rawMinPrice);
  const yMax = rawMinPrice === rawMaxPrice ? rawMaxPrice * 1.05 : rawMaxPrice * 1.05;

  return (
    <div className="glass-panel chart-panel">
      <div className="chart-header">
        <div className="active-stock-info">
          <h2>{activeTicker}</h2>
          <span className="active-price">
            {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : '—'}
          </span>
          <div className="live-indicator">
            <span className="live-dot"></span>
            <span>Live</span>
          </div>
        </div>

        <div className="chart-range-selector">
          {ranges.map((r) => (
            <button
              key={r.value}
              className={`range-btn ${chartRange === r.value ? 'active' : ''}`}
              onClick={() => onRangeChange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {activeStats && (
        <div className="stock-metrics-grid">
          <div className="metric-item">
            <span className="metric-label">Open</span>
            <span className="metric-value">${activeStats.open.toFixed(2)}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">High</span>
            <span className="metric-value">${activeStats.high.toFixed(2)}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Low</span>
            <span className="metric-value">${activeStats.low.toFixed(2)}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Volume</span>
            <span className="metric-value">{activeStats.volume.toLocaleString()}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Change</span>
            <span className={`metric-value ${activeStats.change >= 0 ? 'text-bull' : 'text-bear'}`}>
              ${activeStats.change.toFixed(2)}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Range Change %</span>
            <span className={`metric-value ${activeStats.changePercent >= 0 ? 'text-bull' : 'text-bear'}`}>
              {activeStats.changePercent >= 0 ? '+' : ''}{activeStats.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Technical Indicator Controls row */}
      <div className="chart-indicator-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-glass)', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '6px' }}>Chart Type</span>
          <button 
            onClick={() => setChartType('line')} 
            className={`control-toggle-btn ${chartType === 'line' ? 'active' : ''}`}
            title="Line / Area View"
            style={{ padding: '6px 12px', background: chartType === 'line' ? 'rgba(0, 242, 254, 0.1)' : 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: chartType === 'line' ? 'var(--neon-cyan)' : 'var(--text-secondary)', fontSize: '12px', transition: 'all 0.2s ease', outline: 'none' }}
          >
            <AreaIcon size={14} />
            Line
          </button>
          <button 
            onClick={() => setChartType('candle')} 
            className={`control-toggle-btn ${chartType === 'candle' ? 'active' : ''}`}
            title="Candlestick View"
            style={{ padding: '6px 12px', background: chartType === 'candle' ? 'rgba(16, 185, 129, 0.1)' : 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: chartType === 'candle' ? '#10b981' : 'var(--text-secondary)', fontSize: '12px', transition: 'all 0.2s ease', outline: 'none' }}
          >
            <CandleIcon size={14} />
            Candle
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '6px' }}>Technical Overlays</span>
          <button 
            onClick={() => setShowSMA(!showSMA)} 
            className={`control-toggle-btn ${showSMA ? 'active' : ''}`}
            style={{ padding: '6px 12px', background: showSMA ? 'rgba(161, 84, 255, 0.1)' : 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: showSMA ? 'var(--neon-violet)' : 'var(--text-secondary)', fontSize: '12px', transition: 'all 0.2s ease', outline: 'none' }}
          >
            {showSMA ? <Eye size={13} /> : <EyeOff size={13} />}
            SMA 20
          </button>
          <button 
            onClick={() => setShowEMA(!showEMA)} 
            className={`control-toggle-btn ${showEMA ? 'active' : ''}`}
            style={{ padding: '6px 12px', background: showEMA ? 'rgba(251, 146, 60, 0.1)' : 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: showEMA ? '#fb923c' : 'var(--text-secondary)', fontSize: '12px', transition: 'all 0.2s ease', outline: 'none' }}
          >
            {showEMA ? <Eye size={13} /> : <EyeOff size={13} />}
            EMA 20
          </button>
          <button 
            onClick={() => setShowRSI(!showRSI)} 
            className={`control-toggle-btn ${showRSI ? 'active' : ''}`}
            style={{ padding: '6px 12px', background: showRSI ? 'rgba(0, 242, 254, 0.1)' : 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: showRSI ? 'var(--neon-cyan)' : 'var(--text-secondary)', fontSize: '12px', transition: 'all 0.2s ease', outline: 'none' }}
          >
            <Activity size={13} />
            RSI 14
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="chart-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 16px 0', position: 'relative' }}>
        {processedData.length > 0 ? (
          <div style={{ height: showRSI ? 'calc(100% - 120px)' : '100%', width: '100%', minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processedData} margin={{ top: 10, right: 5, left: 20, bottom: 25 }}>
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
                  domain={[yMin, yMax]}
                  tickLine={false}
                />
                
                <Tooltip 
                  contentStyle={{ 
                    background: '#0d101b', 
                    borderColor: '#2e303a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />

                {/* Primary Chart Type Representation */}
                {chartType === 'line' ? (
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#00f2fe" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#chartGlow)" 
                    name="Price"
                  />
                ) : (
                  <Bar 
                    dataKey="close"
                    shape={<CandlestickBar minPrice={yMin} />}
                    name="Candlestick"
                  />
                )}

                {/* Moving Average Indicators */}
                {showSMA && (
                  <Line 
                    type="monotone" 
                    dataKey="sma" 
                    stroke="var(--neon-violet)" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4"
                    dot={false}
                    name="SMA 20"
                  />
                )}
                {showEMA && (
                  <Line 
                    type="monotone" 
                    dataKey="ema" 
                    stroke="#fb923c" // Orange
                    strokeWidth={1.5} 
                    dot={false}
                    name="EMA 20"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', padding: '20px', textAlign: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
              {chartRange === '1d' 
                ? `Waiting for live ${activeTicker} ticks from Redpanda...`
                : `No historical data found for ${activeTicker}.`
              }
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', maxWidth: '340px', lineHeight: '140%' }}>
              Please verify if the ticker exists on Yahoo Finance (e.g., ADANIENT.NS for Adani Enterprises, GOOGL for Google).
            </span>
          </div>
        )}

        {/* Technical Indicator panel: RSI 14 (Auxiliary Chart below main price chart) */}
        {showRSI && rsiData.length > 0 && (
          <div style={{ height: '100px', width: '100%', borderTop: '1px dashed var(--border-glass)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', paddingLeft: '10px' }}>
              <span style={{ fontWeight: 700, color: 'var(--neon-cyan)' }}>RSI (14)</span>
              <span style={{ color: 'var(--text-muted)' }}>Overbought &gt;70 | Oversold &lt;30</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rsiData} margin={{ top: 5, right: 5, left: 20, bottom: 5 }}>
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={9} domain={[0, 100]} tickLine={false} ticks={[30, 50, 70]} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#0d101b', 
                    borderColor: '#2e303a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                
                {/* Baseline references */}
                <ReferenceLine y={70} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" label={{ value: 'OB', fill: '#ef4444', fontSize: 8, position: 'insideTopLeft' }} />
                <ReferenceLine y={50} stroke="#475569" strokeWidth={0.5} strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" label={{ value: 'OS', fill: '#10b981', fontSize: 8, position: 'insideBottomLeft' }} />
                
                <Line 
                  type="monotone" 
                  dataKey="rsi" 
                  stroke="var(--neon-cyan)" 
                  strokeWidth={1.5} 
                  dot={false}
                  name="RSI 14"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
