import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { User, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

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
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'વપરાશકર્તાનું નામ અથવા પાસવર્ડ ખોટો છે. કૃપા કરીને ફરી પ્રયાસ કરો.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <ThemeToggle />

      {/* Animated mesh background */}
      <div style={styles.meshBg}>
        <div style={styles.meshOrb1} />
        <div style={styles.meshOrb2} />
        <div style={styles.meshOrb3} />
      </div>

      {loading ? (
        <div className="animate-fade-in" style={styles.loadingWrap}>
          <img src="/logo.png" alt="Loading" className="logo-img-large logo-loader" style={{ height: '140px' }} />
        </div>
      ) : (
        <div className="animate-scale-in" style={styles.cardWrapper}>
          {/* Animated border glow */}
          <div style={styles.cardGlow} />

          <div className="glass-card" style={styles.card}>
            {/* Header */}
            <div style={styles.header}>
              <img src="/logo.png" alt="Logo" className="logo-img-large" style={{ height: '100px', marginBottom: '8px' }} />
              <h1 style={styles.title}>વડસક પરિવાર</h1>
              <p style={styles.subtitle}>પારિવારિક ખર્ચ અને ધંધાકીય સંચાલન</p>
            </div>

            {/* Error */}
            {error && (
              <div style={styles.errorAlert} className="animate-fade-in">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} style={styles.form}>
              <div className="form-group">
                <label className="form-label" htmlFor="username">
                  વપરાશકર્તાનું નામ (Username)
                </label>
                <div style={styles.inputWrapper}>
                  <User size={18} style={styles.inputIcon} />
                  <input
                    id="username"
                    type="text"
                    className="input-field input-with-icon"
                    placeholder="નામ લખો"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  પાસવર્ડ (Password)
                </label>
                <div style={styles.inputWrapper}>
                  <Lock size={18} style={styles.inputIcon} />
                  <input
                    id="password"
                    type="password"
                    className="input-field input-with-icon"
                    placeholder="પાસવર્ડ લખો"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={styles.submitBtn}
                disabled={loading}
              >
                <span>સાઇન ઇન કરો</span>
                <ArrowRight size={18} />
              </button>
            </form>

            {/* Footer */}
            <p style={styles.footer}>
              © {new Date().getFullYear()} વડસક પરિવાર · સુરક્ષિત લૉગિન
            </p>
          </div>
        </div>
      )}
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

  /* Mesh background */
  meshBg: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
  meshOrb1: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(212, 168, 83, 0.12) 0%, transparent 70%)',
    top: '-10%',
    left: '-5%',
    animation: 'float 8s ease-in-out infinite',
  },
  meshOrb2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(96, 165, 250, 0.08) 0%, transparent 70%)',
    bottom: '-15%',
    right: '-10%',
    animation: 'float 10s ease-in-out infinite',
    animationDelay: '-3s',
  },
  meshOrb3: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(167, 139, 250, 0.06) 0%, transparent 70%)',
    top: '50%',
    left: '60%',
    transform: 'translate(-50%, -50%)',
    animation: 'float 12s ease-in-out infinite',
    animationDelay: '-6s',
  },

  loadingWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },

  cardWrapper: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
  },

  cardGlow: {
    position: 'absolute',
    inset: '-1px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.3), transparent 40%, transparent 60%, rgba(96, 165, 250, 0.2))',
    zIndex: -1,
    opacity: 0.6,
  },

  card: {
    width: '100%',
    padding: '36px 28px',
    position: 'relative',
  },

  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },

  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    marginBottom: '6px',
    letterSpacing: '-0.02em',
  },

  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },

  errorAlert: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--error-muted)',
    border: '1px solid rgba(248, 113, 113, 0.2)',
    color: 'var(--error)',
    fontSize: '0.85rem',
    marginBottom: '20px',
    lineHeight: '1.4',
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
    pointerEvents: 'none',
  },

  submitBtn: {
    width: '100%',
    marginTop: '8px',
    fontSize: '1rem',
    padding: '14px',
    gap: '10px',
  },

  footer: {
    textAlign: 'center',
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '24px',
    opacity: 0.6,
  },
};
