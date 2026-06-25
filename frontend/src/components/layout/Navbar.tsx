import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Briefcase, IndianRupee, Settings, LogOut,
  Menu, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import ThemeToggle from '../ThemeToggle';

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className="glass-card navbar"
      style={{ padding: isMobile ? '10px 16px' : '12px 32px' }}
    >
      <div className="navbar-inner">
        <div className="nav-brand" onClick={() => navigate('/dashboard')}>
          <img
            src="/logo.png"
            alt="વડસક પરિવાર"
            className="logo-img"
            style={{ height: isMobile ? '40px' : '48px' }}
          />
        </div>

        {/* Desktop nav actions */}
        {!isMobile && (
          <div className="nav-actions">
            <ThemeToggle />

            <div className="user-pill">
              <div className="user-pill-avatar">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-pill-info">
                <span className="user-pill-name">{user?.username}</span>
                <span className={`badge ${isAdmin ? 'badge-primary' : 'badge-secondary'}`}>
                  {isAdmin ? 'એડમિન' : 'સભ્ય'}
                </span>
              </div>
            </div>

            {isAdmin && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/dashboard/admin')}
              >
                <Settings size={16} /> સેટિંગ્સ
              </button>
            )}

            <button
              className="btn btn-danger btn-sm"
              onClick={handleLogout}
            >
              <LogOut size={16} /> લોગઆઉટ
            </button>
          </div>
        )}

        {/* Mobile: menu toggle */}
        {isMobile && (
          <button
            className="btn-icon"
            onClick={onMenuToggle}
            style={{ width: '40px', height: '40px' }}
            aria-label="મેનુ ખોલો"
          >
            <Menu size={22} />
          </button>
        )}
      </div>
    </header>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  const currentPath = location.pathname + location.search;

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose} />
      <aside className="sidebar-drawer" role="navigation" aria-label="Main navigation">
        {/* Header */}
        <div className="sidebar-header">
          <img src="/logo.png" alt="Logo" className="logo-img" style={{ height: '36px' }} />
          <button className="btn-icon" onClick={onClose} aria-label="Close menu">
            <X size={22} />
          </button>
        </div>

        {/* Profile */}
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            {user?.username.charAt(0).toUpperCase()}
          </div>
          <span className="sidebar-username">{user?.username}</span>
          <span className={`badge ${isAdmin ? 'badge-primary' : 'badge-secondary'}`}>
            {isAdmin ? 'એડમિન' : 'સભ્ય'}
          </span>
        </div>

        {/* Menu */}
        <div className="sidebar-menu">
          <button
            className={`sidebar-menu-item ${currentPath === '/dashboard' ? 'active' : ''}`}
            onClick={() => handleNav('/dashboard')}
          >
            <Home size={20} />
            <span>મુખ્ય પોર્ટલ</span>
          </button>

          <button
            className={`sidebar-menu-item ${currentPath.startsWith('/dashboard/expenses') ? 'active' : ''}`}
            onClick={() => handleNav('/dashboard/expenses')}
          >
            <IndianRupee size={20} />
            <span>પારિવારિક ખર્ચ</span>
          </button>

          <button
            className={`sidebar-menu-item ${currentPath.startsWith('/dashboard/business') ? 'active' : ''}`}
            onClick={() => handleNav('/dashboard/business')}
          >
            <Briefcase size={20} />
            <span>ધંધાકીય ખાતાવહી</span>
          </button>

          <div className="sidebar-divider" />

          {/* Theme Toggle */}
          <div className="sidebar-theme-row">
            <span className="sidebar-theme-label">થીમ બદલો</span>
            <ThemeToggle />
          </div>

          {isAdmin && (
            <button
              className="sidebar-menu-item"
              onClick={() => handleNav('/dashboard/admin')}
            >
              <Settings size={20} />
              <span>એડમિન સેટિંગ્સ</span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          <div className="sidebar-divider" />

          <button className="sidebar-menu-item danger" onClick={handleLogout}>
            <LogOut size={20} />
            <span>લોગઆઉટ</span>
          </button>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.6 }}>
            © {new Date().getFullYear()} વડસક પરિવાર
          </p>
        </div>
      </aside>
    </>
  );
}
