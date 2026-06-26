
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface ChartDataPoint {
  time: string;
  price: number;
}

interface StockChartProps {
  activeTicker: string;
  chartData: ChartDataPoint[];
}

export default function StockChart({ activeTicker, chartData }: StockChartProps) {
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : null;

  return (
    <div className="glass-panel chart-panel">
      <div className="chart-header">
        <div>
          <h2>{activeTicker}</h2>
          <div className="active-stock-info">
            <span className="active-price">
              {currentPrice !== null ? `$${currentPrice}` : 'Loading...'}
            </span>
            <div className="live-indicator">
              <span className="live-dot"></span>
              <span>Live</span>
            </div>
          </div>
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
