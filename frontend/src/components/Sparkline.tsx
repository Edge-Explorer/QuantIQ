import { useMemo } from 'react';

interface SparklineProps {
  symbol: string;
  change: number;
  width?: number;
  height?: number;
}

export default function Sparkline({ symbol, change, width = 60, height = 24 }: SparklineProps) {
  const points = useMemo(() => {
    // Simple deterministic hash based on symbol name
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }

    const count = 10;
    const result: number[] = [];
    
    // Start at a baseline
    let val = 50;
    result.push(val);

    // Generate random walk that ends up/down based on change sign
    const stepDirection = change >= 0 ? 1 : -1;
    const targetDiff = Math.min(15, Math.max(5, Math.abs(change) * 2)) * stepDirection;
    
    for (let i = 1; i < count; i++) {
      // Calculate a trend force to push towards the target diff at the end
      const progress = i / (count - 1);
      const trend = targetDiff * progress;
      
      // Deterministic noise using hash and loop index
      const noiseSeed = Math.sin(hash + i) * 10000;
      const noise = (noiseSeed - Math.floor(noiseSeed)) * 12 - 6; // range -6 to 6
      
      // Mix baseline, trend, and noise
      const pointVal = 50 + trend + noise;
      result.push(pointVal);
    }
    
    return result;
  }, [symbol, change]);

  // Find min/max to normalize coordinates within SVG height
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Map points to SVG coordinates
  const padding = 2;
  const usableHeight = height - padding * 2;
  const usableWidth = width - padding * 2;

  const svgPoints = points.map((val, index) => {
    const x = padding + (index / (points.length - 1)) * usableWidth;
    // Invert Y because SVG coordinates start at top-left
    const y = padding + usableHeight - ((val - min) / range) * usableHeight;
    return { x, y };
  });

  // Construct path string for the line
  const linePath = svgPoints.reduce((acc, p, index) => {
    return acc + (index === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
  }, '');

  // Construct path string for the filled area (goes to bottom corners)
  const areaPath = `${linePath} L ${svgPoints[svgPoints.length - 1].x} ${height} L ${svgPoints[0].x} ${height} Z`;

  const isBull = change >= 0;
  const strokeColor = isBull ? '#10b981' : '#ef4444';
  const gradId = `spark-grad-${symbol.replace(/[^a-zA-Z0-9]/g, '-')}`;

  const lastPoint = svgPoints[svgPoints.length - 1];

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      
      {/* Area under the line */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      
      {/* Sparkline path */}
      <path 
        d={linePath} 
        fill="none" 
        stroke={strokeColor} 
        strokeWidth={1.5} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Glowing end dot */}
      {lastPoint && (
        <circle 
          cx={lastPoint.x} 
          cy={lastPoint.y} 
          r={2} 
          fill={strokeColor} 
          style={{ filter: `drop-shadow(0 0 3px ${strokeColor})` }}
        />
      )}
    </svg>
  );
}
