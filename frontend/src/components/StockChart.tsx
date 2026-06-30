
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface ChartDataPoint {
  time: string;
  price: number;
}

interface StockChartProps {
  activeTicker: string;
  chartData: ChartDataPoint[];
  chartRange: string;
  onRangeChange: (range: string) => void;
}

export default function StockChart({ activeTicker, chartData, chartRange, onRangeChange }: StockChartProps) {
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : null;

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
  );
}
