
import { X } from 'lucide-react';

interface RechargeModalProps {
  onClose: () => void;
  onSelectPackage: (amountInRupees: number) => Promise<void>;
}

export default function RechargeModal({ onClose, onSelectPackage }: RechargeModalProps) {
  return (
    <div className="modal-overlay animate-fade">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h2>Select Credits Package</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        
        <div className="recharge-packages">
          <div className="package-card" onClick={() => onSelectPackage(10)}>
            <span className="package-credits">10 Credits</span>
            <span className="package-price">₹10.00</span>
          </div>
          <div className="package-card" onClick={() => onSelectPackage(50)}>
            <span className="package-credits">50 Credits</span>
            <span className="package-price">₹50.00</span>
          </div>
          <div className="package-card" onClick={() => onSelectPackage(100)}>
            <span className="package-credits">100 Credits</span>
            <span className="package-price">₹100.00</span>
          </div>
        </div>
        
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Test Mode active. Pay using Razorpay Test UPI / Cards.
        </p>
      </div>
    </div>
  );
}
