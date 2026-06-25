import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Briefcase, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { familyApi, businessApi } from '../api';
import type { FamilyMember, Business } from '../api';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

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
      }
    };
    loadData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'સુપ્રભાત';
    if (hour < 17) return 'શુભ બપોર';
    return 'શુભ સાંજ';
  };

  return (
    <div className="animate-slide-up portal-container">
      {/* Hero greeting */}
      <div style={{ marginBottom: '20px' }}>
        <p className="hero-greeting">{getGreeting()},</p>
        <h1 className="hero-title">{user?.username || 'વડસક પરિવાર'}</h1>
        <p className="hero-subtitle">
          પરિવારના ખર્ચાઓ અથવા ધંધાકીય ખાતાવહી સંચાલન કરવા માટે પસંદગી કરો.
        </p>
      </div>

      {/* Choice Cards */}
      <div className="portal-grid">
        <div
          className="glass-card portal-choice-card expenses"
          onClick={() => navigate('/dashboard/expenses')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/expenses')}
        >
          <div className="choice-icon-box" style={{ background: 'var(--primary-muted)', borderColor: 'var(--primary)' }}>
            <Home size={28} color="var(--primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>પારિવારિક ખર્ચ</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
              પરિવારના સભ્યોના ખર્ચાઓનું દૈનિક અને માસિક પત્રક.
            </p>
            <span className="badge badge-primary" style={{ marginTop: '8px' }}>
              {members.length} સભ્યો
            </span>
          </div>
          <ChevronRight size={20} color="var(--text-muted)" className="portal-card-arrow" />
        </div>

        <div
          className="glass-card portal-choice-card business"
          onClick={() => navigate('/dashboard/business')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/business')}
        >
          <div className="choice-icon-box" style={{ background: 'rgba(96, 165, 250, 0.1)', borderColor: 'var(--secondary)' }}>
            <Briefcase size={28} color="var(--secondary)" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>ધંધાકીય ખાતાવહી</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
              ધંધાની માસિક આવક-જાવક અને હિસાબી નોંધ.
            </p>
            <span className="badge badge-secondary" style={{ marginTop: '8px' }}>
              {businesses.length} ધંધાઓ
            </span>
          </div>
          <ChevronRight size={20} color="var(--text-muted)" className="portal-card-arrow" />
        </div>
      </div>
    </div>
  );
}
