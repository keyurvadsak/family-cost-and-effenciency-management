import React from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface ModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ show, onClose, title, children, maxWidth = '500px' }: ModalProps) {
  const isMobile = useIsMobile();

  if (!show) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="glass-card modal-card modal-card-sheet animate-slide-up"
        style={{
          width: isMobile ? '100%' : '90%',
          maxWidth,
          padding: isMobile ? '20px 16px 32px' : '28px',
        }}
      >
        <div className="modal-header">
          <h3 id="modal-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal" style={{ flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
