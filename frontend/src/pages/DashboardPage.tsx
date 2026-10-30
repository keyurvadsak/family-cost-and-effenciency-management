import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Briefcase, ChevronRight,
  Lock, ArrowUpRight, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { familyApi, businessApi } from '../api';
import type { FamilyMember, Business } from '../api';
import LoadingScreen from '../components/ui/LoadingScreen';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [membersList, bizList] = await Promise.all([
          familyApi.list(),
          businessApi.list(),
        ]);
        setMembers(membersList);
        setBusinesses(bizList);
      } catch (err) {
        console.error('Failed to load portal data', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div className="animate-slide-up dashboard-executive">
      {/* ═══════ COMPACT PORTAL TITLE ═══════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            વડસક પરિવાર ખાતાવહી
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
            દ્વિ-નોંધી ખાતાવહી અને નાણાકીય હિસાબ પોર્ટલ
          </p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)' }}></span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--success)' }}>ઓડિટ સક્રિય</span>
        </div>
      </div>

      {/* ═══════ TWO PRIMARY FINANCIAL PORTALS ═══════ */}
      <div className="dashboard-portals-grid">
        {/* Business Accounting Hub */}
        <div
          className="dashboard-hub-card business"
          onClick={() => navigate('/dashboard/business')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/business')}
        >
          <div>
            <div className="dashboard-hub-header">
              <div className="dashboard-hub-icon" style={{ background: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.25)' }}>
                <Briefcase size={24} color="var(--secondary)" />
              </div>
              <div className="dashboard-hub-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    ધંધાકીય ખાતાવહી & P&L
                  </h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
                  દ્વિ-નોંધી ખાતાવહી, નફો-નુકસાન પત્રક (P&L), મૂડી ખાતું અને ઓડિટ હિસાબ.
                </p>
              </div>
            </div>

            {/* Businesses preview chips */}
            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 700 }}>
                નોંધાયેલા વ્યવસાયો ({businesses.length})
              </span>
              <div className="dashboard-preview-list">
                {businesses.length > 0 ? (
                  businesses.slice(0, 4).map(b => (
                    <span key={b.id} className="dashboard-preview-item">
                      <Briefcase size={11} color="var(--secondary)" />
                      <span>{b.name}</span>
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>કોઈ વ્યવસાય નોંધાયેલ નથી.</span>
                )}
                {businesses.length > 4 && (
                  <span className="dashboard-preview-item" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    +{businesses.length - 4} અન્ય...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-glass)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {businesses.length} વ્યવસાયિક એકમો સક્રિય
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--secondary)', fontSize: '0.82rem', fontWeight: 700 }}>
              <span>ખાતાવહી ખોલો</span>
              <ChevronRight size={16} />
            </div>
          </div>
        </div>

        {/* Family Expense Hub */}
        <div
          className="dashboard-hub-card family"
          onClick={() => navigate('/dashboard/expenses')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/expenses')}
        >
          <div>
            <div className="dashboard-hub-header">
              <div className="dashboard-hub-icon" style={{ background: 'var(--primary-muted)', border: '1px solid rgba(212, 168, 83, 0.25)' }}>
                <Home size={24} color="var(--primary)" />
              </div>
              <div className="dashboard-hub-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    પારિવારિક ખર્ચ ખાતાવહી
                  </h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
                  પરિવારના દરેક સભ્યનું દૈનિક ખર્ચ પત્રક, શ્રેણીવાર વિશ્લેષણ અને બજેટ ફાળવણી.
                </p>
              </div>
            </div>

            {/* Family Members preview chips */}
            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 700 }}>
                પરિવાર સભ્ય ખાતાઓ ({members.length})
              </span>
              <div className="dashboard-preview-list">
                {members.length > 0 ? (
                  members.slice(0, 4).map(m => (
                    <span key={m.id} className="dashboard-preview-item">
                      <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: 'var(--primary)', color: '#000', fontSize: '0.62rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {m.name.charAt(0)}
                      </span>
                      <span>{m.name}</span>
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>કોઈ સભ્ય નોંધાયેલ નથી.</span>
                )}
                {members.length > 4 && (
                  <span className="dashboard-preview-item" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    +{members.length - 4} અન્ય...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-glass)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {members.length} સભ્યોનું ખર્ચ પત્રક
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 700 }}>
              <span>ખર્ચ પત્રક ખોલો</span>
              <ChevronRight size={16} />
            </div>
          </div>
        </div>

        {/* Master Consolidated Joint Ledger Hub */}
        <div
          className="dashboard-hub-card"
          style={{
            gridColumn: '1 / -1',
            background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.18), rgba(245, 158, 11, 0.12))',
            border: '1.5px solid rgba(245, 158, 11, 0.4)',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/dashboard/consolidated')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/consolidated')}
        >
          <div>
            <div className="dashboard-hub-header">
              <div className="dashboard-hub-icon" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', color: '#fff' }}>
                <BookOpen size={24} />
              </div>
              <div className="dashboard-hub-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    બધા નો મિક્સ હિસાબ (Master Cashbook)
                  </h3>
                  <span className="badge badge-primary" style={{ fontSize: '0.62rem', background: '#d97706' }}>
                    સંકલિત ખાતાવહી
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
                  તમામ વ્યવસાયો (લૂમ્સ, પ્રિશા ફેબ, હીરા વેપાર), ઉછીના-લોન અને પારિવારિક સંયુક્ત કેશબુક.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-glass)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              માસિક CSV અપલોડ & ડબલ-એન્ટ્રી ખાતાવહી
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '0.82rem', fontWeight: 700 }}>
              <span>ખાતાવહી ખોલો</span>
              <ChevronRight size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ ADMIN CONTROL STRIP (FULL WIDTH) ═══════ */}
      {user?.role === 'admin' && (
        <div
          className="glass-card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            borderLeft: '3px solid var(--primary)',
            borderRadius: 'var(--radius-md)'
          }}
          onClick={() => navigate('/dashboard/admin')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/admin')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-glass)' }}>
              <Lock size={18} color="var(--primary)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  એડમિન કંટ્રોલ પેનલ અને અધિકાર સંચાલન
                </h4>
                <span className="badge badge-primary" style={{ fontSize: '0.62rem' }}>એડમિન</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                પરિવારના સભ્યો ઉમેરો, ધંધાના સંચાલકો સોંપો અને સુરક્ષા પરવાનગીઓ ગોઠવો.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700 }}>
            <span className="hide-on-mobile">સંચાલન</span>
            <ArrowUpRight size={15} />
          </div>
        </div>
      )}
    </div>
  );
}
