
import Navbar from '../components/Navbar';
import WatchlistSidebar from '../components/WatchlistSidebar';
import StockChart from '../components/StockChart';
import AIAnalyst from '../components/AIAnalyst';
import PriceAlerts from '../components/PriceAlerts';
import RechargeModal from '../components/RechargeModal';

interface DashboardProps {
  user: any;
  watchlist: string[];
  activeTicker: string;
  chartData: any[];
  alerts: any[];
  insight: any;
  loadingInsight: boolean;
  insightError: string | null;
  showRecharge: boolean;
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
}

export default function Dashboard({
  user,
  watchlist,
  activeTicker,
  chartData,
  alerts,
  insight,
  loadingInsight,
  insightError,
  showRecharge,
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

      {/* Main Grid Content */}
      <main className="dashboard-grid">
        
        {/* Left Sidebar: Watchlist */}
        <WatchlistSidebar
          watchlist={watchlist}
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
          />
          <AIAnalyst
            activeTicker={activeTicker}
            insight={insight}
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
