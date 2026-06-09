import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { familyApi, authApi } from '../api';
import type { FamilyMember } from '../api';
import { Plus, Trash2, UserPlus, Users, ShieldAlert, Sparkles, Shield, ArrowLeft } from 'lucide-react';

export default function AdminPage() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  
  // Register User form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const list = await familyApi.list();
      setMembers(list);
    } catch (err) {
      console.error(err);
      setError('પરિવારના મોભીઓની યાદી મેળવવામાં નિષ્ફળતા મળી.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const created = await familyApi.create(newMemberName.trim());
      setMembers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSuccessMsg(`પરિવારના મોભી "${created.name}" સફળતાપૂર્વક ઉમેરવામાં આવ્યા છે!`);
      setNewMemberName('');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'પરિવારના મોભી ઉમેરવામાં ભૂલ આવી છે.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMember = async (id: number, name: string) => {
    if (!window.confirm(`શું તમે ખરેખર પરિવારના મોભી "${name}" ને કાઢી નાખવા માંગો છો? આનાથી તેમના સંકળાયેલા તમામ માસિક ખર્ચાઓ પણ કાયમ માટે કાઢી નાખવામાં આવશે.`)) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await familyApi.delete(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setSuccessMsg(`પરિવારના મોભી "${name}" ને સફળતાપૂર્વક કાઢી નાખવામાં આવ્યા છે.`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'પરિવારના મોભીને કાઢી નાખવામાં ભૂલ આવી છે.');
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      await authApi.register(username.trim(), password.trim(), role);
      setSuccessMsg(`નવું લોગિન એકાઉન્ટ "${username}" સફળતાપૂર્વક ${role === 'admin' ? 'એડમિન' : 'સભ્ય'} પરવાનગી સાથે રજીસ્ટર કરવામાં આવ્યું છે.`);
      setUsername('');
      setPassword('');
      setRole('member');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'નવું લોગિન એકાઉન્ટ રજીસ્ટર કરવામાં ભૂલ આવી છે.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.spinnerWrapper}>
        <div className="spinner" style={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="animate-fade-in">
      <button className="back-navigation-btn" onClick={() => navigate('/dashboard')} style={{ marginBottom: '20px' }}>
        <ArrowLeft size={16} />
        <span>પોર્ટલ પર પાછા જાઓ</span>
      </button>
      {/* Welcome Alerts */}
      {successMsg && (
        <div className="glass-card" style={styles.alertSuccess}>
          <Sparkles size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="glass-card" style={styles.alertError}>
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ ...styles.dashboardGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))' }}>
        {/* Left Side: Family Head Registration */}
        <div className="glass-card" style={{ ...styles.panelCard, padding: isMobile ? '16px' : '30px' }}>
          <div style={styles.panelHeader}>
            <Users size={20} color="var(--primary)" />
            <h3 style={styles.panelTitle}>પરિવારના મોભી સભ્યોનું સંચાલન</h3>
          </div>
          
          <form onSubmit={handleAddMember} style={styles.innerForm}>
            <div className="form-group">
              <label className="form-label">નવા મોભી સભ્યનું નામ ઉમેરો</label>
              <div style={styles.inputRow}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="દા.ત. જયેશભાઈ"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  <Plus size={16} /> ઉમેરો
                </button>
              </div>
            </div>
          </form>

          {/* Members list */}
          <div style={styles.listWrapper}>
            <span style={styles.listTitle}>નોંધાયેલા પરિવારના મોભી સભ્યો</span>
            {members.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>હજુ સુધી કોઈ પરિવારના મોભી ઉમેરવામાં આવ્યા નથી.</p>
            ) : (
              <div style={styles.membersList}>
                {members.map((m) => (
                  <div key={m.id} style={styles.memberRow}>
                    <span style={styles.memberName}>{m.name}</span>
                    <button
                      className="btn-icon"
                      style={{ color: 'var(--error)' }}
                      onClick={() => handleDeleteMember(m.id, m.name)}
                      title="પરિવારના મોભીને દૂર કરો"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Account Registration */}
        <div className="glass-card" style={{ ...styles.panelCard, padding: isMobile ? '16px' : '30px' }}>
          <div style={styles.panelHeader}>
            <UserPlus size={20} color="var(--secondary)" />
            <h3 style={styles.panelTitle}>નવા લોગિન એકાઉન્ટ રજીસ્ટર કરો</h3>
          </div>

          <form onSubmit={handleRegisterUser} style={styles.innerForm}>
            <div className="form-group">
              <label className="form-label">વપરાશકર્તાનું નામ (Username)</label>
              <input
                type="text"
                className="input-field"
                placeholder="વપરાશકર્તાનું નામ લખો"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">પાસવર્ડ (Password)</label>
              <input
                type="password"
                className="input-field"
                placeholder="પાસવર્ડ લખો"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">એકાઉન્ટનો રોલ (પરવાનગી)</label>
              <select
                className="input-field"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                <option value="member">પરિવારના સભ્ય (વાંચવા અને ડેટા નોંધવા માટે)</option>
                <option value="admin">એડમિન (સંપૂર્ણ નિયંત્રણ + સેટિંગ્સ એક્સેસ)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={actionLoading}>
              <Shield size={16} /> લોગિન વિગતો રજીસ્ટર કરો
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  spinnerWrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: '80px 0',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid var(--border-glass)',
    borderTopColor: 'var(--primary)',
    animation: 'spin 1s linear infinite',
  },
  alertSuccess: {
    padding: '12px 18px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#6ee7b7',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
  },
  alertError: {
    padding: '12px 18px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  },
  panelCard: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '12px',
  },
  panelTitle: {
    fontSize: '1.2rem',
  },
  innerForm: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputRow: {
    display: 'flex',
    gap: '10px',
  },
  listWrapper: {
    marginTop: '24px',
    borderTop: '1px solid var(--border-glass)',
    paddingTop: '20px',
  },
  listTitle: {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 600,
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '12px',
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  memberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-glass)',
    borderRadius: 'var(--radius-sm)',
  },
  memberName: {
    fontSize: '0.95rem',
  },
};
