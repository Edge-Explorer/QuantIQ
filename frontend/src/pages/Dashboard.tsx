
import Navbar from '../components/Navbar';
import WatchlistSidebar from '../components/WatchlistSidebar';
import StockChart from '../components/StockChart';
import AIAnalyst from '../components/AIAnalyst';
import PriceAlerts from '../components/PriceAlerts';
import RechargeModal from '../components/RechargeModal';
import TickerTape from '../components/TickerTape';

interface DashboardProps {
  user: any;
  watchlist: string[];
  watchlistQuotes: Record<string, { price: number; changePercent: number }>;
  activeTicker: string;
  chartData: any[];
  activeStats: any;
  alerts: any[];
  insight: any;
  savedStrategies: any[];
  loadingInsight: boolean;
  insightError: string | null;
  showRecharge: boolean;
  chartRange: string;
  onRangeChange: (range: string) => void;
  onSelectTicker: (ticker: string) => void;
  onAddTicker: (ticker: string) => Promise<void>;
  onRemoveTicker: (ticker: string) => Promise<void>;
  onCreateAlert: (targetPrice: number, condition: string) => Promise<void>;
  onDeactivateAlert: (alertId: string) => Promise<void>;
  onTriggerInsight: () => void;
  onCloseRecharge: () => void;
  onOpenRecharge: () => void;
  onSelectPackage: (amountInRupees: number) => Promise<void>;
  onLogout: () => void;
  onLogoClick?: () => void;
  onAvatarUpload?: (newUrl: string) => void;
  indices: any[];
}

export default function Dashboard({
  user,
  watchlist,
  watchlistQuotes,
  activeTicker,
  chartData,
  activeStats,
  alerts,
  insight,
  savedStrategies,
  loadingInsight,
  insightError,
  showRecharge,
  chartRange,
  onRangeChange,
  onSelectTicker,
  onAddTicker,
  onRemoveTicker,
  onCreateAlert,
  onDeactivateAlert,
  onTriggerInsight,
  onCloseRecharge,
  onOpenRecharge,
  onSelectPackage,
  onLogout,
  onLogoClick,
  onAvatarUpload,
  indices,
}: DashboardProps) {
  return (
    <div className="app-container animate-fade">
      {/* Header / Navigation */}
      <Navbar 
        user={user} 
        onRechargeClick={onOpenRecharge} 
        onLogout={onLogout} 
        onLogoClick={onLogoClick}
        onAvatarUpload={onAvatarUpload}
      />

      {/* Scrolling Index Ticker Tape */}
      <TickerTape indices={indices} />

      {/* Main Grid Content */}
      <main className="dashboard-grid">
        
        {/* Left Sidebar: Watchlist */}
        <WatchlistSidebar
          watchlist={watchlist}
          watchlistQuotes={watchlistQuotes}
          activeTicker={activeTicker}
          onSelectTicker={onSelectTicker}
          onAddTicker={onAddTicker}
          onRemoveTicker={onRemoveTicker}
        />

        {/* Center Section: Live Chart & AI analyst */}
        <section className="center-content">
          <StockChart 
            activeTicker={activeTicker} 
            chartData={chartData} 
            activeStats={activeStats}
            chartRange={chartRange}
            onRangeChange={onRangeChange}
          />
          <AIAnalyst
            activeTicker={activeTicker}
            insight={insight}
            savedStrategies={savedStrategies}
            loadingInsight={loadingInsight}
            insightError={insightError}
            onTriggerInsight={onTriggerInsight}
          />
        </section>

        {/* Right Sidebar: Alerts Panel */}
        <section className="right-sidebar">
          <PriceAlerts
            activeTicker={activeTicker}
            alerts={alerts}
            onCreateAlert={onCreateAlert}
            onDeactivateAlert={onDeactivateAlert}
          />
        </section>
      </main>

      {/* Recharge Modal */}
      {showRecharge && (
        <RechargeModal 
          onClose={onCloseRecharge} 
          onSelectPackage={onSelectPackage} 
        />
      )}
    </div>
  );
}
