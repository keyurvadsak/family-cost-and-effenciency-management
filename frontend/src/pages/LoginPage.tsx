import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'વપરાશકર્તાનું નામ અથવા પાસવર્ડ ખોટો છે. કૃપા કરીને ફરી પ્રયાસ કરો.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '20px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 50 }}>
        <ThemeToggle />
      </div>

      {/* Animated mesh background */}
      <div className="login-mesh-bg">
        <div className="login-mesh-orb login-mesh-orb-1" />
        <div className="login-mesh-orb login-mesh-orb-2" />
        <div className="login-mesh-orb login-mesh-orb-3" />
      </div>

      {loading ? (
        <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
          <img src="/logo.png" alt="Loading" className="logo-img-large logo-loader" style={{ height: '140px' }} />
        </div>
      ) : (
        <div className="animate-scale-in login-card-wrapper">
          <div className="login-card-glow" />

          <div className="glass-card" style={{ width: '100%', padding: '36px 28px', position: 'relative' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <img src="/logo.png" alt="Logo" className="logo-img-large" style={{ height: '100px', marginBottom: '8px' }} />
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.02em' }}>વડસક પરિવાર</h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>પારિવારિક ખર્ચ અને ધંધાકીય સંચાલન</p>
            </div>

            {/* Error */}
            {error && (
              <div className="alert alert-error animate-fade-in" style={{ marginBottom: '20px', lineHeight: '1.4' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-username">
                  વપરાશકર્તાનું નામ (Username)
                </label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    id="login-username"
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
                <label className="form-label" htmlFor="login-password">
                  પાસવર્ડ (Password)
                </label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="login-password"
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
                style={{ width: '100%', marginTop: '8px', fontSize: '1rem', padding: '14px', gap: '10px' }}
                disabled={loading}
              >
                <span>સાઇન ઇન કરો</span>
                <ArrowRight size={18} />
              </button>
            </form>

            {/* Footer */}
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '24px', opacity: 0.6 }}>
              © {new Date().getFullYear()} વડસક પરિવાર · સુરક્ષિત લૉગિન
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
