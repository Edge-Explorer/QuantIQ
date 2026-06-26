
import { Wallet, LogOut } from 'lucide-react';
import Logo from './Logo';

interface NavbarProps {
  user: any;
  onRechargeClick: () => void;
  onLogout: () => void;
  onLogoClick?: () => void;
}

export default function Navbar({ user, onRechargeClick, onLogout, onLogoClick }: NavbarProps) {
  return (
    <header className="dashboard-header">
      <div 
        className={`header-left ${onLogoClick ? 'cursor-pointer hover:opacity-85 active:scale-[0.98]' : ''} transition-all`}
        onClick={onLogoClick}
      >
        <Logo size={32} />
        <span className="logo-text">QuantIQ</span>
      </div>
      
      <div className="header-right">
        {user && (
          <div className="credits-badge">
            <Wallet size={16} />
            <span>{user.credits} Credits</span>
            <button className="recharge-btn" onClick={onRechargeClick}>
              RECHARGE
            </button>
          </div>
        )}

        <div className="user-profile">
          {user?.pictureUrl && (
            <img src={user.pictureUrl} alt="Avatar" className="avatar" />
          )}
          <span className="profile-name">{user?.fullName || 'User'}</span>
        </div>

        <button className="logout-btn" onClick={onLogout} title="Log Out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
