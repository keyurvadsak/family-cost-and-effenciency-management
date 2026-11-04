import React, { useState } from 'react';
import Navbar, { Sidebar } from './Navbar';
import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar drawer (mobile) */}
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Top navbar */}
      <Navbar onMenuToggle={() => setIsMenuOpen(true)} />

      {/* Main content */}
      <main
        id="main-content"
        className="main-content"
        style={{
          padding: isMobile ? '8px 8px' : isTablet ? '16px 20px' : '24px 32px'
        }}
      >
        {children}
      </main>
    </div>
  );
}
