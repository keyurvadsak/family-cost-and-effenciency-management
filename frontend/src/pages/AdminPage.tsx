import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { familyApi, authApi, businessApi } from '../api';
import type { FamilyMember, Business, User } from '../api';
import { Plus, Trash2, UserPlus, Users, ShieldAlert, Sparkles, Shield, ArrowLeft, Briefcase, ChevronDown, ChevronUp, Check } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

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
  const [newMemberManagerIds, setNewMemberManagerIds] = useState<number[]>([]);
  
  // Register User form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  // Business Manager state
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Collapsible sections for mobile
  const [openSection, setOpenSection] = useState<'members' | 'accounts' | 'managers' | null>('members');

  // Auto-dismiss success
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const loadData = async () => {
    try {
      const [list, bizList, userList] = await Promise.all([
        familyApi.list(),
        businessApi.list(),
        authApi.getUsers()
      ]);
      setMembers(list);
      setBusinesses(bizList);
      setUsers(userList);
    } catch (err) {
      console.error(err);
      setError('ડેટા મેળવવામાં નિષ્ફળતા મળી.');
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
      const created = await familyApi.create(newMemberName.trim(), newMemberManagerIds);
      setMembers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSuccessMsg(`પરિવારના મોભી "${created.name}" સફળતાપૂર્વક ઉમેરવામાં આવ્યા છે!`);
      setNewMemberName('');
      setNewMemberManagerIds([]);
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
      setSuccessMsg(`નવું એકાઉન્ટ "${username}" ${role === 'admin' ? 'એડમિન' : 'સભ્ય'} પરવાનગી સાથે રજીસ્ટર થયું.`);
      setUsername('');
      setPassword('');
      setRole('member');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'એકાઉન્ટ રજીસ્ટર કરવામાં ભૂલ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManagerChange = async (bizId: number, val: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const managerId = val ? parseInt(val) : null;
      await businessApi.updateManager(bizId, managerId);
      setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, manager_id: managerId } : b));
      setSuccessMsg('સંચાલક અપડેટ થયા.');
    } catch (err: any) {
      console.error(err);
      setError('સંચાલક અપડેટ ભૂલ.');
    }
  };

  const toggleFamilyAccess = async (member: FamilyMember, userId: number) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const currentIds = member.allowed_user_ids || [];
      const newIds = currentIds.includes(userId) 
        ? currentIds.filter(id => id !== userId) 
        : [...currentIds, userId];
      await familyApi.updateAccess(member.id, newIds);
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, allowed_user_ids: newIds } : m));
      setSuccessMsg('એક્સેસ અપડેટ થઈ.');
    } catch (err: any) {
      console.error(err);
      setError('એક્સેસ અપડેટ ભૂલ.');
    }
  };

  const toggleSection = (section: 'members' | 'accounts' | 'managers') => {
    setOpenSection(prev => prev === section ? null : section);
  };

  if (loading) {
    return (
      <div style={styles.spinnerWrapper}>
        <img src="/logo.png" alt="Loading" className="logo-img-large logo-loader" style={{ height: '120px', marginBottom: '20px' }} />
      </div>
    );
  }

  const renderSectionHeader = (
    section: 'members' | 'accounts' | 'managers',
    icon: React.ReactNode,
    title: string,
    children: React.ReactNode
  ) => {
    const isOpen = !isMobile || openSection === section;
    const HeaderElement = isMobile ? 'button' : 'div';
    
    return (
      <div className="glass-card" style={styles.panelCard}>
        <HeaderElement
          onClick={() => isMobile && toggleSection(section)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            padding: isMobile ? '16px 20px' : '20px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: isOpen ? '1px solid var(--border-glass)' : 'none',
            cursor: isMobile ? 'pointer' : 'default',
            outline: 'none',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon}
            <h3 style={styles.panelTitle}>{title}</h3>
          </div>
          {isMobile && (
            isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />
          )}
        </HeaderElement>
        {isOpen && (
          <div style={{ padding: isMobile ? '20px' : '24px' }} className="animate-fade-in">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      <ThemeToggle />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <button className="back-navigation-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          <span>પોર્ટલ</span>
        </button>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h1 style={{ fontSize: isMobile ? '1.4rem' : '1.75rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
            <Shield size={24} color="var(--primary)" />
            એડમિન સેટિંગ્સ
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>પરિવાર, એકાઉન્ટ અને ધંધા સંચાલન</p>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="animate-fade-in" style={styles.alertSuccess}>
          <Sparkles size={14} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="animate-fade-in" style={styles.alertError}>
          <ShieldAlert size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ 
        ...styles.dashboardGrid, 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))',
        alignItems: 'start'
      }}>
        {/* Panel 1: Family Members */}
        {renderSectionHeader('members',
          <Users size={18} color="var(--primary)" />,
          'પરિવારના સભ્યો',
          <>
            <form onSubmit={handleAddMember} style={styles.innerForm}>
              <div className="form-group">
                <label className="form-label">નવા મોભી સભ્યનું નામ</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="દા.ત. જયેશભાઈ"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">ખર્ચ ઉમેરવાની પરવાનગી</label>
                <div style={styles.checkboxList}>
                  {users.map(u => (
                    <label key={u.id} style={styles.checkboxItem}>
                      <div style={{
                        ...styles.customCheckbox,
                        background: newMemberManagerIds.includes(u.id) ? 'var(--primary)' : 'var(--bg-input)',
                        borderColor: newMemberManagerIds.includes(u.id) ? 'var(--primary)' : 'var(--border-glass)',
                      }}>
                        {newMemberManagerIds.includes(u.id) && <Check size={12} color="var(--text-btn-primary)" />}
                      </div>
                      <input 
                        type="checkbox"
                        style={{ display: 'none' }}
                        checked={newMemberManagerIds.includes(u.id)}
                        onChange={() => setNewMemberManagerIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{u.username}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={actionLoading} style={{ width: '100%' }}>
                <Plus size={16} /> ઉમેરો
              </button>
            </form>

            <div style={styles.listWrapper}>
              <span style={styles.listTitle}>નોંધાયેલા સભ્યો ({members.length})</span>
              {members.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>કોઈ સભ્ય ઉમેરાયેલ નથી.</p>
              ) : (
                <div style={styles.membersList}>
                  {members.map((m) => (
                    <div key={m.id} style={styles.memberRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={styles.memberAvatar}>{m.name.charAt(0).toUpperCase()}</div>
                          <span style={styles.memberName}>{m.name}</span>
                        </div>
                        <button
                          className="btn-icon"
                          style={{ color: 'var(--error)', width: '32px', height: '32px', minHeight: '32px', borderRadius: 'var(--radius-sm)' }}
                          onClick={() => handleDeleteMember(m.id, m.name)}
                          title="દૂર કરો"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div style={styles.accessSection}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>પરવાનગી:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {users.map(u => {
                            const isAllowed = (m.allowed_user_ids || []).includes(u.id);
                            return (
                              <button
                                key={u.id}
                                onClick={() => toggleFamilyAccess(m, u.id)}
                                style={{
                                  ...styles.accessChip,
                                  background: isAllowed ? 'var(--primary-muted)' : 'var(--bg-input)',
                                  borderColor: isAllowed ? 'var(--primary)' : 'var(--border-glass)',
                                  color: isAllowed ? 'var(--primary)' : 'var(--text-muted)',
                                }}
                              >
                                {isAllowed && <Check size={10} />}
                                {u.username}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Panel 2: Register Account */}
        {renderSectionHeader('accounts',
          <UserPlus size={18} color="var(--secondary)" />,
          'નવું લોગિન એકાઉન્ટ',
          <form onSubmit={handleRegisterUser} style={styles.innerForm}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="input-field" placeholder="વપરાશકર્તાનું નામ" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="input-field" placeholder="પાસવર્ડ" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">રોલ (પરવાનગી)</label>
              <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="member">સભ્ય (વાંચવા અને ડેટા નોંધવા)</option>
                <option value="admin">એડમિન (સંપૂર્ણ નિયંત્રણ)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={actionLoading}>
              <Shield size={16} /> રજીસ્ટર કરો
            </button>
          </form>
        )}

        {/* Panel 3: Business Manager Assignment */}
        {renderSectionHeader('managers',
          <Briefcase size={18} color="var(--accent)" />,
          'ધંધાના સંચાલક',
          <div style={{ ...styles.listWrapper, marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
            <span style={styles.listTitle}>નોંધાયેલા ધંધાઓ ({businesses.length})</span>
            {businesses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>કોઈ ધંધો નથી.</p>
            ) : (
              <div style={styles.membersList}>
                {businesses.map((biz) => (
                  <div key={biz.id} style={{ ...styles.memberRow, padding: '16px', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ ...styles.memberAvatar, background: 'rgba(96, 165, 250, 0.1)', color: 'var(--secondary)' }}>
                        <Briefcase size={14} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{biz.name}</span>
                    </div>
                    <select
                      className="input-field"
                      style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                      value={biz.manager_id || ''}
                      onChange={(e) => handleManagerChange(biz.id, e.target.value)}
                    >
                      <option value="">કોઈ સંચાલક નથી</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.username}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  spinnerWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '60vh',
  },
  alertSuccess: {
    padding: '10px 14px',
    background: 'var(--success-muted)',
    border: '1px solid rgba(52, 211, 153, 0.2)',
    color: 'var(--success)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
  },
  alertError: {
    padding: '10px 14px',
    background: 'var(--error-muted)',
    border: '1px solid rgba(248, 113, 113, 0.2)',
    color: 'var(--error)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
  },
  dashboardGrid: {
    display: 'grid',
    gap: '16px',
  },
  panelCard: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  panelTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    margin: 0,
  },
  innerForm: {
    display: 'flex',
    flexDirection: 'column',
  },
  checkboxList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '10px',
    background: 'var(--bg-input)',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-glass)',
  },
  checkboxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    transition: 'var(--transition-smooth)',
    userSelect: 'none',
  },
  customCheckbox: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: '1.5px solid var(--border-glass)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  listWrapper: {
    marginTop: '24px',
    borderTop: '1px solid var(--border-glass)',
    paddingTop: '20px',
  },
  listTitle: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    display: 'block',
    marginBottom: '12px',
    fontFamily: 'var(--font-heading)',
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '380px',
    overflowY: 'auto',
  },
  memberRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-glass)',
    borderRadius: 'var(--radius-md)',
    transition: 'var(--transition-smooth)',
  },
  memberAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--primary-muted)',
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.8rem',
    fontFamily: 'var(--font-heading)',
    flexShrink: 0,
  },
  memberName: {
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  accessSection: {
    padding: '10px 12px',
    background: 'var(--bg-input)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-glass)',
  },
  accessChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: 600,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-heading)',
    background: 'none',
  },
};
