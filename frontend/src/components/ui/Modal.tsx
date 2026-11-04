import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // Prevent background scrolling while modal is open and handle Escape key
  useEffect(() => {
    if (!show) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, onClose]);

  if (!show) return null;

  const modalContent = (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="glass-card modal-card modal-card-sheet"
        style={{
          width: isMobile ? '100%' : '92%',
          maxWidth,
          padding: isMobile ? '14px 12px 18px' : '26px 28px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ alignItems: 'flex-start', gap: '8px' }}>
          <h3 id="modal-title" style={{ fontSize: isMobile ? '0.96rem' : '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', lineHeight: 1.3 }}>
            {title}
          </h3>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close modal"
            style={{ flexShrink: 0, color: 'var(--text-muted)', padding: '2px' }}
          >
            <X size={isMobile ? 18 : 20} />
          </button>
        </div>
        <div className="modal-body" style={{ marginTop: '8px' }}>
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
