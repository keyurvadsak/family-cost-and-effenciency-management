import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { authApi } from '../api';
import type { User } from '../api';
import { Home, Briefcase, Settings, LogOut, Menu, X, Shield, User as UserIcon } from 'lucide-react';

export default function DashboardLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const u = await authApi.getCurrentUser();
        setUser(u);
      } catch (err) {
        console.error("Unauthorized. Redirecting to login...", err);
        authApi.logout();
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading session...</p>
      </div>
    );
  }

  const navItems = [
    { name: 'Family Expenses', path: '/dashboard/home', icon: <Home size={20} /> },
    { name: 'Business Ledger', path: '/dashboard/business', icon: <Briefcase size={20} /> },
  ];

  if (user?.role === 'admin') {
    navItems.push({ name: 'Admin Dashboard', path: '/dashboard/admin', icon: <Settings size={20} /> });
  }

  const activeItem = navItems.find(item => location.pathname === item.path) || navItems[0];

  return (
    <div style={styles.wrapper}>
      {/* Mobile Header */}
      <header style={styles.mobileHeader}>
        <button style={styles.menuToggle} onClick={() => setMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
        <span style={styles.mobileLogo}>Joint Family Ledger</span>
        <div style={styles.mobileUserBadge}>
          {user?.role === 'admin' ? <Shield size={16} color="#8b5cf6" /> : <UserIcon size={16} color="#06b6d4" />}
        </div>
      </header>

      {/* Sidebar Drawer on Mobile / Standard Sidebar on Desktop */}
      <aside 
        className="glass-card" 
        style={{
          ...styles.sidebar,
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-105%)',
          '@media (min-width: 769px)': {
            transform: 'translateX(0)'
          }
        } as any}
      >
        <div style={styles.sidebarHeader}>
          <div style={styles.logoBadge}>JF</div>
          <span style={styles.logoText}>Family Ledger</span>
          <button style={styles.closeMenuBtn} onClick={() => setMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav style={styles.navMenu}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.navBtn,
                  background: isActive ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                  color: isActive ? 'var(--primary-hover)' : 'var(--text-muted)',
                  borderColor: isActive ? 'var(--primary)' : 'transparent',
                }}
              >
                {item.icon}
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.profileBox}>
            <div style={styles.avatar}>
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div style={styles.profileInfo}>
              <span style={styles.profileName}>{user?.username}</span>
              <span style={styles.profileRole}>
                {user?.role === 'admin' ? 'Administrator' : 'Family Member'}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn} className="btn btn-secondary">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div style={styles.backdrop} onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Main Content Pane */}
      <main style={styles.contentPane}>
        {/* Top Navbar for Desktop */}
        <header style={styles.desktopNavbar}>
          <div>
            <h2 style={styles.pageTitle}>{activeItem?.name}</h2>
            <p style={styles.pageDesc}>Joint Family Expense & Business Ledgers</p>
          </div>
          <div style={styles.rightNav}>
            <div style={styles.roleTag}>
              {user?.role === 'admin' ? (
                <span className="badge badge-primary" style={{ gap: '4px' }}>
                  <Shield size={12} /> Admin
                </span>
              ) : (
                <span className="badge badge-secondary" style={{ gap: '4px' }}>
                  <UserIcon size={12} /> Member
                </span>
              )}
            </div>
            <div style={styles.userDisplay}>
              <span>Welcome, <strong>{user?.username}</strong></span>
            </div>
          </div>
        </header>

        <div style={styles.mainInner}>
          <Outlet context={{ user }} />
        </div>
      </main>
      
      {/* Global CSS Inject to resolve media queries */}
      <style>{`
        @media (min-width: 769px) {
          aside {
            transform: translateX(0) !important;
          }
          header[style*="mobileHeader"] {
            display: none !important;
          }
          button[style*="closeMenuBtn"] {
            display: none !important;
          }
          main {
            margin-left: 280px !important;
            width: calc(100% - 280px) !important;
            padding-top: 0 !important;
          }
        }
        @media (max-width: 768px) {
          header[style*="desktopNavbar"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw',
    position: 'relative',
  },
  loadingContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid var(--border-glass)',
    borderTopColor: 'var(--primary)',
    animation: 'spin 1s linear infinite',
  },
  mobileHeader: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'rgba(11, 12, 21, 0.85)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid var(--border-glass)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    zIndex: 99,
  },
  menuToggle: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    cursor: 'pointer',
  },
  mobileLogo: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 700,
    fontSize: '1.2rem',
  },
  mobileUserBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    width: '280px',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    borderLeft: 'none',
    borderTop: 'none',
    borderBottom: 'none',
    borderRadius: '0 var(--radius-lg) var(--radius-lg) 0',
    padding: '30px 20px',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '40px',
  },
  logoBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontFamily: 'var(--font-heading)',
    fontSize: '1.2rem',
  },
  logoText: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 700,
    fontSize: '1.25rem',
    flex: 1,
  },
  closeMenuBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  navMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid transparent',
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'var(--transition-smooth)',
  },
  sidebarFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    borderTop: '1px solid var(--border-glass)',
    paddingTop: '20px',
  },
  profileBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.2)',
    border: '1px solid var(--border-glass-active)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    color: 'var(--primary-hover)',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  profileName: {
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  profileRole: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  logoutBtn: {
    justifyContent: 'center',
    padding: '10px',
    width: '100%',
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 98,
  },
  contentPane: {
    width: '100%',
    paddingTop: '64px', // mobile header height
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  desktopNavbar: {
    height: '90px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 40px',
    borderBottom: '1px solid var(--border-glass)',
  },
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 700,
  },
  pageDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  rightNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  roleTag: {
    display: 'flex',
  },
  userDisplay: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
  },
  mainInner: {
    flex: 1,
    padding: '30px 40px',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
  },
};
