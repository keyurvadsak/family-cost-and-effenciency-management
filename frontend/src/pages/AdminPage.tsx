import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { familyApi, authApi, businessApi } from '../api';
import type { FamilyMember, Business, User } from '../api';
import { Plus, Trash2, UserPlus, Users, Shield, ArrowLeft, Briefcase, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import LoadingScreen from '../components/ui/LoadingScreen';

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberManagerIds, setNewMemberManagerIds] = useState<number[]>([]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [openSection, setOpenSection] = useState<'members' | 'accounts' | 'managers' | null>('members');

  const loadData = async () => {
    try {
      const [list, bizList, userList] = await Promise.all([
        familyApi.list(),
        businessApi.list(),
        authApi.getUsers(),
      ]);
      setMembers(list);
      setBusinesses(bizList);
      setUsers(userList);
    } catch (err) {
      console.error(err);
      showToast('ડેટા મેળવવામાં નિષ્ફળતા મળી.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setActionLoading(true);
    try {
      const created = await familyApi.create(newMemberName.trim(), newMemberManagerIds);
      setMembers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      showToast(`પરિવારના મોભી "${created.name}" સફળતાપૂર્વક ઉમેરવામાં આવ્યા છે!`);
      setNewMemberName('');
      setNewMemberManagerIds([]);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'પરિવારના મોભી ઉમેરવામાં ભૂલ આવી છે.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMember = async (id: number, name: string) => {
    if (!window.confirm(`શું તમે ખરેખર પરિવારના મોભી "${name}" ને કાઢી નાખવા માંગો છો? આનાથી તેમના સંકળાયેલા તમામ માસિક ખર્ચાઓ પણ કાયમ માટે કાઢી નાખવામાં આવશે.`)) return;
    try {
      await familyApi.delete(id);
      setMembers(prev => prev.filter(m => m.id !== id));
      showToast(`પરિવારના મોભી "${name}" ને સફળતાપૂર્વક કાઢી નાખવામાં આવ્યા છે.`);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'પરિવારના મોભીને કાઢી નાખવામાં ભૂલ આવી છે.', 'error');
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setActionLoading(true);
    try {
      await authApi.register(username.trim(), password.trim(), role);
      showToast(`નવું એકાઉન્ટ "${username}" ${role === 'admin' ? 'એડમિન' : 'સભ્ય'} પરવાનગી સાથે રજીસ્ટર થયું.`);
      setUsername('');
      setPassword('');
      setRole('member');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'એકાઉન્ટ રજીસ્ટર કરવામાં ભૂલ.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManagerChange = async (bizId: number, val: string) => {
    try {
      const managerId = val ? parseInt(val) : null;
      await businessApi.updateManager(bizId, managerId);
      setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, manager_id: managerId } : b));
      showToast('સંચાલક અપડેટ થયા.');
    } catch (err: any) {
      console.error(err);
      showToast('સંચાલક અપડેટ ભૂલ.', 'error');
    }
  };

  const toggleFamilyAccess = async (member: FamilyMember, userId: number) => {
    try {
      const currentIds = member.allowed_user_ids || [];
      const newIds = currentIds.includes(userId)
        ? currentIds.filter(id => id !== userId)
        : [...currentIds, userId];
      await familyApi.updateAccess(member.id, newIds);
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, allowed_user_ids: newIds } : m));
      showToast('એક્સેસ અપડેટ થઈ.');
    } catch (err: any) {
      console.error(err);
      showToast('એક્સેસ અપડેટ ભૂલ.', 'error');
    }
  };

  const toggleSection = (section: 'members' | 'accounts' | 'managers') => {
    setOpenSection(prev => prev === section ? null : section);
  };

  if (loading) return <LoadingScreen />;

  const renderSectionHeader = (
    section: 'members' | 'accounts' | 'managers',
    icon: React.ReactNode,
    title: string,
    children: React.ReactNode
  ) => {
    const isOpen = !isMobile || openSection === section;
    const HeaderElement = isMobile ? 'button' : 'div';

    return (
      <div className="glass-card admin-panel-card">
        <HeaderElement
          onClick={() => isMobile && toggleSection(section)}
          className={`admin-panel-header ${isMobile ? 'admin-panel-header-collapsible' : ''} ${!isOpen ? 'admin-panel-header-closed' : ''}`}
          style={{ padding: isMobile ? '16px 20px' : '20px 24px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon}
            <h3 className="admin-panel-title">{title}</h3>
          </div>
          {isMobile && (
            isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />
          )}
        </HeaderElement>
        {isOpen && (
          <div className="admin-panel-body animate-fade-in" style={{ padding: isMobile ? '20px' : '24px' }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

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

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))', alignItems: 'start' }}>
        {/* Panel 1: Family Members */}
        {renderSectionHeader('members',
          <Users size={18} color="var(--primary)" />,
          'પરિવારના સભ્યો',
          <>
            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="form-group">
                <label className="form-label">નવા મોભી સભ્યનું નામ</label>
                <input type="text" className="input-field" placeholder="દા.ત. જયેશભાઈ" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">ખર્ચ ઉમેરવાની પરવાનગી</label>
                <div className="admin-checkbox-list">
                  {users.map(u => (
                    <label key={u.id} className="admin-checkbox-item">
                      <div className="admin-custom-checkbox" style={{
                        background: newMemberManagerIds.includes(u.id) ? 'var(--primary)' : 'var(--bg-input)',
                        borderColor: newMemberManagerIds.includes(u.id) ? 'var(--primary)' : 'var(--border-glass)',
                      }}>
                        {newMemberManagerIds.includes(u.id) && <Check size={12} color="var(--text-btn-primary)" />}
                      </div>
                      <input type="checkbox" style={{ display: 'none' }} checked={newMemberManagerIds.includes(u.id)} onChange={() => setNewMemberManagerIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{u.username}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={actionLoading} style={{ width: '100%' }}>
                <Plus size={16} /> ઉમેરો
              </button>
            </form>

            <div className="admin-list-wrapper">
              <span className="admin-list-title">નોંધાયેલા સભ્યો ({members.length})</span>
              {members.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>કોઈ સભ્ય ઉમેરાયેલ નથી.</p>
              ) : (
                <div className="admin-members-list">
                  {members.map(m => (
                    <div key={m.id} className="admin-member-row">
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="admin-member-avatar">{m.name.charAt(0).toUpperCase()}</div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{m.name}</span>
                        </div>
                        <button className="btn-icon" style={{ color: 'var(--error)', width: '32px', height: '32px', minHeight: '32px', borderRadius: 'var(--radius-sm)' }} onClick={() => handleDeleteMember(m.id, m.name)} title="દૂર કરો">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="admin-access-section">
                        <span className="text-overline" style={{ fontSize: '0.7rem' }}>પરવાનગી:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {users.map(u => {
                            const isAllowed = (m.allowed_user_ids || []).includes(u.id);
                            return (
                              <button key={u.id} onClick={() => toggleFamilyAccess(m, u.id)} className="admin-access-chip" style={{
                                background: isAllowed ? 'var(--primary-muted)' : 'var(--bg-input)',
                                borderColor: isAllowed ? 'var(--primary)' : 'var(--border-glass)',
                                color: isAllowed ? 'var(--primary)' : 'var(--text-muted)',
                              }}>
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
          <form onSubmit={handleRegisterUser} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="input-field" placeholder="વપરાશકર્તાનું નામ" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="input-field" placeholder="પાસવર્ડ" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">રોલ (પરવાનગી)</label>
              <select className="input-field" value={role} onChange={e => setRole(e.target.value as any)}>
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
          <div>
            <span className="admin-list-title">નોંધાયેલા ધંધાઓ ({businesses.length})</span>
            {businesses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>કોઈ ધંધો નથી.</p>
            ) : (
              <div className="admin-members-list">
                {businesses.map(biz => (
                  <div key={biz.id} className="admin-member-row" style={{ padding: '16px', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="admin-member-avatar" style={{ background: 'rgba(96, 165, 250, 0.1)', color: 'var(--secondary)' }}>
                        <Briefcase size={14} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{biz.name}</span>
                    </div>
                    <select className="input-field" style={{ padding: '8px 12px', fontSize: '0.85rem' }} value={biz.manager_id || ''} onChange={e => handleManagerChange(biz.id, e.target.value)}>
                      <option value="">કોઈ સંચાલક નથી</option>
                      {users.map(u => (<option key={u.id} value={u.id}>{u.username}</option>))}
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
