import { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Bar, Cell, Line, XAxis, YAxis, Tooltip, ReferenceLine, LineChart } from 'recharts';
import { AreaChart as AreaIcon, BarChart2 as CandleIcon, Activity, Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';
import ChartChatbot from './ChartChatbot';

// Backend REST base URL (matches the rest of the frontend)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ChartDataPoint {
  time: string;
  // Epoch seconds of the candle — used to align backend indicator series with the chart
  ts?: number;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  range?: [number, number];
  // Bollinger Bands (aligned by ts from /api/v1/indicators)
  bb_upper?: number | null;
  bb_middle?: number | null;
  bb_lower?: number | null;
  // MACD (aligned by ts from /api/v1/indicators)
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  // RSI (aligned by ts from /api/v1/indicators)
  rsi?: number | null;
}

interface StockChartProps {
  activeTicker: string;
  chartData: ChartDataPoint[];
  activeStats: any;
  chartRange: string;
  onRangeChange: (range: string) => void;
  user?: any;
  onOpenRecharge?: () => void;
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

// Custom premium Tooltip component for stock chart hover stats
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isCandle = data.open !== undefined && data.close !== undefined;
    
    return (
      <div style={{
        background: 'rgba(13, 16, 27, 0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 12px 24px rgba(0, 0, 0, 0.6)',
        color: '#fff',
        fontSize: '12px',
        fontFamily: 'inherit',
        minWidth: '160px'
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', marginBottom: '8px' }}>
          {label}
        </div>
        
        {isCandle ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Open</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>${data.open.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted)' }}>High</span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>${data.high?.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Low</span>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>${data.low?.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Close</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>${data.close.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Price</span>
            <span style={{ fontWeight: 600, color: 'var(--neon-cyan)' }}>${data.price.toFixed(2)}</span>
          </div>
        )}
        
        {payload.map((entry: any, index: number) => {
          if (entry.dataKey === 'sma' && entry.value !== undefined && entry.value !== null) {
            return (
              <div key={`sma-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: 'var(--neon-violet)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginTop: '4px' }}>
                <span>SMA 20</span>
                <span style={{ fontWeight: 600 }}>${entry.value.toFixed(2)}</span>
              </div>
            );
          }
          if (entry.dataKey === 'ema' && entry.value !== undefined && entry.value !== null) {
            return (
              <div key={`ema-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#fb923c', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginTop: '4px' }}>
                <span>EMA 20</span>
                <span style={{ fontWeight: 600 }}>${entry.value.toFixed(2)}</span>
              </div>
            );
          }
          if (entry.dataKey === 'bb_upper' && entry.value !== undefined && entry.value !== null) {
            return (
              <div key={`bbu-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#a154ff', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginTop: '4px' }}>
                <span>BB Upper</span>
                <span style={{ fontWeight: 600 }}>${entry.value.toFixed(2)}</span>
              </div>
            );
          }
          if (entry.dataKey === 'bb_middle' && entry.value !== undefined && entry.value !== null) {
            return (
              <div key={`bbm-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#f59e0b', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginTop: '4px' }}>
                <span>BB Middle</span>
                <span style={{ fontWeight: 600 }}>${entry.value.toFixed(2)}</span>
              </div>
            );
          }
          if (entry.dataKey === 'bb_lower' && entry.value !== undefined && entry.value !== null) {
            return (
              <div key={`bbl-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#a154ff', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginTop: '4px' }}>
                <span>BB Lower</span>
                <span style={{ fontWeight: 600 }}>${entry.value.toFixed(2)}</span>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }
  return null;
};

// Merges backend-computed indicator series (from /api/v1/indicators) into the chart
// data, keyed by each candle's epoch timestamp (ts). Any candle without a matching
// backend value (e.g. live ticks appended after the fetch) falls back to null so
// recharts simply leaves a gap instead of drawing garbage.
const mergeIndicators = (data: ChartDataPoint[], ind: any): ChartDataPoint[] => {
  if (!ind) return data;
  const toMap = (arr?: any[]) => new Map((arr || []).map((p: any) => [p.time, p.value]));

  const bbUpper = toMap(ind.bollinger_bands?.upper);
  const bbMiddle = toMap(ind.bollinger_bands?.middle);
  const bbLower = toMap(ind.bollinger_bands?.lower);
  const macdLine = toMap(ind.macd?.line);
  const macdSignal = toMap(ind.macd?.signal);
  const macdHist = toMap(ind.macd?.histogram);
  const rsiVal = toMap(ind.rsi);

  return data.map((d) => {
    const t = d.ts;
    return {
      ...d,
      bb_upper: t !== undefined && bbUpper.has(t) ? bbUpper.get(t) : null,
      bb_middle: t !== undefined && bbMiddle.has(t) ? bbMiddle.get(t) : null,
      bb_lower: t !== undefined && bbLower.has(t) ? bbLower.get(t) : null,
      macd: t !== undefined && macdLine.has(t) ? macdLine.get(t) : null,
      macd_signal: t !== undefined && macdSignal.has(t) ? macdSignal.get(t) : null,
      macd_hist: t !== undefined && macdHist.has(t) ? macdHist.get(t) : null,
      rsi: t !== undefined && rsiVal.has(t) ? rsiVal.get(t) : null,
    };
  });
};

export default function StockChart({ activeTicker, chartData, activeStats, chartRange, onRangeChange, user, onOpenRecharge }: StockChartProps) {
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : null;

  // Chart States
  const [chartType, setChartType] = useState<'line' | 'candle'>(() => {
    const email = localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    const saved = localStorage.getItem(`quantiq_chart_type_${email}_${activeTicker}`);
    return (saved as 'line' | 'candle') || 'line';
  });
  const [showSMA, setShowSMA] = useState<boolean>(() => {
    const email = localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    const saved = localStorage.getItem(`quantiq_show_sma_${email}_${activeTicker}`);
    return saved === 'true';
  });
  const [showEMA, setShowEMA] = useState<boolean>(() => {
    const email = localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    const saved = localStorage.getItem(`quantiq_show_ema_${email}_${activeTicker}`);
    return saved === 'true';
  });
  const [showRSI, setShowRSI] = useState<boolean>(() => {
    const email = localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    const saved = localStorage.getItem(`quantiq_show_rsi_${email}_${activeTicker}`);
    return saved === 'true';
  });
  const [showMACD, setShowMACD] = useState<boolean>(() => {
    const email = localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    const saved = localStorage.getItem(`quantiq_show_macd_${email}_${activeTicker}`);
    return saved === 'true';
  });
  const [showBB, setShowBB] = useState<boolean>(() => {
    const email = localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    const saved = localStorage.getItem(`quantiq_show_bb_${email}_${activeTicker}`);
    return saved === 'true';
  });
  const [isMaximized, setIsMaximized] = useState<boolean>(() => {
    return sessionStorage.getItem('quantiq_restore_maximized_chart') === 'true';
  });

  // Track email & clear restoration flag on mount
  useEffect(() => {
    if (user?.email) {
      localStorage.setItem('quantiq_last_logged_in_email', user.email);
    }
    if (sessionStorage.getItem('quantiq_restore_maximized_chart') === 'true') {
      sessionStorage.removeItem('quantiq_restore_maximized_chart');
    }
  }, [user]);

  // Persist chartType, SMA, EMA, and RSI states on change
  useEffect(() => {
    const email = user?.email || localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    localStorage.setItem(`quantiq_chart_type_${email}_${activeTicker}`, chartType);
  }, [chartType, activeTicker, user]);

  useEffect(() => {
    const email = user?.email || localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    localStorage.setItem(`quantiq_show_sma_${email}_${activeTicker}`, String(showSMA));
  }, [showSMA, activeTicker, user]);

  useEffect(() => {
    const email = user?.email || localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    localStorage.setItem(`quantiq_show_ema_${email}_${activeTicker}`, String(showEMA));
  }, [showEMA, activeTicker, user]);

  useEffect(() => {
    const email = user?.email || localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    localStorage.setItem(`quantiq_show_rsi_${email}_${activeTicker}`, String(showRSI));
  }, [showRSI, activeTicker, user]);

  useEffect(() => {
    const email = user?.email || localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    localStorage.setItem(`quantiq_show_macd_${email}_${activeTicker}`, String(showMACD));
  }, [showMACD, activeTicker, user]);

  useEffect(() => {
    const email = user?.email || localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    localStorage.setItem(`quantiq_show_bb_${email}_${activeTicker}`, String(showBB));
  }, [showBB, activeTicker, user]);

  // ── Backend-computed indicators (MACD + Bollinger Bands) ──
  // Fetched from /api/v1/indicators whenever MACD/BB is toggled on or the ticker /
  // range changes. Series are aligned by epoch timestamp (ts) with the candles
  // served by the stockHistory query, so they always line up with the chart.
  const [indicatorData, setIndicatorData] = useState<any>(null);
  const [indicatorLoading, setIndicatorLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!showMACD && !showBB) {
      setIndicatorData(null);
      setIndicatorLoading(false);
      return;
    }
    let cancelled = false;
    setIndicatorLoading(true);
    const url = `${API_URL}/api/v1/indicators?ticker=${encodeURIComponent(activeTicker)}&range=${encodeURIComponent(chartRange)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Indicators API responded with ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setIndicatorData(data);
      })
      .catch((err) => {
        console.error('Failed to load chart indicators:', err);
        if (!cancelled) setIndicatorData(null);
      })
      .finally(() => {
        if (!cancelled) setIndicatorLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTicker, chartRange, showMACD, showBB]);

  // Zoom Factor and Scroll/Pan states — active always (Binance-style interactions)
  const [zoomFactor, setZoomFactor] = useState<number>(1.0);
  const [scrollIndex, setScrollIndex] = useState<number>(0);

  // Drag-to-pan state refs (no re-render on drag move)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollIndex = useRef(0);
  // Ref to the chart canvas div — used for non-passive wheel listener
  const chartCanvasRef = useRef<HTMLDivElement>(null);

  // Reset zoom and scroll when ticker or range changes
  useEffect(() => {
    setZoomFactor(1.0);
    setScrollIndex(0);
  }, [activeTicker, chartRange]);

  // Adjust scroll position to latest candles whenever zoom factor changes
  useEffect(() => {
    if (zoomFactor >= 1.0) {
      setScrollIndex(0);
    } else {
      const visibleCount = Math.max(5, Math.round(chartData.length * zoomFactor));
      const maxScroll = Math.max(0, chartData.length - visibleCount);
      setScrollIndex(prev => Math.min(prev, maxScroll));
    }
  }, [zoomFactor, chartData.length]);

  // Non-passive wheel listener on the chart canvas — the ONLY way to call
  // e.preventDefault() in Chrome and stop page scroll while hovering the chart.
  // React's synthetic onWheel is passive by default since React 17.
  //
  // CRITICAL: The chart canvas div renders CONDITIONALLY (only when processedData
  // has items), so we depend on processedData.length to re-run this effect the
  // moment data loads and chartCanvasRef.current becomes valid.
  useEffect(() => {
    const el = chartCanvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // stops BOTH page scroll AND browser pinch-zoom
      const zoomStep = 0.08;
      if (e.deltaY < 0) {
        setZoomFactor(prev => Math.max(0.1, prev - zoomStep));
      } else {
        setZoomFactor(prev => Math.min(1.0, prev + zoomStep));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [chartData.length]); // re-run when data availability changes

  // Markers state for drawing entry/exit lines
  interface ChartMarker {
    id: string;
    price: number;
    label: string;
    color: string;
  }
  const [markers, setMarkers] = useState<ChartMarker[]>(() => {
    const email = localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    if (activeTicker) {
      const saved = localStorage.getItem(`quantiq_markers_${email}_${activeTicker}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved markers:', e);
        }
      }
    }
    return [];
  });

  // Reload markers on ticker/user change
  useEffect(() => {
    const email = user?.email || localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    if (activeTicker) {
      const saved = localStorage.getItem(`quantiq_markers_${email}_${activeTicker}`);
      if (saved) {
        try {
          setMarkers(JSON.parse(saved));
          return;
        } catch (e) {
          console.error('Failed to parse saved markers:', e);
        }
      }
    }
    setMarkers([]);
  }, [activeTicker, user?.email]);

  // Save markers to localStorage when updated
  useEffect(() => {
    const email = user?.email || localStorage.getItem('quantiq_last_logged_in_email') || 'generic';
    if (activeTicker) {
      localStorage.setItem(`quantiq_markers_${email}_${activeTicker}`, JSON.stringify(markers));
    }
  }, [markers, activeTicker, user?.email]);
  const [showAddMarkerForm, setShowAddMarkerForm] = useState<boolean>(false);
  const [newMarkerLabel, setNewMarkerLabel] = useState<string>('Entry');
  const [newMarkerPrice, setNewMarkerPrice] = useState<string>('');
  const [newMarkerColor, setNewMarkerColor] = useState<string>('#10b981'); // Default green

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

  // Pipeline processed chart data — enrich with backend MACD/BB series first,
  // then apply the client-side SMA/EMA overlays.
  let processedData = mergeIndicators([...chartData], indicatorData);
  if (showSMA) processedData = computeSMA(processedData, 20);
  if (showEMA) processedData = computeEMA(processedData, 20);

  // Compute full set of indicators for chatbot live coordinates context
  const chatbotData = computeRSI(computeEMA(computeSMA([...chartData], 20), 20), 14);
  const latestDataPoint = chatbotData[chatbotData.length - 1] || null;
  const chatbotLiveData = {
    price: latestDataPoint?.close || latestDataPoint?.price || activeStats?.close || null,
    sma: latestDataPoint?.sma || null,
    ema: latestDataPoint?.ema || null,
    rsi: latestDataPoint?.rsi || null
  };
  
  // Slice data based on zoom — works in both normal and maximized views
  const isZoomed = zoomFactor < 1.0;
  const visibleCount = Math.max(5, Math.round(processedData.length * zoomFactor));
  const maxScrollIndex = Math.max(0, processedData.length - visibleCount);
  const currentScrollIndex = isZoomed ? Math.min(scrollIndex, maxScrollIndex) : 0;

  const visibleData = isZoomed
    ? processedData.slice(currentScrollIndex, currentScrollIndex + visibleCount)
    : processedData;
  
  const rsiData = showRSI ? computeRSI(chartData, 14) : [];
  const visibleRsiData = showRSI
    ? (indicatorData?.rsi
        ? visibleData.map(d => ({ time: d.time, rsi: d.rsi }))
        : (isZoomed ? rsiData.slice(currentScrollIndex, currentScrollIndex + visibleCount) : rsiData))
    : [];

  // MACD data is enriched onto processedData by mergeIndicators (aligned by ts)
  const macdData = showMACD ? processedData : [];
  const visibleMacdData = isZoomed
    ? macdData.slice(currentScrollIndex, currentScrollIndex + visibleCount)
    : macdData;

  // Calculate global Y-axis domain bounds dynamically to prevent clipping
  // Filter to only finite, positive numbers to prevent garbage values like NaN/Infinity
  // from corrupting Math.min/max and producing labels like 'i1499999986'
  const filterFinite = (arr: number[]) => arr.filter(v => typeof v === 'number' && isFinite(v) && v > 0);
  const prices = filterFinite(visibleData.map(d => d.price));
  const highs = filterFinite(visibleData.map(d => d.high ?? d.price));
  const lows = filterFinite(visibleData.map(d => d.low ?? d.price));

  // Include Bollinger Band extremes so the overlay never clips against the Y domain
  const bbHighs = showBB ? filterFinite(visibleData.map(d => d.bb_upper as number)) : [];
  const bbLows = showBB ? filterFinite(visibleData.map(d => d.bb_lower as number)) : [];

  const rawMinPrice = prices.length > 0 ? Math.min(...lows.length > 0 ? lows : prices, ...prices, ...bbLows) : 0;
  const rawMaxPrice = prices.length > 0 ? Math.max(...highs.length > 0 ? highs : prices, ...prices, ...bbHighs) : 100;

  // Add 5% padding to top/bottom to prevent lines touching borders
  const yMin = rawMinPrice === rawMaxPrice ? rawMinPrice * 0.95 : (rawMinPrice > 0 ? rawMinPrice * 0.95 : rawMinPrice);
  const yMax = rawMinPrice === rawMaxPrice ? rawMaxPrice * 1.05 : rawMaxPrice * 1.05;

  // Sub-pane sizing: RSI + MACD are stacked below the main chart. The container
  // grows with each active pane and the main chart shrinks proportionally so the
  // multi-pane layout stays balanced in both normal and maximized modes.
  const subPaneCount = (showRSI ? 1 : 0) + (showMACD ? 1 : 0);
  const subPanePct = isZoomed ? 18 : 24;
  const mainChartHeight = isMaximized
    ? `calc(${100 - subPanePct * subPaneCount - (isZoomed ? 20 : 4)}%)`
    : '340px';
  const subPaneHeight = isMaximized
    ? `calc(${subPanePct}%)`
    : '100px';

  // Mouse-wheel zoom is now handled via non-passive native addEventListener above.
  // Drag-to-pan handlers (Binance-style: click + drag left/right to pan)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartScrollIndex.current = currentScrollIndex;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !isZoomed) return;
    // Each ~8px of mouse movement = 1 candle shift
    const deltaX = dragStartX.current - e.clientX;
    const canvasWidth = e.currentTarget.clientWidth;
    const pixelsPerCandle = canvasWidth / visibleCount;
    const candleShift = Math.round(deltaX / pixelsPerCandle);
    const newIndex = Math.max(0, Math.min(dragStartScrollIndex.current + candleShift, maxScrollIndex));
    setScrollIndex(newIndex);
  };

  const handleMouseUp = () => { isDragging.current = false; };
  const handleMouseLeave = () => { isDragging.current = false; };

  const chartPanelStyle: React.CSSProperties = isMaximized ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9999,
    background: 'rgba(9, 11, 20, 0.98)',
    backdropFilter: 'blur(24px)',
    padding: '20px 24px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 0,
    border: 'none',
    overflow: 'hidden'
  } : {};

  return (
    <div className="glass-panel chart-panel" style={chartPanelStyle}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="control-toggle-btn"
            title={isMaximized ? "Minimize Chart" : "Maximize Chart"}
            style={{
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Horizontal Flex Split View when Maximized */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          gap: '20px', 
          flex: 1, 
          width: '100%', 
          height: isMaximized ? 'calc(100% - 60px)' : 'auto', 
          overflow: isMaximized ? 'hidden' : 'visible'
        }}
      >
        {/* Left Column: Metrics grid, controls, and charts */}
        <div 
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            overflowY: isMaximized ? 'auto' : 'visible',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.06) transparent',
            gap: isMaximized ? '14px' : '0',
            paddingRight: isMaximized ? '8px' : '0'
          }}
        >
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
          <button 
            onClick={() => setShowMACD(!showMACD)} 
            className={`control-toggle-btn indicator-macd ${showMACD ? 'active' : ''}`}
            title="Moving Average Convergence Divergence"
            style={{ padding: '6px 12px', background: showMACD ? 'rgba(161, 84, 255, 0.1)' : 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: showMACD ? 'var(--neon-violet)' : 'var(--text-secondary)', fontSize: '12px', transition: 'all 0.2s ease', outline: 'none' }}
          >
            {showMACD ? <Eye size={13} /> : <EyeOff size={13} />}
            MACD
          </button>
          <button 
            onClick={() => setShowBB(!showBB)} 
            className={`control-toggle-btn indicator-bb ${showBB ? 'active' : ''}`}
            title="Bollinger Bands (20, 2)"
            style={{ padding: '6px 12px', background: showBB ? 'rgba(245, 158, 11, 0.1)' : 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: showBB ? '#f59e0b' : 'var(--text-secondary)', fontSize: '12px', transition: 'all 0.2s ease', outline: 'none' }}
          >
            {showBB ? <Eye size={13} /> : <EyeOff size={13} />}
            Bollinger
          </button>
        </div>
      </div>

      {/* Maximized-only marker controls bar */}
      {isMaximized && (
        <div className="chart-marker-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 16px', background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid var(--border-glass)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chart Markers</span>
          <button 
            onClick={() => {
              setNewMarkerPrice(currentPrice ? currentPrice.toFixed(2) : '');
              setShowAddMarkerForm(!showAddMarkerForm);
            }}
            className="control-toggle-btn active"
            style={{ padding: '6px 12px', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '6px', cursor: 'pointer', color: 'var(--neon-cyan)', fontSize: '12px', outline: 'none' }}
          >
            + Add Marker
          </button>

          {/* Active markers list with delete buttons */}
          {markers.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>| Active:</span>
              {markers.map(m => (
                <span 
                  key={m.id} 
                  style={{ 
                    fontSize: '11px', 
                    background: 'rgba(255,255,255,0.02)', 
                    border: `1px solid ${m.color}80`, 
                    borderRadius: '6px', 
                    padding: '4px 8px', 
                    color: m.color, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px' 
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{m.label}</span> (${m.price.toFixed(2)})
                  <button 
                    onClick={() => setMarkers(markers.filter(item => item.id !== m.id))} 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-muted)', 
                      cursor: 'pointer', 
                      fontSize: '14px', 
                      padding: 0,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Remove marker"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Zoom level badge + reset — replaces old zoom buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isZoomed && (
              <>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {Math.round((1 / zoomFactor) * 100)}% zoom
                </span>
                <button
                  onClick={() => setZoomFactor(1.0)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  Reset Zoom
                </button>
              </>
            )}
            {!isZoomed && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Scroll to zoom · Drag to pan
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      <div className="chart-container" style={{ 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: isMaximized ? '14px' : '16px', 
        padding: isMaximized ? '16px 24px 24px' : '16px 16px 32px', 
        flex: 'unset',
        flexShrink: 0,
        height: isMaximized ? `${650 + subPaneCount * 200}px` : 'auto'
      }}>
        {/* Floating Add Marker Form */}
        {showAddMarkerForm && (
          <div 
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(13, 16, 27, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              width: '240px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
              Add Reference Marker
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Label / Name</label>
              <input 
                type="text" 
                value={newMarkerLabel}
                onChange={(e) => setNewMarkerLabel(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '12px', outline: 'none' }}
                placeholder="e.g. Entry, TP 1, Stop Loss"
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Price Level ($)</label>
              <input 
                type="number" 
                value={newMarkerPrice}
                onChange={(e) => setNewMarkerPrice(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '12px', outline: 'none' }}
                placeholder="e.g. 60000"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Marker Color</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: '#10b981', label: 'Green' },
                  { value: '#ef4444', label: 'Red' },
                  { value: '#00f2fe', label: 'Cyan' },
                  { value: '#fb923c', label: 'Orange' },
                  { value: '#a154ff', label: 'Purple' }
                ].map((c) => (
                  <button 
                    key={c.value}
                    onClick={() => setNewMarkerColor(c.value)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: c.value,
                      border: newMarkerColor === c.value ? '2px solid #fff' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none'
                    }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button 
                onClick={() => {
                  if (!newMarkerPrice || isNaN(parseFloat(newMarkerPrice))) return;
                  const newMarker = {
                    id: Math.random().toString(),
                    price: parseFloat(newMarkerPrice),
                    label: newMarkerLabel,
                    color: newMarkerColor
                  };
                  setMarkers([...markers, newMarker]);
                  setShowAddMarkerForm(false);
                }}
                className="insight-btn"
                style={{ flex: 1, padding: '6px 12px', fontSize: '11px' }}
              >
                Save
              </button>
              <button 
                onClick={() => setShowAddMarkerForm(false)}
                className="control-toggle-btn"
                style={{ flex: 1, padding: '6px 12px', fontSize: '11px', border: '1px solid var(--border-glass)', borderRadius: '6px', cursor: 'pointer', background: 'none', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {processedData.length > 0 ? (
          <div
            ref={chartCanvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ 
              height: mainChartHeight,
              width: '100%',
              position: 'relative',
              cursor: isZoomed ? (isDragging.current ? 'grabbing' : 'grab') : 'crosshair',
              userSelect: 'none',
              touchAction: 'none'  // prevents browser pinch-zoom gesture on this element
            }}>

            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={visibleData} 
                margin={{ top: 10, right: 5, left: 20, bottom: 25 }}
              >
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
                  tickFormatter={(v: number) => {
                    if (!isFinite(v) || isNaN(v)) return '';
                    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
                    return v.toFixed(2);
                  }}
                />
                
                <Tooltip content={<CustomTooltip />} />

                {/* User Defined Markers / Reference Lines */}
                {markers.map((marker) => (
                  <ReferenceLine 
                    key={marker.id}
                    y={marker.price}
                    stroke={marker.color}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    label={{
                      value: `${marker.label} ($${marker.price.toFixed(2)})`,
                      fill: marker.color,
                      fontSize: 10,
                      position: 'insideBottomLeft'
                    }}
                  />
                ))}

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

                {/* Bollinger Bands Overlay (backend-computed via pandas-ta, aligned by ts) */}
                {showBB && (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="bb_upper" 
                      stroke="#a154ff" 
                      strokeWidth={1.2} 
                      strokeDasharray="3 3"
                      dot={false}
                      name="BB Upper"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="bb_middle" 
                      stroke="#f59e0b" 
                      strokeWidth={1.2} 
                      dot={false}
                      name="BB Middle"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="bb_lower" 
                      stroke="#a154ff" 
                      strokeWidth={1.2} 
                      strokeDasharray="3 3"
                      dot={false}
                      name="BB Lower"
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: '8px', padding: '20px', textAlign: 'center' }}>
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

        {/* Zoomed date range indicator (replaces PAN CHART slider) */}
        {processedData.length > 0 && isZoomed && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '6px', 
            padding: '4px 12px',
            fontSize: '10px',
            color: 'var(--text-muted)',
            fontFamily: 'monospace'
          }}>
            <span style={{ color: 'var(--neon-cyan)' }}>{visibleData[0]?.time}</span>
            <span>—</span>
            <span style={{ color: 'var(--neon-cyan)' }}>{visibleData[visibleData.length - 1]?.time}</span>
          </div>
        )}

        {/* Technical Indicator panel: RSI 14 (Auxiliary Chart below main price chart) */}
        {showRSI && visibleRsiData.length > 0 && (
          <div style={{ height: subPaneHeight, width: '100%', borderTop: '1px dashed var(--border-glass)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', paddingLeft: '10px' }}>
              <span style={{ fontWeight: 700, color: 'var(--neon-cyan)' }}>RSI (14)</span>
              <span style={{ color: 'var(--text-muted)' }}>Overbought &gt;70 | Oversold &lt;30</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visibleRsiData} margin={{ top: 5, right: 5, left: 20, bottom: 5 }}>
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

        {/* Technical Indicator panel: MACD (12, 26, 9) — separate pane below the price chart */}
        {showMACD && visibleMacdData.length > 0 && (
          <div className="chart-indicator-pane" style={{ height: subPaneHeight, width: '100%', borderTop: '1px dashed var(--border-glass)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', paddingLeft: '10px' }}>
              <span style={{ fontWeight: 700, color: 'var(--neon-violet)' }}>MACD (12, 26, 9)</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {indicatorLoading ? 'Loading…' : 'Line · Signal · Histogram'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visibleMacdData} margin={{ top: 5, right: 5, left: 20, bottom: 5 }}>
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#0d101b', 
                    borderColor: '#2e303a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />

                {/* Zero baseline */}
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />

                {/* Histogram (green above / red below the zero line) */}
                <Bar dataKey="macd_hist" name="MACD Histogram" maxBarSize={8} isAnimationActive={false}>
                  {visibleMacdData.map((entry, idx) => (
                    <Cell key={`hist-${idx}`} fill={(entry.macd_hist ?? 0) >= 0 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'} />
                  ))}
                </Bar>

                <Line 
                  type="monotone" 
                  dataKey="macd" 
                  stroke="var(--neon-cyan)" 
                  strokeWidth={1.5} 
                  dot={false}
                  name="MACD"
                />
                <Line 
                  type="monotone" 
                  dataKey="macd_signal" 
                  stroke="#fb923c" 
                  strokeWidth={1.5} 
                  dot={false}
                  name="Signal"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        </div> {/* closes chart-container */}
        </div> {/* closes Left Column */}

        {/* Right Column: AI Chatbot (Only rendered in maximized layout) */}
        {isMaximized && (
          <ChartChatbot 
            ticker={activeTicker}
            markers={markers}
            activeIndicators={{ sma: showSMA, ema: showEMA, rsi: showRSI, macd: showMACD, bb: showBB }}
            user={user}
            onOpenRecharge={onOpenRecharge}
            liveData={chatbotLiveData}
          />
        )}
      </div>
    </div>
  );
}
