import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, IndianRupee, ChevronRight,
  FileText, User as UserIcon, Search, Printer,
  CheckCircle2, LayoutGrid, Table, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { familyApi, expenseApi } from '../api';
import type { FamilyMember, FamilyExpense } from '../api';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';

const CATEGORIES = ['કરિયાણું', 'બિલ (લાઈટ/ફોન)', 'શિક્ષણ', 'તબીબી / દવાઓ', 'રોકાણ', 'મનોરંજન / જમવું', 'અન્ય ખર્ચ'];
const CATEGORY_COLORS: Record<string, string> = {
  'કરિયાણું': '#d4a853',
  'બિલ (લાઈટ/ફોન)': '#60a5fa',
  'શિક્ષણ': '#a78bfa',
  'તબીબી / દવાઓ': '#34d399',
  'રોકાણ': '#fbbf24',
  'મનોરંજન / જમવું': '#f87171',
  'અન્ય ખર્ચ': '#64748b'
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const memberId = searchParams.get('member');
  const selectedMember = memberId ? members.find(m => m.id === parseInt(memberId, 10)) || null : null;
  const [expenses, setExpenses] = useState<FamilyExpense[]>([]);

  // Search & Period filter
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return 'cards';
    return 'table';
  });

  const [showKpiSummary, setShowKpiSummary] = useState(true);

  useEffect(() => {
    setViewMode(isMobile ? 'cards' : 'table');
  }, [isMobile]);

  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const list = await familyApi.list();
        setMembers(list);
      } catch (err) {
        console.error('Failed to load members', err);
      } finally {
        setLoading(false);
      }
    };
    loadMembers();
  }, []);

  useEffect(() => {
    if (!selectedMember) {
      setExpenses([]);
      return;
    }
    const fetchExpenses = async () => {
      setDetailLoading(true);
      try {
        const list = await expenseApi.listByMember(selectedMember.id);
        setExpenses(list);
      } catch (err) {
        console.error('Failed to load expenses', err);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchExpenses();
  }, [selectedMember]);

  const selectMember = (m: FamilyMember) => setSearchParams({ member: m.id.toString() });
  const clearMember = () => setSearchParams({});

  const canAddExpense = user?.role === 'admin' || (selectedMember?.allowed_user_ids || []).includes(user?.id as number);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setActionLoading(true);

    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('કૃપા કરીને શૂન્ય કરતાં વધુ સાચી રકમ દાખલ કરો.');
      }

      const newExpense = await expenseApi.create({
        family_member_id: selectedMember.id,
        amount: parsedAmount,
        category,
        description: description || undefined,
        date: expenseDate,
      });

      setExpenses(prev => [newExpense, ...prev]);
      setAmount('');
      setDescription('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setShowExpenseModal(false);
      showToast('નવો ખર્ચ સફળતાપૂર્વક ખાતાવહીમાં નોંધાયો છે!');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'ખર્ચ નોંધવામાં ભૂલ આવી છે.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('શું તમે ખરેખર આ ખર્ચ એન્ટ્રી કાઢી નાખવા માંગો છો?')) return;
    try {
      await expenseApi.delete(id);
      setExpenses(prev => prev.filter(exp => exp.id !== id));
      showToast('ખર્ચ એન્ટ્રી કાઢી નાખવામાં આવી છે.');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'ખર્ચ કાઢી નાખવામાં નિષ્ફળતા મળી.', 'error');
    }
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    let res = [...expenses];

    // Period filter
    if (periodFilter === 'this_month') {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      res = res.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (periodFilter === 'last_month') {
      const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      res = res.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === lastMonth && d.getFullYear() === year;
      });
    } else if (periodFilter === 'this_year') {
      const currentYear = now.getFullYear();
      res = res.filter(e => new Date(e.date).getFullYear() === currentYear);
    }

    // Category filter
    if (selectedCategoryFilter !== 'all') {
      res = res.filter(e => e.category === selectedCategoryFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      res = res.filter(e => {
        return (
          e.category.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          e.amount.toString().includes(q) ||
          e.date.includes(q)
        );
      });
    }

    return res;
  }, [expenses, periodFilter, selectedCategoryFilter, searchQuery]);

  // Calculations
  const totalSpent = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const avgExpense = filteredExpenses.length > 0 ? (totalSpent / filteredExpenses.length) : 0;
  const maxExpense = filteredExpenses.length > 0 ? Math.max(...filteredExpenses.map(e => e.amount)) : 0;

  // Category breakdown for ledger table (Replaces Pie Chart!)
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredExpenses.forEach(exp => {
      if (!map[exp.category]) {
        map[exp.category] = { total: 0, count: 0 };
      }
      map[exp.category].total += exp.amount;
      map[exp.category].count += 1;
    });

    return Object.entries(map).map(([name, data]) => {
      const percent = totalSpent > 0 ? (data.total / totalSpent) * 100 : 0;
      const avg = data.count > 0 ? data.total / data.count : 0;
      const color = CATEGORY_COLORS[name] || '#64748b';
      return {
        name,
        total: data.total,
        count: data.count,
        percent,
        avg,
        color
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredExpenses, totalSpent]);

  const handlePrint = () => {
    window.print();
  };

  // ═══════ LOADING ═══════
  if (loading) return <LoadingScreen />;

  // ═══════ MEMBER SELECTION ═══════
  if (!selectedMember) {
    return (
      <div className="animate-slide-up">
        <button className="back-navigation-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          <span>મુખ્ય પોર્ટલ</span>
        </button>

        <h2 className="section-title">પારિવારિક સભ્યોની ખાતાવહી</h2>
        <p className="section-subtitle">
          દરેક સભ્યના વિગતવાર ખર્ચ પત્રક, કેટેગરી ફાળવણી અને ઓડિટ હિસાબ જોવા માટે સભ્ય પસંદ કરો.
        </p>

        <div className="layout-grid stagger-children" style={{ marginTop: '20px' }}>
          {members.map(m => (
            <div
              key={m.id}
              className="glass-card-interactive selection-avatar-card"
              onClick={() => selectMember(m)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && selectMember(m)}
            >
              <div className="selection-avatar-badge" style={{ background: 'linear-gradient(135deg, var(--primary), #c4963f)' }}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                {m.name}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '12px' }}>
                પરિવાર સભ્ય ખાતાવહી
              </p>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                <span>પત્રક ખોલો</span>
                <ChevronRight size={14} />
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <div className="glass-card" style={{ gridColumn: '1/-1' }}>
              <EmptyState icon={UserIcon} message="કોઈ સભ્ય નોંધાયેલ નથી. એડમિન સેટિંગ્સમાં સભ્યોના નામ ઉમેરો." />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════ EXPENSE DETAIL: ACCOUNTANT LEDGER ═══════
  if (detailLoading) return <LoadingScreen />;

  return (
    <div className="animate-slide-up">
      {/* Print Only Header */}
      <div className="print-only print-header">
        <h1>{selectedMember.name} — પારિવારિક ખર્ચ ઓડિટ પત્રક</h1>
        <p>વડસક પરિવાર નાણાકીય ખાતાવહી રજીસ્ટર</p>
        <p style={{ fontSize: '9pt', color: '#666', marginTop: '4px' }}>
          તારીખ: {new Date().toLocaleDateString('gu-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Screen Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '6px' : '10px', marginBottom: isMobile ? '6px' : '12px' }}>
        <button className="back-navigation-btn" onClick={clearMember} style={{ margin: 0 }}>
          <ArrowLeft size={14} />
          <span>સભ્યો</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint} title="ખર્ચ પત્રક પ્રિન્ટ કરો">
            <Printer size={14} />
            <span className={isMobile ? 'hide-on-mobile' : ''}>પ્રિન્ટ</span>
          </button>
          {canAddExpense && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)}>
              <Plus size={14} />
              <span>નવો ખર્ચ</span>
            </button>
          )}
        </div>
      </div>

      {/* Entity Banner */}
      <div className="glass-card entity-banner" style={{ marginTop: isMobile ? '4px' : '12px', padding: isMobile ? '7px 10px' : '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
          <div className="selection-avatar-badge" style={{ margin: 0, width: isMobile ? '32px' : '48px', height: isMobile ? '32px' : '48px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, var(--primary), #b3862b)' }}>
            {selectedMember.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 style={{ fontSize: isMobile ? '0.98rem' : '1.4rem', fontWeight: 800, margin: 0 }}>
                {selectedMember.name}
              </h2>
              <span className="badge badge-primary" style={{ fontSize: '0.6rem' }}>સભ્ય ખાતું</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', margin: '1px 0 0' }}>
              શ્રેણીવાર માસિક ફાળવણી અને ખર્ચ હિસાબ
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>કુલ એન્ટ્રીઓ</span>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {filteredExpenses.length} વાઉચર
          </div>
        </div>
      </div>

      {/* High-Density Accountant KPI Cards (Zero Graphs) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: isMobile ? '6px' : '10px', marginBottom: '2px' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          ખર્ચ સારાંશ (Expense KPIs)
        </span>
        {isMobile && (
          <button
            type="button"
            onClick={() => setShowKpiSummary(!showKpiSummary)}
            style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
          >
            <span>{showKpiSummary ? 'છુપાવો' : 'વિસ્તૃત કરો'}</span>
            {showKpiSummary ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {!showKpiSummary && isMobile ? (
        <div className="acc-kpi-collapsed-bar" onClick={() => setShowKpiSummary(true)}>
          <span>કુલ ખર્ચ: <strong className="text-debit">₹{totalSpent.toLocaleString('en-IN')}</strong></span>
          <span>•</span>
          <span>સરેરાશ: <strong>₹{Math.round(avgExpense).toLocaleString('en-IN')}</strong></span>
          <span>•</span>
          <span>ટોચ: <strong>₹{maxExpense.toLocaleString('en-IN')}</strong></span>
        </div>
      ) : (
        <div className="acc-kpi-grid">
          <div className="acc-kpi-card kpi-expense">
            <div className="acc-kpi-header">
              <span className="acc-kpi-title">કુલ ખર્ચ</span>
              <span className="acc-kpi-badge badge-danger">ઉધાર</span>
            </div>
            <div className="acc-kpi-value text-debit">₹{totalSpent.toLocaleString('en-IN')}</div>
            <div className="acc-kpi-subtext">
              <span>કુલ નોંધાયેલ ખર્ચ</span>
            </div>
          </div>

          <div className="acc-kpi-card kpi-income">
            <div className="acc-kpi-header">
              <span className="acc-kpi-title">સરેરાશ / વાઉચર</span>
              <span className="acc-kpi-badge badge-secondary">સરેરાશ</span>
            </div>
            <div className="acc-kpi-value" style={{ color: 'var(--secondary)' }}>
              ₹{Math.round(avgExpense).toLocaleString('en-IN')}
            </div>
            <div className="acc-kpi-subtext">
              <span>પ્રતિ એન્ટ્રી સરેરાશ</span>
            </div>
          </div>

          <div className="acc-kpi-card kpi-profit">
            <div className="acc-kpi-header">
              <span className="acc-kpi-title">સૌથી મોટો ખર્ચ</span>
              <span className="acc-kpi-badge badge-primary">ટોચ ખર્ચ</span>
            </div>
            <div className="acc-kpi-value" style={{ color: 'var(--primary)' }}>
              ₹{maxExpense.toLocaleString('en-IN')}
            </div>
            <div className="acc-kpi-subtext">
              <span>સિંગલ મહત્તમ ચુકવણી</span>
            </div>
          </div>

          <div className="acc-kpi-card kpi-capital">
            <div className="acc-kpi-header">
              <span className="acc-kpi-title">સક્રિય શ્રેણીઓ</span>
              <span className="acc-kpi-badge badge-success">કેટેગરી</span>
            </div>
            <div className="acc-kpi-value text-credit">
              {categoryBreakdown.length}
            </div>
            <div className="acc-kpi-subtext">
              <span>વિવિધ શ્રેણીઓ</span>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar (Search, Filter, Category) */}
      <div className="accountant-toolbar">
        <div className="accountant-toolbar-left">
          <div className="accountant-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="accountant-search-input"
              placeholder="નોંધ, કેટેગરી કે રકમ શોધો..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="accountant-filter-select"
            value={selectedCategoryFilter}
            onChange={e => setSelectedCategoryFilter(e.target.value)}
          >
            <option value="all">બધી શ્રેણીઓ (All Categories)</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="accountant-toolbar-right">
          <select
            className="accountant-filter-select"
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value as any)}
          >
            <option value="all">તમામ સમય (All Time)</option>
            <option value="this_month">ચાલુ મહિનો (This Month)</option>
            <option value="last_month">ગયો મહિનો (Last Month)</option>
            <option value="this_year">ચાલુ વર્ષ (This Year)</option>
          </select>
        </div>
      </div>

      {/* Category Allocation Ledger (REPLACES PIE CHART) */}
      <div className="allocation-ledger-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
              શ્રેણીવાર ખર્ચ વિશ્લેષણ પત્રક (Category Allocation Audit)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>
              દરેક કેટેગરીમાં થયેલ કુલ ખર્ચ, ટકાવારી પ્રમાણ અને સરેરાશ ફાળવણી.
            </p>
          </div>
          <span className="badge badge-primary">ઓડિટ સારાંશ</span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <EmptyState icon={FileText} message="આ સમયગાળામાં કોઈ ખર્ચ વિશ્લેષણ ઉપલબ્ધ નથી." />
        ) : (
          <div className="accountant-table-wrap">
            <table className="accountant-table">
              <thead>
                <tr>
                  <th>શ્રેણી (Category)</th>
                  <th className="num-cell">કુલ રકમ [ઉધાર]</th>
                  <th>બજેટ શેર (%)</th>
                  <th className="num-cell">એન્ટ્રીઓ</th>
                  <th className="num-cell">સરેરાશ / વાઉચર</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map(cat => (
                  <tr key={cat.name}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cat.color, display: 'inline-block' }}></span>
                        <strong style={{ color: 'var(--text-main)' }}>{cat.name}</strong>
                      </div>
                    </td>
                    <td className="num-cell text-debit">₹{cat.total.toLocaleString('en-IN')}</td>
                    <td style={{ minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="allocation-progress-track">
                          <div
                            className="allocation-progress-fill"
                            style={{ width: `${cat.percent}%`, background: cat.color }}
                          ></div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '42px', textAlign: 'right' }}>
                          {cat.percent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="num-cell">{cat.count}</td>
                    <td className="num-cell">₹{Math.round(cat.avg).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>કુલ સરવાળો (TOTAL)</td>
                  <td className="num-cell text-debit">₹{totalSpent.toLocaleString('en-IN')}</td>
                  <td>100.0%</td>
                  <td className="num-cell">{filteredExpenses.length}</td>
                  <td className="num-cell">₹{Math.round(avgExpense).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Expense Ledger Table */}
      <div className="glass-card" style={{ padding: isMobile ? '12px' : '20px', marginTop: isMobile ? '10px' : '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '10px' : '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0, fontSize: isMobile ? '1rem' : '1.15rem' }}>
              વિગતવાર ખર્ચ ખાતાવહી (Expense Ledger)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem', margin: '2px 0 0' }}>
              તમામ દૈનિક ચુકવણીઓ અને વાઉચર વિગતો
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* View Toggle */}
            <div className="view-toggle-wrap">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                title="કાર્ડ વ્યૂ"
              >
                <LayoutGrid size={13} />
                <span>કાર્ડ</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="ટેબલ પત્રક"
              >
                <Table size={13} />
                <span>ટેબલ</span>
              </button>
            </div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <EmptyState icon={FileText} message="હજુ સુધી કોઈ ખર્ચ એન્ટ્રીઓ નોંધાયેલ નથી." />
        ) : viewMode === 'cards' ? (
          <div>
            {/* Mobile Expense Summary Totals */}
            <div className="mobile-ledger-totals">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)' }}>
                  કુલ ખર્ચ સરવાળો
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {filteredExpenses.length} એન્ટ્રીઓ
                </span>
              </div>
              <div className="mobile-ledger-totals-grid">
                <div className="mobile-ledger-totals-item highlight">
                  <span className="acc-financial-cell-title" style={{ color: 'var(--error)' }}>કુલ ચુકવણી [ઉધાર]</span>
                  <span className="acc-financial-cell-val text-debit" style={{ fontSize: '1.15rem' }}>
                    ₹{totalSpent.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="mobile-ledger-totals-item">
                  <span className="acc-financial-cell-title">સરેરાશ ખર્ચ</span>
                  <span className="acc-financial-cell-val" style={{ color: 'var(--secondary)' }}>
                    ₹{Math.round(avgExpense).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="mobile-ledger-totals-item">
                  <span className="acc-financial-cell-title">સૌથી મોટો ખર્ચ</span>
                  <span className="acc-financial-cell-val" style={{ color: 'var(--primary)' }}>
                    ₹{maxExpense.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Expense Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredExpenses.map(exp => (
                <div key={exp.id} className="acc-record-card loss">
                  <div className="acc-record-card-header">
                    <span className="acc-record-card-date">
                      {new Date(exp.date).toLocaleDateString('gu-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        className="badge"
                        style={{
                          background: `${CATEGORY_COLORS[exp.category] || 'var(--primary)'}22`,
                          color: CATEGORY_COLORS[exp.category] || 'var(--primary)',
                          border: `1px solid ${CATEGORY_COLORS[exp.category] || 'var(--primary)'}55`,
                          fontSize: '0.68rem',
                          fontWeight: 700
                        }}
                      >
                        {exp.category}
                      </span>
                      <span className="status-pill status-paid">
                        <CheckCircle2 size={11} /> ચૂકવેલ
                      </span>
                    </div>
                  </div>

                  <div className="acc-record-card-particulars">
                    {exp.description || 'નિયમિત ઘરખર્ચ'}
                  </div>

                  <div className="acc-record-card-footer">
                    <div>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>ખર્ચ રકમ [DR]</span>
                      <span className="num-cell text-debit" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                        ₹{exp.amount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {canAddExpense && (user?.role === 'admin' || exp.added_by === user?.id) && (
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--error)', width: '28px', height: '28px' }}
                        onClick={() => handleDeleteExpense(exp.id)}
                        title="કાઢી નાખો"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="accountant-table-wrap">
            {isMobile && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '6px 8px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-glass)' }}>
                👈 તમામ વિગતો જોવા માટે આડું સ્ક્રોલ કરો 👉
              </div>
            )}
            <table className="accountant-table">
              <thead>
                <tr>
                  <th>તારીખ</th>
                  <th>શ્રેણી (Category)</th>
                  <th>વિગત / નોંધ (Particulars)</th>
                  <th className="num-cell">રકમ [ઉધાર / DR]</th>
                  <th>સ્થિતિ</th>
                  {canAddExpense && <th style={{ textAlign: 'center' }}>ક્રિયા</th>}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td className="col-date">
                      {new Date(exp.date).toLocaleDateString('gu-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ maxWidth: '280px', whiteSpace: 'normal', color: 'var(--text-main)' }}>
                      {exp.description || 'નિયમિત ઘરખર્ચ'}
                    </td>
                    <td className="num-cell text-debit" style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                      ₹{exp.amount.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className="status-pill status-paid">
                        <CheckCircle2 size={12} /> ચૂકવેલ
                      </span>
                    </td>
                    {canAddExpense && (
                      <td style={{ textAlign: 'center' }}>
                        {(user?.role === 'admin' || exp.added_by === user?.id) && (
                          <button
                            className="btn-icon"
                            style={{ color: 'var(--error)', width: '28px', height: '28px' }}
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="કાઢી નાખો"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontWeight: 800 }}>કુલ ખર્ચ સરવાળો</td>
                  <td className="num-cell text-debit" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                    ₹{totalSpent.toLocaleString('en-IN')}
                  </td>
                  <td colSpan={canAddExpense ? 2 : 1}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {filteredExpenses.length} એન્ટ્રીઓ
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal
        show={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        title={`નવો ખર્ચ નોંધો (${selectedMember.name})`}
        maxWidth="520px"
      >
        <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--error)' }}>ખર્ચની રકમ (₹) *</label>
            <div className="input-wrapper">
              <IndianRupee size={16} className="input-icon" />
              <input
                type="number"
                step="0.01"
                className="input-field input-with-icon"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">ખર્ચ શ્રેણી (Category) *</label>
              <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">તારીખ *</label>
              <input
                type="date"
                className="input-field"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">વિગત / નોંધ (Particulars)</label>
            <textarea
              className="input-field"
              placeholder="ખર્ચ કઈ બાબતમાં કર્યો તેની નોંધ..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ minHeight: '70px' }}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>ખાતાવહીમાં નોંધો</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
