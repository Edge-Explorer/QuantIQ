import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface IndexItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

interface TickerTapeProps {
  indices: IndexItem[];
}

export default function TickerTape({ indices }: TickerTapeProps) {
  if (!indices || indices.length === 0) return null;

  const renderSet = (key: string) => (
    <div className="ticker-tape-set" key={key}>
      {indices.map((index, i) => {
        const isPositive = index.changePercent >= 0;
        return (
          <div className="ticker-tape-item" key={`${index.symbol}-${i}`}>
            <span className="ticker-tape-name">{index.name}</span>
            <span className="ticker-tape-price">${index.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className={`ticker-tape-change ${isPositive ? 'text-bull' : 'text-bear'}`}>
              {isPositive ? <ArrowUpRight size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} /> : <ArrowDownRight size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />}
              {isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="ticker-tape">
      <div className="ticker-tape-label">
        <Activity size={12} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
        <span>MARKETS</span>
      </div>
      <div className="ticker-tape-wrapper">
        <div className="ticker-tape-track">
          {renderSet('set-1')}
          {renderSet('set-2')}
        </div>
      </div>
    </div>
  );
}
