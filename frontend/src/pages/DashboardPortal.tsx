import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, familyApi, expenseApi, businessApi } from '../api';
import type { User, FamilyMember, FamilyExpense, Business, BusinessRecord } from '../api';
import {
  ArrowLeft, Home, Briefcase, Settings, LogOut,
  Plus, Trash2, IndianRupee, Sparkles,
  LayoutGrid, X, TrendingUp, PieChart as PieIcon, Menu,
  User as UserIcon, ChevronRight, Calendar, FileText,
  DollarSign, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import ThemeToggle from '../components/ThemeToggle';

// Config constants in Gujarati
const CATEGORIES = ['કરિયાણું', 'બિલ (લાઈટ/ફોન)', 'શિક્ષણ', 'તબીબી / દવાઓ', 'રોકાણ', 'મનોરંજન / જમવું', 'અન્ય ખર્ચ'];
const COLORS = ['#d4a853', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#64748b'];

export default function DashboardPortal() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navigation states
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = searchParams.get('mode') || 'portal';

  // Expenses drill down state
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const memberId = searchParams.get('member');
  const selectedMember = memberId ? members.find(m => m.id === parseInt(memberId, 10)) || null : null;
  const [expenses, setExpenses] = useState<FamilyExpense[]>([]);

  // Business drill down state
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const bizId = searchParams.get('biz');
  const selectedBiz = bizId ? businesses.find(b => b.id === parseInt(bizId, 10)) || null : null;
  const [records, setRecords] = useState<BusinessRecord[]>([]);

  // Navigation handlers
  const setMode = (m: 'portal' | 'expenses' | 'business') => {
    setSearchParams({ mode: m });
  };
  const setSelectedMember = (m: FamilyMember | null) => {
    if (m) setSearchParams({ mode: 'expenses', member: m.id.toString() });
    else setSearchParams({ mode: 'expenses' });
  };
  const setSelectedBiz = (b: Business | null) => {
    if (b) setSearchParams({ mode: 'business', biz: b.id.toString() });
    else setSearchParams({ mode: 'business' });
  };

  // Expenses Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Business Modal & Form states
  const [bizName, setBizName] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [bizManagerId, setBizManagerId] = useState('');
  const [showBizModal, setShowBizModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [bizDate, setBizDate] = useState(new Date().toISOString().split('T')[0]);
  const [bizCost, setBizCost] = useState('');
  const [bizRevenue, setBizRevenue] = useState('');
  const [bizExpenses, setBizExpenses] = useState('');
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [globalCustomValues, setGlobalCustomValues] = useState<Record<string, string>>({});
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  
  // Add Column Modal State
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newGlobalColumnName, setNewGlobalColumnName] = useState('');

  // Investments state
  const [investments, setInvestments] = useState<any[]>([]);
  const [showInvModal, setShowInvModal] = useState(false);
  const [invPersonName, setInvPersonName] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invAmount, setInvAmount] = useState('');
  const [invType, setInvType] = useState<"INVESTMENT" | "WITHDRAWAL">("INVESTMENT");

  // General state
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-dismiss success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Authenticate and load base options
  useEffect(() => {
    const initApp = async () => {
      try {
        const u = await authApi.getCurrentUser();
        setUser(u);

        // Pre-fetch lists
        const membersList = await familyApi.list();
        setMembers(membersList);
        const bizList = await businessApi.list();
        setBusinesses(bizList);

        try {
          const uList = await authApi.getUsers();
          setAllUsers(uList);
        } catch (e) {
          console.error("Failed to load users", e);
        }
      } catch (err) {
        console.error("Authentication failed. Redirecting to login...", err);
        authApi.logout();
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, [navigate]);

  // Fetch expenses when a family member is selected
  useEffect(() => {
    if (!selectedMember) {
      setExpenses([]);
      return;
    }
    const fetchExpenses = async () => {
      try {
        const list = await expenseApi.listByMember(selectedMember.id);
        setExpenses(list);
      } catch (err) {
        console.error("Failed to load expenses", err);
      }
    };
    fetchExpenses();
  }, [selectedMember]);

  // Fetch business records when a business is selected
  useEffect(() => {
    if (!selectedBiz) {
      setRecords([]);
      return;
    }
    const fetchRecords = async () => {
      try {
        const list = await businessApi.getRecords(selectedBiz.id);
        setRecords(list);
        const invList = await businessApi.getInvestments(selectedBiz.id);
        setInvestments(invList);
      } catch (err) {
        console.error("Failed to load records", err);
      }
    };
    fetchRecords();
  }, [selectedBiz]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const resetPortal = () => {
    setSearchParams({});
    setError(null);
    setSuccess(null);
  };

  // ----------------- HOUSEHOLD EXPENSES HANDLERS -----------------
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setError(null);
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

      setExpenses((prev) => [newExpense, ...prev]);
      setAmount('');
      setDescription('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setShowExpenseModal(false);
      setSuccess('નવો ખર્ચ સફળતાપૂર્વક નોંધવામાં આવ્યો છે!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ખર્ચ નોંધવામાં ભૂલ આવી છે.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('શું તમે ખરેખર આ ખર્ચ કાઢી નાખવા માંગો છો?')) return;
    try {
      await expenseApi.delete(id);
      setExpenses((prev) => prev.filter((exp) => exp.id !== id));
      setSuccess('ખર્ચ એન્ટ્રી કાઢી નાખવામાં આવી છે.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'ખર્ચ કાઢી નાખવામાં નિષ્ફળતા મળી.');
    }
  };

  // ----------------- BUSINESS HANDLERS -----------------
  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim()) return;
    if (user?.role !== 'admin') {
      setError('માત્ર એડમિન જ નવો ધંધો ઉમેરી શકે છે.');
      return;
    }
    setError(null);
    setActionLoading(true);

    try {
      const parsedManagerId = bizManagerId ? parseInt(bizManagerId) : undefined;
      const newBiz = await businessApi.create(bizName.trim(), bizDesc.trim(), parsedManagerId);
      setBusinesses((prev) => [...prev, newBiz]);
      setSelectedBiz(newBiz);
      setBizName('');
      setBizDesc('');
      setBizManagerId('');
      setShowBizModal(false);
      setSuccess(`ધંધો "${newBiz.name}" સફળતાપૂર્વક રજીસ્ટર થયો છે!`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'નવો ધંધો ઉમેરવામાં ભૂલ આવી છે.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBusiness = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('શું તમે આ ધંધાની વિગતો અને તેના તમામ માસિક પત્રકો કાયમ માટે કાઢી નાખવા માંગો છો?')) return;
    try {
      await businessApi.delete(id);
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      if (selectedBiz?.id === id) {
        setSelectedBiz(null);
      }
      setSuccess('ધંધાની ખાતાવહી કાઢી નાખવામાં આવી છે.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'ધંધો કાઢી નાખવામાં ભૂલ આવી છે.');
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim() || !newFieldValue.trim()) return;
    setCustomFields((prev) => [...prev, { key: newFieldName.trim(), value: newFieldValue.trim() }]);
    setNewFieldName('');
    setNewFieldValue('');
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddGlobalColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz || !newGlobalColumnName.trim()) return;
    setActionLoading(true);
    try {
      const updatedColumns = [...(selectedBiz.custom_columns || []), newGlobalColumnName.trim()];
      const updatedBiz = await businessApi.updateColumns(selectedBiz.id, updatedColumns);
      setSelectedBiz(updatedBiz);
      setBusinesses(prev => prev.map(b => b.id === updatedBiz.id ? updatedBiz : b));
      setShowAddColumnModal(false);
      setNewGlobalColumnName('');
      setSuccess("નવી કોલમ ઉમેરવામાં આવી!");
    } catch(err) {
      console.error(err);
      setError("કોલમ ઉમેરવામાં ભૂલ આવી.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddBusinessRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
    setError(null);
    setActionLoading(true);

    try {
      const revVal = parseFloat(bizRevenue) || 0;
      const costVal = parseFloat(bizCost) || 0;
      const expVal = parseFloat(bizExpenses) || 0;

      const customDataObj: Record<string, any> = {};

      if (selectedBiz.custom_columns) {
        selectedBiz.custom_columns.forEach(col => {
          const val = globalCustomValues[col]?.trim();
          if (val) {
             const numVal = parseFloat(val);
             customDataObj[col] = isNaN(numVal) ? val : numVal;
          }
        });
      }

      customFields.forEach(field => {
        const key = field.key.trim();
        if (key) {
          const numVal = parseFloat(field.value);
          customDataObj[key] = isNaN(numVal) ? field.value : numVal;
        }
      });

      const updatedRecord = await businessApi.saveRecord({
        business_id: selectedBiz.id,
        date: bizDate,
        cost: costVal,
        revenue: revVal,
        expenses: expVal,
        custom_data: customDataObj
      });

      setRecords((prev) => {
        const index = prev.findIndex((r) => r.date === bizDate);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = updatedRecord;
          return updated;
        }
        return [updatedRecord, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      });

      setBizCost('');
      setBizRevenue('');
      setBizExpenses('');
      setCustomFields([]);
      setGlobalCustomValues({});
      setShowRecordModal(false);
      setSuccess('માસિક હિસાબ સફળતાપૂર્વક સંગ્રહિત થયો!');
    } catch (err: any) {
      console.error(err);
      setError('માસિક પત્રક સાચવવામાં નિષ્ફળતા મળી.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
    setError(null);
    setActionLoading(true);

    try {
      const amtVal = parseFloat(invAmount) || 0;
      if (amtVal <= 0) {
        throw new Error("રકમ શૂન્ય કરતાં વધુ હોવી જોઈએ.");
      }

      const newInv = await businessApi.saveInvestment({
        business_id: selectedBiz.id,
        person_name: invPersonName,
        date: invDate,
        amount: amtVal,
        type: invType,
      });

      setInvestments((prev) => [newInv, ...prev].sort((a, b) => b.date.localeCompare(a.date)));

      setInvPersonName('');
      setInvAmount('');
      setShowInvModal(false);
      setSuccess('નોંધ સફળતાપૂર્વક ઉમેરવામાં આવી!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'માહિતી સાચવવામાં નિષ્ફળતા મળી.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInvestment = async (id: number) => {
    if (!window.confirm('શું તમે ખરેખર આ નોંધ કાઢી નાખવા માંગો છો?')) return;
    try {
      await businessApi.deleteInvestment(id);
      setInvestments(investments.filter(i => i.id !== id));
      setSuccess('નોંધ કાઢી નાખવામાં આવી છે.');
    } catch (err) {
      console.error(err);
      alert('નોંધ કાઢી નાખવામાં ભૂલ આવી છે.');
    }
  };

  // ----------------- CALCULATIONS -----------------
  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const avgExpense = expenses.length > 0 ? (totalSpent / expenses.length) : 0;

  const categoryDataMap = expenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.keys(categoryDataMap).map((cat) => ({
    name: cat,
    value: categoryDataMap[cat],
  }));

  const processedRecords = records.map((rec) => {
    const profit = rec.revenue - (rec.cost + rec.expenses);
    return {
      ...rec,
      profit,
      displayMonth: new Date(rec.date).toLocaleDateString('gu-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    };
  });

  const totalRev = processedRecords.reduce((sum, item) => sum + item.revenue, 0);
  const totalCost = processedRecords.reduce((sum, item) => sum + item.cost + item.expenses, 0);
  const netProfit = totalRev - totalCost;

  const totalInvested = investments.filter(i => i.type === 'INVESTMENT').reduce((sum, i) => sum + i.amount, 0);
  const totalWithdrawn = investments.filter(i => i.type === 'WITHDRAWAL').reduce((sum, i) => sum + i.amount, 0);

  // Greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'સુપ્રભાત';
    if (hour < 17) return 'શુભ બપોર';
    return 'શુભ સાંજ';
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <img src="/logo.png" alt="Loading" className="logo-img-large logo-loader" style={{ height: '120px', marginBottom: '20px' }} />
      </div>
    );
  }

  // Helper: Render a modal wrapper (bottom sheet on mobile, centered on desktop)
  const renderModal = (show: boolean, onClose: () => void, title: string, children: React.ReactNode, maxWidth = '500px') => {
    if (!show) return null;
    return (
      <div style={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div
          className="glass-card modal-card-sheet animate-slide-up"
          style={{
            ...styles.modalCard,
            width: isMobile ? '100%' : '90%',
            maxWidth,
            padding: isMobile ? '20px 16px 32px' : '28px',
          }}
        >
          <div style={styles.modalHeader}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title}</h3>
            <button className="btn-icon" onClick={onClose} style={{ flexShrink: 0 }}>
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.appContainer}>
      {/* ═══ MOBILE SIDEBAR DRAWER ═══ */}
      {isMobile && isMenuOpen && (
        <>
          <div className="sidebar-overlay" onClick={() => setIsMenuOpen(false)} />
          <aside className="sidebar-drawer">
            {/* Sidebar Header */}
            <div className="sidebar-header">
              <img src="/logo.png" alt="Logo" className="logo-img" style={{ height: '36px' }} />
              <button className="btn-icon" onClick={() => setIsMenuOpen(false)}>
                <X size={22} />
              </button>
            </div>

            {/* Profile Section */}
            <div className="sidebar-profile">
              <div className="sidebar-avatar">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <span className="sidebar-username">{user?.username}</span>
              <span className={`badge ${user?.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                {user?.role === 'admin' ? 'એડમિન' : 'સભ્ય'}
              </span>
            </div>

            {/* Menu Items */}
            <div className="sidebar-menu">
              <button
                className={`sidebar-menu-item ${mode === 'portal' ? 'active' : ''}`}
                onClick={() => { resetPortal(); setIsMenuOpen(false); }}
              >
                <Home size={20} />
                <span>મુખ્ય પોર્ટલ</span>
              </button>

              <button
                className={`sidebar-menu-item ${mode === 'expenses' ? 'active' : ''}`}
                onClick={() => { setMode('expenses'); setIsMenuOpen(false); setSuccess(null); setError(null); }}
              >
                <IndianRupee size={20} />
                <span>પારિવારિક ખર્ચ</span>
              </button>

              <button
                className={`sidebar-menu-item ${mode === 'business' ? 'active' : ''}`}
                onClick={() => { setMode('business'); setIsMenuOpen(false); setSuccess(null); setError(null); }}
              >
                <Briefcase size={20} />
                <span>ધંધાકીય ખાતાવહી</span>
              </button>

              <div className="sidebar-divider" />

              {/* Theme Toggle Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)' }}>થીમ બદલો</span>
                <ThemeToggle />
              </div>

              {user?.role === 'admin' && (
                <button
                  className="sidebar-menu-item"
                  onClick={() => { setIsMenuOpen(false); navigate('/dashboard/admin'); }}
                >
                  <Settings size={20} />
                  <span>એડમિન સેટિંગ્સ</span>
                </button>
              )}

              <div style={{ flex: 1 }} />

              <div className="sidebar-divider" />

              <button className="sidebar-menu-item danger" onClick={handleLogout}>
                <LogOut size={20} />
                <span>લોગઆઉટ</span>
              </button>
            </div>

            {/* Footer */}
            <div className="sidebar-footer">
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.6 }}>
                © {new Date().getFullYear()} વડસક પરિવાર
              </p>
            </div>
          </aside>
        </>
      )}

      {/* ═══ TOP NAVBAR ═══ */}
      <header
        className="glass-card"
        style={{
          ...styles.navbar,
          padding: isMobile ? '10px 16px' : '12px 32px',
          borderRadius: 0,
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={styles.navBrand} onClick={resetPortal}>
            <img src="/logo.png" alt="Logo" className="logo-img" style={{ height: isMobile ? '40px' : '48px' }} />
          </div>

          {/* Desktop nav actions */}
          {!isMobile && (
            <div style={styles.navActions}>
              <ThemeToggle />

              <div style={styles.userPill}>
                <div style={styles.avatar}>
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <div style={styles.profileText}>
                  <span style={styles.username}>{user?.username}</span>
                  <span className={`badge ${user?.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                    {user?.role === 'admin' ? 'એડમિન' : 'સભ્ય'}
                  </span>
                </div>
              </div>

              {user?.role === 'admin' && (
                <button className="btn btn-secondary" onClick={() => navigate('/dashboard/admin')} style={{ padding: '8px 14px', gap: '6px' }}>
                  <Settings size={16} /> સેટિંગ્સ
                </button>
              )}

              <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '8px 14px', gap: '6px' }}>
                <LogOut size={16} /> લોગઆઉટ
              </button>
            </div>
          )}

          {/* Mobile: menu toggle only */}
          {isMobile && (
            <button
              className="btn-icon"
              onClick={() => setIsMenuOpen(true)}
              style={{ width: '40px', height: '40px' }}
              aria-label="મેનુ ખોલો"
            >
              <Menu size={22} />
            </button>
          )}
        </div>
      </header>

      {/* ═══ BOTTOM NAV (Mobile only) ═══ */}
      {isMobile && (
        <nav className="bottom-nav">
          <button className={`bottom-nav-item ${mode === 'portal' ? 'active' : ''}`} onClick={resetPortal}>
            <Home size={22} />
            <span>હોમ</span>
          </button>
          <button className={`bottom-nav-item ${mode === 'expenses' ? 'active' : ''}`} onClick={() => { setMode('expenses'); setSuccess(null); setError(null); }}>
            <IndianRupee size={22} />
            <span>ખર્ચ</span>
          </button>
          <button className={`bottom-nav-item ${mode === 'business' ? 'active' : ''}`} onClick={() => { setMode('business'); setSuccess(null); setError(null); }}>
            <Briefcase size={22} />
            <span>ધંધો</span>
          </button>
          <button className={`bottom-nav-item`} onClick={() => setIsMenuOpen(true)}>
            <UserIcon size={22} />
            <span>મેનુ</span>
          </button>
        </nav>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <main style={{ ...styles.mainContent, padding: isMobile ? '16px 14px' : '24px 32px' }}>
        {/* Alerts */}
        {error && (
          <div className="animate-fade-in" style={styles.alertError}>
            <X size={14} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setError(null)} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="animate-fade-in" style={styles.alertSuccess}>
            <Sparkles size={14} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* ═══════════ PORTAL HOME ═══════════ */}
        {mode === 'portal' && (
          <div className="animate-slide-up" style={styles.portalContainer}>
            {/* Hero greeting */}
            <div style={styles.heroSection}>
              <p style={styles.greeting}>{getGreeting()},</p>
              <h1 style={styles.heroTitle}>{user?.username || 'વડસક પરિવાર'}</h1>
              <p style={styles.heroSubtitle}>
                પરિવારના ખર્ચાઓ અથવા ધંધાકીય ખાતાવહી સંચાલન કરવા માટે પસંદગી કરો.
              </p>
            </div>



            {/* Choice Cards */}
            <div className="portal-grid">
              <div
                className="glass-card portal-choice-card expenses"
                onClick={() => { setMode('expenses'); setSuccess(null); setError(null); }}
              >
                <div style={{ ...styles.choiceIconBox, background: 'var(--primary-muted)', borderColor: 'var(--primary)' }}>
                  <Home size={28} color="var(--primary)" />
                </div>
                <div style={isMobile ? { flex: 1 } : { textAlign: 'center' }}>
                  <h3 style={styles.choiceCardTitle}>પારિવારિક ખર્ચ</h3>
                  <p style={styles.choiceCardDesc}>
                    પરિવારના સભ્યોના ખર્ચાઓનું દૈનિક અને માસિક પત્રક.
                  </p>
                  <span className="badge badge-primary" style={{ marginTop: '8px' }}>
                    {members.length} સભ્યો
                  </span>
                </div>
                {isMobile && <ChevronRight size={20} color="var(--text-muted)" />}
              </div>

              <div
                className="glass-card portal-choice-card business"
                onClick={() => { setMode('business'); setSuccess(null); setError(null); }}
              >
                <div style={{ ...styles.choiceIconBox, background: 'rgba(96, 165, 250, 0.1)', borderColor: 'var(--secondary)' }}>
                  <Briefcase size={28} color="var(--secondary)" />
                </div>
                <div style={isMobile ? { flex: 1 } : { textAlign: 'center' }}>
                  <h3 style={styles.choiceCardTitle}>ધંધાકીય ખાતાવહી</h3>
                  <p style={styles.choiceCardDesc}>
                    ધંધાની માસિક આવક-જાવક અને હિસાબી નોંધ.
                  </p>
                  <span className="badge badge-secondary" style={{ marginTop: '8px' }}>
                    {businesses.length} ધંધાઓ
                  </span>
                </div>
                {isMobile && <ChevronRight size={20} color="var(--text-muted)" />}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ FAMILY MEMBER SELECTION ═══════════ */}
        {mode === 'expenses' && !selectedMember && (
          <div className="animate-slide-up" style={styles.subPageContainer}>
            <button className="back-navigation-btn" onClick={resetPortal}>
              <ArrowLeft size={16} />
              <span>મુખ્ય પોર્ટલ</span>
            </button>

            <h2 style={styles.sectionTitle}>પારિવારિક સભ્યો</h2>
            <p style={styles.sectionSubtitle}>ખર્ચની વિગતો જોવા સભ્ય પસંદ કરો.</p>

            <div className="layout-grid stagger-children" style={{ marginTop: '20px' }}>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="glass-card-interactive selection-avatar-card"
                  onClick={() => setSelectedMember(m)}
                >
                  <div className="selection-avatar-badge">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{m.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '12px' }}>પરિવારના સભ્ય</p>
                  <button className="btn btn-secondary" style={{ padding: '6px 16px', fontSize: '0.8rem' }}>
                    પત્રક જુઓ <ChevronRight size={14} />
                  </button>
                </div>
              ))}
              {members.length === 0 && (
                <div className="glass-card empty-state" style={{ gridColumn: '1/-1' }}>
                  <UserIcon size={40} />
                  <p>કોઈ સભ્ય નોંધાયેલ નથી. એડમિન સેટિંગ્સમાં સભ્યોના નામ ઉમેરો.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ EXPENSE DETAIL ═══════════ */}
        {mode === 'expenses' && selectedMember && (
          <div className="animate-slide-up" style={styles.subPageContainer}>
            <button className="back-navigation-btn" onClick={() => { setSelectedMember(null); setSuccess(null); setError(null); }}>
              <ArrowLeft size={16} />
              <span>સભ્યોની યાદી</span>
            </button>

            {/* Entity Banner */}
            <div className="glass-card" style={{ ...styles.entityBanner, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', padding: isMobile ? '14px' : '16px 20px' }}>
              <div className="selection-avatar-badge" style={{ margin: 0, width: '44px', height: '44px', fontSize: '1.1rem' }}>
                {selectedMember.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem' }}>{selectedMember.name}નું ખર્ચ પત્રક</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>માસિક ફાળવણી અને વિવિધ શ્રેણીઓના ખર્ચ.</p>
              </div>
            </div>

            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '14px', marginTop: '16px' }}>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>કુલ ખર્ચ</span>
                <h3 style={{ ...styles.metricVal, color: 'var(--primary)' }}>₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</h3>
              </div>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>કુલ એન્ટ્રીઓ</span>
                <h3 style={styles.metricVal}>{expenses.length}</h3>
              </div>
              {!isMobile && (
                <div className="glass-card" style={styles.metricCard}>
                  <span style={styles.metricLabel}>સરેરાશ</span>
                  <h3 style={styles.metricVal}>₹{avgExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
                </div>
              )}
            </div>

            {/* FAB for adding expense (mobile) / Button (desktop) */}
            {(user?.role === 'admin' || (selectedMember.allowed_user_ids || []).includes(user?.id as number)) && (
              isMobile ? (
                <button className="fab" onClick={() => setShowExpenseModal(true)} aria-label="નવો ખર્ચ ઉમેરો">
                  <Plus size={24} />
                </button>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
                    <Plus size={16} /> નવો ખર્ચ ઉમેરો
                  </button>
                </div>
              )
            )}

            {/* Chart */}
            <div className="glass-card" style={{ padding: isMobile ? '16px' : '20px', marginTop: '16px' }}>
              <h3 style={styles.cardTitle}>કેટેગરી મુજબ ખર્ચ</h3>
              {expenses.length === 0 ? (
                <div className="empty-state">
                  <PieIcon size={40} />
                  <p>ગ્રાફ પ્રદર્શિત કરવા ડેટા નથી.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '8px', fontSize: '0.8rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={styles.legendGrid}>
                    {pieChartData.map((item, index) => (
                      <div key={item.name} style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: COLORS[index % COLORS.length] }}></span>
                        <span style={styles.legendText}>{item.name}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', marginLeft: 'auto' }}>₹{item.value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Expense List — Card-based on mobile, Table on desktop */}
            <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '16px' }}>
              <h3 style={styles.cardTitle}>ખર્ચ પત્રક</h3>
              {expenses.length === 0 ? (
                <div className="empty-state">
                  <FileText size={40} />
                  <p>હજુ સુધી કોઈ ખર્ચ નોંધાયેલ નથી.</p>
                </div>
              ) : isMobile ? (
                /* Mobile: Card list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {expenses.map((exp) => (
                    <div key={exp.id} style={styles.expenseCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{exp.category}</span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {exp.description || 'કોઈ નોંધ નથી'}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                            <Calendar size={11} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {new Date(exp.date).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>
                            ₹{exp.amount.toLocaleString('en-IN')}
                          </span>
                          {(user?.role === 'admin' || exp.added_by === user?.id) && (
                            <button className="btn-icon" style={{ color: 'var(--error)', width: '28px', height: '28px' }} onClick={() => handleDeleteExpense(exp.id)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop: Table */
                <div style={styles.tableResponsive}>
                  <table>
                    <thead>
                      <tr>
                        <th>તારીખ</th>
                        <th>કેટેગરી</th>
                        <th>વિગત / નોંધ</th>
                        <th>રકમ</th>
                        <th>કાર્ય</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((exp) => (
                        <tr key={exp.id}>
                          <td>{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                          <td><span className="badge badge-primary">{exp.category}</span></td>
                          <td>{exp.description || 'કોઈ નોંધ નથી'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{exp.amount.toLocaleString('en-IN')}</td>
                          <td>
                            {(user?.role === 'admin' || exp.added_by === user?.id) && (
                              <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleDeleteExpense(exp.id)}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ BUSINESS SELECTION ═══════════ */}
        {mode === 'business' && !selectedBiz && (
          <div className="animate-slide-up" style={styles.subPageContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
              <button className="back-navigation-btn" onClick={resetPortal}>
                <ArrowLeft size={16} />
                <span>મુખ્ય પોર્ટલ</span>
              </button>

              {user?.role === 'admin' && !isMobile && (
                <button className="btn btn-primary" onClick={() => setShowBizModal(true)}>
                  <Plus size={16} /> નવો ધંધો
                </button>
              )}
            </div>

            <h2 style={styles.sectionTitle}>નોંધાયેલા ધંધાઓ</h2>
            <p style={styles.sectionSubtitle}>હિસાબ જોવા ધંધાનું નામ પસંદ કરો.</p>

            {/* FAB for mobile */}
            {user?.role === 'admin' && isMobile && (
              <button className="fab" onClick={() => setShowBizModal(true)} aria-label="નવો ધંધો">
                <Plus size={24} />
              </button>
            )}

            <div className="layout-grid stagger-children" style={{ marginTop: '20px' }}>
              {businesses.map((biz) => (
                <div
                  key={biz.id}
                  className="glass-card-interactive"
                  style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '160px' }}
                  onClick={() => setSelectedBiz(biz)}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(96, 165, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LayoutGrid size={20} color="var(--secondary)" />
                      </div>
                      {(user?.role === 'admin' || biz.manager_id === user?.id) && (
                        <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={(e) => handleDeleteBusiness(biz.id, e)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.1rem', marginTop: '12px' }}>{biz.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{biz.description || 'કોઈ વિગત નથી.'}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>પત્રક ખોલો</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
              {businesses.length === 0 && (
                <div className="glass-card empty-state" style={{ gridColumn: '1/-1' }}>
                  <Briefcase size={40} />
                  <p>કોઈ ધંધો નોંધાયેલ નથી. નવો ધંધો ઉમેરો.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ BUSINESS DETAIL ═══════════ */}
        {mode === 'business' && selectedBiz && (
          <div className="animate-slide-up" style={styles.subPageContainer}>
            <button className="back-navigation-btn" onClick={() => { setSelectedBiz(null); setSuccess(null); setError(null); }}>
              <ArrowLeft size={16} />
              <span>ધંધાઓની યાદી</span>
            </button>

            {/* Entity Banner */}
            <div className="glass-card" style={{ marginTop: '12px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '14px', padding: isMobile ? '14px' : '16px 20px' }}>
              <div className="selection-avatar-badge" style={{ margin: 0, width: '44px', height: '44px', fontSize: '1.1rem', background: 'linear-gradient(135deg, var(--secondary), var(--accent))' }}>
                <Briefcase size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem' }}>{selectedBiz.name} ખાતાવહી</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{selectedBiz.description || 'ધંધાકીય હિસાબ સંચાલન'}</p>
              </div>
            </div>

            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '14px', marginTop: '16px' }}>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>કુલ આવક</span>
                <h3 style={{ ...styles.metricVal, color: 'var(--success)' }}>₹{totalRev.toLocaleString('en-IN')}</h3>
              </div>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>કુલ ખર્ચ</span>
                <h3 style={{ ...styles.metricVal, color: 'var(--error)' }}>₹{totalCost.toLocaleString('en-IN')}</h3>
              </div>
              <div className="glass-card" style={{ ...styles.metricCard, gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                <span style={styles.metricLabel}>ચોખ્ખો નફો</span>
                <h3 style={{ ...styles.metricVal, color: netProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  ₹{netProfit.toLocaleString('en-IN')}
                </h3>
              </div>
            </div>

            {/* Investment Summary */}
            <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
              <h3 style={{ ...styles.cardTitle, marginBottom: '12px' }}>રોકાણ અને ઉપાડ</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={styles.investStatCard}>
                  <ArrowUpRight size={16} color="var(--success)" />
                  <div>
                    <span style={{ ...styles.metricLabel, fontSize: '0.7rem' }}>કુલ રોકાણ</span>
                    <h4 style={{ ...styles.metricVal, fontSize: '1.1rem', color: 'var(--success)' }}>₹{totalInvested.toLocaleString('en-IN')}</h4>
                  </div>
                </div>
                <div style={styles.investStatCard}>
                  <ArrowDownRight size={16} color="var(--error)" />
                  <div>
                    <span style={{ ...styles.metricLabel, fontSize: '0.7rem' }}>કુલ ઉપાડ</span>
                    <h4 style={{ ...styles.metricVal, fontSize: '1.1rem', color: 'var(--error)' }}>₹{totalWithdrawn.toLocaleString('en-IN')}</h4>
                  </div>
                </div>
                <div style={styles.investStatCard}>
                  <DollarSign size={16} color="var(--secondary)" />
                  <div>
                    <span style={{ ...styles.metricLabel, fontSize: '0.7rem' }}>બાકી</span>
                    <h4 style={{ ...styles.metricVal, fontSize: '1.1rem', color: 'var(--secondary)' }}>₹{(totalInvested - totalWithdrawn).toLocaleString('en-IN')}</h4>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons (desktop) / FAB (mobile) */}
            {(user?.role === 'admin' || selectedBiz.manager_id === user?.id) && (
              isMobile ? (
                <button className="fab" onClick={() => setShowRecordModal(true)} aria-label="માસિક વિગતો">
                  <Plus size={24} />
                </button>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', gap: '10px' }}>
                  <button className="btn btn-primary" onClick={() => setShowRecordModal(true)}>
                    <Plus size={16} /> માસિક વિગતો
                  </button>
                </div>
              )
            )}

            {/* Business Ledger Table */}
            <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ ...styles.cardTitle, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>માસિક પત્રક</h3>
                <button className="btn btn-secondary" onClick={() => setShowAddColumnModal(true)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  <Plus size={14} /> કોલમ
                </button>
              </div>
              {processedRecords.length === 0 ? (
                <div className="empty-state">
                  <FileText size={40} />
                  <p>કોઈ માસિક એન્ટ્રી નથી.</p>
                </div>
              ) : (
                <div style={styles.tableResponsive}>
                  <table style={{ minWidth: isMobile ? '700px' : '100%' }}>
                    <thead>
                      <tr>
                        <th>તારીખ</th>
                        <th>વેચાણ આવક</th>
                        <th>માલ ખરીદી</th>
                        <th>સંચાલન ખર્ચ</th>
                        {selectedBiz.custom_columns?.map((col: string) => (
                          <th key={col}>{col}</th>
                        ))}
                        <th>અન્ય વિશિષ્ટ</th>
                        <th>નફો / નુકસાન</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedRecords.map((rec) => (
                        <tr key={rec.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {new Date(rec.date).toString() === 'Invalid Date' ? rec.date : new Date(rec.date).toLocaleDateString('en-IN')}
                          </td>
                          <td style={{ color: 'var(--success)' }}>₹{rec.revenue.toLocaleString('en-IN')}</td>
                          <td>₹{rec.cost.toLocaleString('en-IN')}</td>
                          <td>₹{rec.expenses.toLocaleString('en-IN')}</td>
                          {selectedBiz.custom_columns?.map((col: string) => (
                            <td key={col}>
                              {rec.custom_data && rec.custom_data[col] !== undefined 
                                ? (typeof rec.custom_data[col] === 'number' ? `₹${rec.custom_data[col].toLocaleString('en-IN')}` : rec.custom_data[col]) 
                                : '-'}
                            </td>
                          ))}
                          <td>
                            {(() => {
                              const otherData = { ...(rec.custom_data || {}) };
                              selectedBiz.custom_columns?.forEach((col: string) => delete otherData[col]);
                              const keys = Object.keys(otherData);
                              if (keys.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>;
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {keys.map((k) => (
                                    <span key={k} style={{ fontSize: '0.7rem', background: 'var(--primary-muted)', padding: '1px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                      <strong>{k}:</strong> {otherData[k]}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ fontWeight: 700, color: rec.profit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                            ₹{rec.profit.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Investments Table */}
            <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ ...styles.cardTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>રોકાણ / ઉપાડ</h3>
                <button className="btn btn-primary" onClick={() => setShowInvModal(true)} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                  <Plus size={14} /> ઉમેરો
                </button>
              </div>

              {investments.length === 0 ? (
                <div className="empty-state">
                  <TrendingUp size={40} />
                  <p>કોઈ નોંધ નથી.</p>
                </div>
              ) : isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {investments.map((inv) => (
                    <div key={inv.id} style={styles.expenseCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{inv.person_name}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            {inv.type === 'INVESTMENT' ? (
                              <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>રોકાણ</span>
                            ) : (
                              <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>ઉપાડ</span>
                            )}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(inv.date).toLocaleDateString('en-IN')}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: inv.type === 'INVESTMENT' ? 'var(--success)' : 'var(--error)', fontFamily: 'var(--font-heading)' }}>
                            ₹{inv.amount.toLocaleString('en-IN')}
                          </span>
                          <button className="btn-icon" style={{ color: 'var(--error)', width: '28px', height: '28px' }} onClick={() => handleDeleteInvestment(inv.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.tableResponsive}>
                  <table>
                    <thead>
                      <tr>
                        <th>તારીખ</th>
                        <th>વ્યક્તિ</th>
                        <th>પ્રકાર</th>
                        <th>રકમ</th>
                        <th>કાર્ય</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ color: 'var(--text-main)' }}>{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{inv.person_name}</td>
                          <td>
                            {inv.type === 'INVESTMENT' ? (
                              <span className="badge badge-success">રોકાણ</span>
                            ) : (
                              <span className="badge badge-danger">ઉપાડ</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, color: inv.type === 'INVESTMENT' ? 'var(--success)' : 'var(--error)' }}>
                            ₹{inv.amount.toLocaleString('en-IN')}
                          </td>
                          <td>
                            <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleDeleteInvestment(inv.id)}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Performance Chart */}
            <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
              <h3 style={styles.cardTitle}>આવક અને નફાકારકતા</h3>
              {processedRecords.length === 0 ? (
                <div className="empty-state">
                  <TrendingUp size={40} />
                  <p>પૂરતો ડેટા નથી.</p>
                </div>
              ) : (
                <div style={{ height: '240px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...processedRecords].reverse()} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevPortal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--success)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProfitPortal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
                      <XAxis dataKey="displayMonth" stroke="var(--text-muted)" fontSize={10} />
                      <YAxis stroke="var(--text-muted)" fontSize={10} />
                      <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '8px', fontSize: '0.8rem' }} />
                      <Area type="monotone" dataKey="revenue" stroke="var(--success)" fillOpacity={1} fill="url(#colorRevPortal)" name="આવક" />
                      <Area type="monotone" dataKey="profit" stroke="var(--primary)" fillOpacity={1} fill="url(#colorProfitPortal)" name="નફો" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ═══════════ MODALS ═══════════ */}

      {/* Add Business Modal */}
      {renderModal(showBizModal, () => setShowBizModal(false), 'નવો ધંધો રજીસ્ટર કરો',
        <form onSubmit={handleCreateBusiness} style={styles.form}>
          <div className="form-group">
            <label className="form-label">ધંધાનું નામ</label>
            <input type="text" className="input-field" placeholder="દા.ત. વ્રજ કાપડ ઉદ્યોગ" value={bizName} onChange={(e) => setBizName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">વિગત / વર્ણન</label>
            <textarea className="input-field" placeholder="ધંધો કયા પ્રકારનો છે..." value={bizDesc} onChange={(e) => setBizDesc(e.target.value)} style={{ minHeight: '70px' }} />
          </div>
          <div className="form-group">
            <label className="form-label">સંચાલક</label>
            <select className="input-field" value={bizManagerId} onChange={(e) => setBizManagerId(e.target.value)}>
              <option value="">-- સંચાલક પસંદ કરો --</option>
              {allUsers.map(u => (<option key={u.id} value={u.id}>{u.username} ({u.role === 'admin' ? 'એડમિન' : 'સભ્ય'})</option>))}
            </select>
          </div>
          <div style={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowBizModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>રજીસ્ટર કરો</button>
          </div>
        </form>,
        '450px'
      )}

      {/* Add Business Record Modal */}
      {renderModal(showRecordModal && !!selectedBiz, () => setShowRecordModal(false), `માસિક વિગતો (${selectedBiz?.name || ''})`,
        <form onSubmit={handleAddBusinessRecord} style={{ ...styles.form, marginTop: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label className="form-label">તારીખ</label><input type="date" className="input-field" value={bizDate} onChange={(e) => setBizDate(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">કુલ આવક</label><input type="number" step="0.01" className="input-field" placeholder="આવક" value={bizRevenue} onChange={(e) => setBizRevenue(e.target.value)} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label className="form-label">માલ ખરીદી ખર્ચ</label><input type="number" step="0.01" className="input-field" placeholder="ખરીદી" value={bizCost} onChange={(e) => setBizCost(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">સંચાલન ખર્ચ</label><input type="number" step="0.01" className="input-field" placeholder="સંચાલન" value={bizExpenses} onChange={(e) => setBizExpenses(e.target.value)} required /></div>
          </div>

          {selectedBiz?.custom_columns && selectedBiz.custom_columns.length > 0 && (
            <>
              <h4 style={{ margin: '12px 0 8px', fontSize: '0.85rem' }}>કોલમની વિગતો</h4>
              <div className="formGrid">
                {selectedBiz.custom_columns.map((col: string) => (
                  <div className="form-group" key={col}>
                    <label className="form-label">{col}</label>
                    <input type="number" step="0.01" className="input-field" placeholder="રકમ" value={globalCustomValues[col] || ''} onChange={(e) => setGlobalCustomValues({...globalCustomValues, [col]: e.target.value})} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Custom Fields Builder */}
          <div style={{ border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '12px', marginTop: '8px', background: 'var(--bg-input)' }}>
            <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>વધારાની વિગતો</label>
            {customFields.length > 0 && (
              <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {customFields.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                    <span><strong>{f.key}:</strong> {f.value}</span>
                    <button type="button" onClick={() => handleRemoveCustomField(i)} className="btn-icon" style={{ color: 'var(--error)', width: '24px', height: '24px' }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="text" className="input-field" placeholder="નામ" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: '0.8rem' }} />
              <input type="number" step="0.01" className="input-field" placeholder="રકમ" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: '0.8rem' }} />
              <button type="button" className="btn btn-secondary" onClick={handleAddCustomField} style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '0.8rem' }}><Plus size={14} /></button>
            </div>
          </div>

          <div style={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowRecordModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>સાચવો</button>
          </div>
        </form>,
        '700px'
      )}

      {/* Add Expense Modal */}
      {renderModal(showExpenseModal && !!selectedMember, () => setShowExpenseModal(false), `નવો ખર્ચ (${selectedMember?.name || ''})`,
        <form onSubmit={handleAddExpense} style={{ ...styles.form, marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">ખર્ચની રકમ (₹)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <IndianRupee size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input type="number" step="0.01" className="input-field" placeholder="રકમ" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ paddingLeft: '36px' }} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">કેટેગરી</label>
              <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">તારીખ</label>
              <input type="date" className="input-field" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">વિગત / નોંધ</label>
            <textarea className="input-field" placeholder="ખર્ચ કઈ બાબતમાં..." value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: '60px' }} />
          </div>
          <div style={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>સાચવો</button>
          </div>
        </form>,
        '550px'
      )}

      {/* Add Investment Modal */}
      {renderModal(showInvModal && !!selectedBiz, () => setShowInvModal(false), 'રોકાણ / ઉપાડ',
        <form onSubmit={handleAddInvestment} style={{ ...styles.form, marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">વ્યક્તિનું નામ</label>
            <input type="text" className="input-field" placeholder="નામ" value={invPersonName} onChange={(e) => setInvPersonName(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">પ્રકાર</label>
              <select className="input-field" value={invType} onChange={(e) => setInvType(e.target.value as "INVESTMENT" | "WITHDRAWAL")} required>
                <option value="INVESTMENT">રોકાણ (Invested)</option>
                <option value="WITHDRAWAL">ઉપાડ (Get back)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">તારીખ</label>
              <input type="date" className="input-field" value={invDate} onChange={(e) => setInvDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">રકમ</label>
            <input type="number" step="0.01" className="input-field" placeholder="રકમ" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} required />
          </div>
          <div style={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowInvModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>સાચવો</button>
          </div>
        </form>,
        '480px'
      )}

      {/* Add Column Modal */}
      {renderModal(showAddColumnModal && !!selectedBiz, () => setShowAddColumnModal(false), 'નવી કોલમ',
        <form onSubmit={handleAddGlobalColumn} style={{ ...styles.form, marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">કોલમનું નામ</label>
            <input type="text" className="input-field" placeholder="દા.ત. Diamond Duty" value={newGlobalColumnName} onChange={(e) => setNewGlobalColumnName(e.target.value)} required />
          </div>
          <div style={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddColumnModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>ઉમેરો</button>
          </div>
        </form>,
        '400px'
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    width: '100%',
  },
  loadingContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbar: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    zIndex: 90,
    position: 'sticky',
    top: 0,
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-glass)',
    padding: '6px 14px',
    borderRadius: 'var(--radius-full)',
  },
  avatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'var(--primary-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: 'var(--primary)',
    fontFamily: 'var(--font-heading)',
  },
  profileText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
  },
  username: {
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  mainContent: {
    flex: 1,
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
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
    marginBottom: '12px',
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
    marginBottom: '12px',
  },

  /* Portal */
  portalContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center',
    padding: '20px 0',
  },
  heroSection: {
    marginBottom: '20px',
  },
  greeting: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    marginBottom: '4px',
  },
  heroTitle: {
    fontSize: '2rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    marginBottom: '8px',
    letterSpacing: '-0.03em',
  },
  heroSubtitle: {
    color: 'var(--text-muted)',
    maxWidth: '500px',
    fontSize: '0.9rem',
    lineHeight: '1.5',
  },
  quickStat: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 18px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-glass)',
    borderRadius: 'var(--radius-full)',
  },
  quickStatValue: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--primary)',
    fontFamily: 'var(--font-heading)',
  },
  quickStatLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  choiceIconBox: {
    width: '56px',
    height: '56px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  choiceCardTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    marginBottom: '6px',
  },
  choiceCardDesc: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    lineHeight: '1.4',
  },

  /* Sub pages */
  subPageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginTop: '16px',
  },
  sectionSubtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    marginTop: '4px',
  },
  entityBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginTop: '12px',
  },
  metricCard: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metricLabel: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
    fontWeight: 600,
    fontFamily: 'var(--font-heading)',
  },
  metricVal: {
    fontSize: '1.4rem',
    fontWeight: 800,
    fontFamily: 'var(--font-heading)',
  },
  investStatCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'var(--bg-surface-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-glass)',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: '12px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '8px',
  },

  /* Expense Card (mobile) */
  expenseCard: {
    padding: '12px 14px',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-glass)',
    borderRadius: 'var(--radius-md)',
    transition: 'var(--transition-smooth)',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  /* Legend */
  legendGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '12px',
    width: '100%',
    maxWidth: '320px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  /* Table */
  tableResponsive: {
    overflowX: 'auto',
    width: '100%',
    WebkitOverflowScrolling: 'touch',
  },

  /* Modal */
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '20px',
  },
  modalCard: {
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '16px',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
  },
};
