import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { KeyRound, User, Lock, AlertCircle } from 'lucide-react';
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
      {/* Decorative Blur Orbs */}
      <div style={styles.orb1}></div>
      <div style={styles.orb2}></div>

      <div className="glass-card animate-fade-in" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoIcon}>
            <KeyRound size={28} color="#8b5cf6" />
          </div>
          <h1 style={styles.title}>વડસક પરિવાર</h1>
          <p style={styles.subtitle}>પરિવારના ખર્ચ અને ધંધાકીય માહિતીનું વ્યવસ્થાપન</p>
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
              વપરાશકર્તાનું નામ (Username)
            </label>
            <div style={styles.inputWrapper}>
              <User size={18} style={styles.inputIcon} />
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="નામ લખો"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
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
                className="input-field"
                placeholder="પાસવર્ડ લખો"
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
            {loading ? 'લોગિન થઈ રહ્યું છે...' : 'સાઇન ઇન કરો'}
          </button>
        </form>


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
    fontSize: '1.8rem',
    color: 'var(--text-main)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
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

};
