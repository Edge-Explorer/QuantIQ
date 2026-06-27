import { useRef, useState } from 'react';
import { Wallet, LogOut, Loader2, Camera } from 'lucide-react';
import Logo from './Logo';

interface NavbarProps {
  user: any;
  onRechargeClick: () => void;
  onLogout: () => void;
  onLogoClick?: () => void;
  onAvatarUpload?: (newUrl: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Navbar({ user, onRechargeClick, onLogout, onLogoClick, onAvatarUpload }: NavbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarClick = () => {
    if (fileInputRef.current && !uploading) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('quantiq_jwt');

    try {
      const response = await fetch(`${API_URL}/api/v1/users/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      if (data.picture_url && onAvatarUpload) {
        onAvatarUpload(data.picture_url);
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
          <div 
            className="avatar-upload-wrapper"
            onClick={handleAvatarClick}
            title="Click to upload custom avatar"
          >
            {user?.pictureUrl ? (
              <img src={user.pictureUrl} alt="Avatar" className="avatar" />
            ) : (
              <Camera size={14} style={{ color: 'var(--neon-cyan)' }} />
            )}
            
            <div className="avatar-hover-overlay">
              <Camera size={12} style={{ color: '#fff' }} />
            </div>

            {uploading && (
              <div className="avatar-upload-loading">
                <Loader2 size={12} className="animate-spin" style={{ color: 'var(--neon-cyan)' }} />
              </div>
            )}
          </div>
          <span className="profile-name">{user?.fullName || 'User'}</span>
        </div>

        <button className="logout-btn" onClick={onLogout} title="Log Out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
