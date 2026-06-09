import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { KeyRound, User, Lock, AlertCircle, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.login(username, password);
      navigate('/dashboard/home');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const useQuickCredentials = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div style={styles.container}>
      {/* Decorative Blur Orbs */}
      <div style={styles.orb1}></div>
      <div style={styles.orb2}></div>

      <div className="glass-card animate-fade-in" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoIcon}>
            <KeyRound size={28} color="#8b5cf6" />
          </div>
          <h1 style={styles.title}>Joint Family Ledger</h1>
          <p style={styles.subtitle}>Family Expense & Business Data Manager</p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username
            </label>
            <div style={styles.inputWrapper}>
              <User size={18} style={styles.inputIcon} />
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Credentials Quick-click */}
        <div style={styles.demoBox}>
          <div style={styles.demoHeader}>
            <ShieldAlert size={14} color="#06b6d4" />
            <span style={styles.demoTitle}>Demo Accounts</span>
          </div>
          <div style={styles.demoButtons}>
            <button
              onClick={() => useQuickCredentials('admin', 'admin123')}
              style={styles.demoBtn}
              type="button"
            >
              <span>Admin Account</span>
              <small>admin / admin123</small>
            </button>
            <button
              onClick={() => useQuickCredentials('member', 'member123')}
              style={styles.demoBtn}
              type="button"
            >
              <span>Member Account</span>
              <small>member / member123</small>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '20px',
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    width: '350px',
    height: '350px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.2)',
    filter: 'blur(80px)',
    top: '20%',
    left: '25%',
    transform: 'translate(-50%, -50%)',
    zIndex: 0,
  },
  orb2: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'rgba(6, 182, 212, 0.15)',
    filter: 'blur(80px)',
    bottom: '20%',
    right: '25%',
    transform: 'translate(50%, 50%)',
    zIndex: 0,
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px 32px',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
  },
  title: {
    fontSize: '2rem',
    color: 'var(--text-main)',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    fontSize: '0.85rem',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-muted)',
  },
  input: {
    width: '100%',
    paddingLeft: '44px',
  },
  submitBtn: {
    width: '100%',
    marginTop: '10px',
    fontSize: '1rem',
    padding: '14px',
  },
  demoBox: {
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid var(--border-glass)',
  },
  demoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '10px',
  },
  demoTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  demoButtons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  demoBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-glass)',
    cursor: 'pointer',
    color: 'var(--text-main)',
    textAlign: 'left',
    transition: 'var(--transition-smooth)',
  },
};
// Hover handler style changes can be driven by CSS or global class.
// We inline standard flex elements.
