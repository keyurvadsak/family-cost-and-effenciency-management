import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, familyApi, expenseApi, businessApi } from '../api';
import type { User, FamilyMember, FamilyExpense, Business, BusinessRecord } from '../api';
import {
  ArrowLeft, Home, Briefcase, Settings, LogOut,
  Plus, Trash2, IndianRupee, Sparkles,
  LayoutGrid, X, TrendingUp, PieChart as PieIcon, Menu
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import ThemeToggle from '../components/ThemeToggle';

// Config constants in Gujarati
const CATEGORIES = ['કરિયાણું', 'બિલ (લાઈટ/ફોન)', 'શિક્ષણ', 'તબીબી / દવાઓ', 'રોકાણ', 'મનોરંજન / જમવું', 'અન્ય ખર્ચ'];
const COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#9ca3af'];

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

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <img src="/logo.png" alt="Loading" className="logo-img-large logo-loader" style={{ height: '140px', marginBottom: '20px' }} />
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Top Navbar */}
      <header style={{ ...styles.navbar, padding: isMobile ? '12px 16px' : '16px 40px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }} className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
          <div style={styles.navBrand} onClick={resetPortal}>
            <img src="/logo.png" alt="Logo" className="logo-img" style={{ height: '56px' }} />
          </div>
          {isMobile && (
            <button className="btn-icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
        </div>

        <div style={{
          ...styles.navActions,
          display: isMobile ? (isMenuOpen ? 'flex' : 'none') : 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '16px',
          marginTop: isMobile && isMenuOpen ? '16px' : '0',
          width: isMobile ? '100%' : 'auto',
          alignItems: isMobile ? 'stretch' : 'center',
          borderTop: isMobile && isMenuOpen ? '1px solid var(--border-glass)' : 'none',
          paddingTop: isMobile && isMenuOpen ? '16px' : '0'
        }}>
          <div style={{ alignSelf: isMobile ? 'center' : 'auto' }}>
            <ThemeToggle style={{ position: 'relative', top: 'auto', right: 'auto', border: '1px solid var(--border-glass)' }} />
          </div>

          <div style={{ ...styles.userSection, padding: '6px 12px', gap: '10px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
            <div style={styles.avatar}>
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div style={styles.profileText}>
              <span style={{ ...styles.username, fontSize: '0.85rem' }}>{user?.username}</span>
              <span className={`badge ${user?.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                {user?.role === 'admin' ? 'એડમિન' : 'સભ્ય'}
              </span>
            </div>
          </div>

          {user?.role === 'admin' && (
            <button
              className="btn btn-secondary"
              onClick={() => { setIsMenuOpen(false); navigate('/dashboard/admin'); }}
              style={{ padding: '10px 14px', width: isMobile ? '100%' : 'auto' }}
            >
              <Settings size={16} />
              <span style={styles.btnText}>સેટિંગ્સ</span>
            </button>
          )}

          <button
            className="btn btn-danger"
            onClick={handleLogout}
            style={{ padding: '10px 14px', width: isMobile ? '100%' : 'auto' }}
          >
            <LogOut size={16} />
            <span style={styles.btnText}>લોગઆઉટ</span>
          </button>
        </div>
      </header>

      {/* Main Content Space */}
      <main style={{ ...styles.mainContent, padding: isMobile ? '16px 12px' : '30px 40px' }}>
        {/* Alerts */}
        {error && (
          <div className="glass-card animate-slide-up" style={styles.alertError}>
            <X size={16} style={{ cursor: 'pointer' }} onClick={() => setError(null)} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="glass-card animate-slide-up" style={styles.alertSuccess}>
            <Sparkles size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* ================= PHASE 1: CHOICE SCREEN ================= */}
        {mode === 'portal' && (
          <div style={{ ...styles.portalChoiceContainer, minHeight: isMobile ? '50vh' : '70vh' }} className="animate-slide-up">
            <h1 style={{ ...styles.portalTitle, fontSize: isMobile ? '1.8rem' : '2.5rem' }}>વડસક પરિવાર</h1>
            <p style={{ ...styles.portalSubtitle, fontSize: isMobile ? '0.85rem' : '1rem' }}>પરિવારના સભ્યોના ખર્ચાઓ અથવા ધંધાની માસિક આવક-જાવક સંચાલન કરવા માટે નીચેનામાંથી પસંદગી કરો.</p>

            <div className="portal-grid">
              <div
                className="glass-card portal-choice-card expenses"
                onClick={() => { setMode('expenses'); setSuccess(null); setError(null); }}
              >
                <div style={{ ...styles.choiceIconBox, background: 'rgba(139, 92, 246, 0.15)', borderColor: 'var(--primary)' }}>
                  <Home size={36} color="var(--primary)" />
                </div>
                <h3 style={styles.choiceCardTitle}>પારિવારિક ખર્ચ</h3>
                <p style={styles.choiceCardDesc}>
                  પરિવારના સભ્યોના ઘર વપરાશ અને અન્ય વ્યક્તિગત ખર્ચાઓનું દૈનિક અને માસિક પત્રક.
                </p>
                <span className="badge badge-primary" style={{ marginTop: '10px' }}>
                  {members.length} મોભી સભ્યો
                </span>
              </div>

              <div
                className="glass-card portal-choice-card business"
                onClick={() => { setMode('business'); setSuccess(null); setError(null); }}
              >
                <div style={{ ...styles.choiceIconBox, background: 'rgba(6, 182, 212, 0.15)', borderColor: 'var(--secondary)' }}>
                  <Briefcase size={36} color="var(--secondary)" />
                </div>
                <h3 style={styles.choiceCardTitle}>ધંધાકીય ખાતાવહી</h3>
                <p style={styles.choiceCardDesc}>
                  ધંધાની માસિક આવક, માલસામાનની ખરીદી અને ઓફિસ સંચાલન ખર્ચાઓની હિસાબી નોંધ.
                </p>
                <span className="badge badge-secondary" style={{ marginTop: '10px' }}>
                  {businesses.length} નોંધાયેલા ધંધાઓ
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================= PHASE 2: FAMILY SELECTION GRID ================= */}
        {mode === 'expenses' && !selectedMember && (
          <div className="animate-slide-up" style={styles.subPageContainer}>
            <button className="back-navigation-btn" onClick={resetPortal}>
              <ArrowLeft size={16} />
              <span>મુખ્ય પોર્ટલ પર પાછા જાઓ</span>
            </button>

            <h2 style={styles.sectionTitle}>પારિવારિક સભ્યોની યાદી</h2>
            <p style={styles.sectionSubtitle}>જે સભ્યના ખર્ચની વિગતો જોવી અથવા ઉમેરવી હોય તેમના કાર્ડ પર ક્લિક કરો.</p>

            <div className="layout-grid" style={{ marginTop: '24px' }}>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="glass-card-interactive selection-avatar-card"
                  onClick={() => setSelectedMember(m)}
                >
                  <div className="selection-avatar-badge">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{m.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>પરિવારના સભ્ય</p>
                  <button className="btn btn-secondary" style={{ marginTop: '16px', padding: '6px 14px', fontSize: '0.85rem' }}>
                    પત્રક જુઓ
                  </button>
                </div>
              ))}
              {members.length === 0 && (
                <div className="glass-card" style={{ padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)' }}>કોઈ સભ્ય હજી નોંધાયેલ નથી. એડમિન સેટિંગ્સમાં જઈને સભ્યોના નામ ઉમેરી શકે છે.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PHASE 3: EXPENSE DRILL DOWN ================= */}
        {mode === 'expenses' && selectedMember && (
          <div className="animate-slide-up" style={styles.subPageContainer}>
            <button className="back-navigation-btn" onClick={() => { setSelectedMember(null); setSuccess(null); setError(null); }}>
              <ArrowLeft size={16} />
              <span>સભ્યોની યાદી પર પાછા જાઓ</span>
            </button>

            <div className="glass-card" style={{ ...styles.entityBanner, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', padding: isMobile ? '12px 16px' : '16px 24px' }}>
              <div className="selection-avatar-badge" style={{ margin: 0, width: '50px', height: '50px', fontSize: '1.3rem' }}>
                {selectedMember.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: isMobile ? '1.2rem' : '1.4rem' }}>{selectedMember.name}નું ખર્ચ પત્રક</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>માસિક ફાળવણી અને વિવિધ શ્રેણીઓના ખર્ચનું સંચાલન.</p>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="layout-grid" style={{ marginTop: '24px' }}>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>કુલ નોંધાયેલ ખર્ચ</span>
                <h3 style={styles.metricVal}>₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>કુલ એન્ટ્રીઓ</span>
                <h3 style={styles.metricVal}>{expenses.length} નોંધ</h3>
              </div>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>સરેરાશ ખર્ચ એન્ટ્રી</span>
                <h3 style={styles.metricVal}>₹{avgExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              </div>
            </div>

            {/* Action Bar for Manager/Admin */}
            {(user?.role === 'admin' || (selectedMember.allowed_user_ids || []).includes(user?.id as number)) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
                  <Plus size={16} /> નવો ખર્ચ ઉમેરો
                </button>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

              {/* Chart Card */}
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={styles.cardTitle}>કેટેગરી મુજબ ખર્ચનું વિતરણ</h3>
                {expenses.length === 0 ? (
                  <div style={styles.noData}>
                    <PieIcon size={48} color="var(--border-glass-active)" />
                    <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>ગ્રાફ પ્રદર્શિત કરવા કોઈ ડેટા નથી.</p>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
                        <Tooltip contentStyle={{ background: '#121426', border: '1px solid var(--border-glass)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={styles.legendGrid}>
                      {pieChartData.map((item, index) => (
                        <div key={item.name} style={styles.legendItem}>
                          <span style={{ ...styles.legendDot, background: COLORS[index % COLORS.length] }}></span>
                          <span style={styles.legendText}>{item.name}: ₹{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Transactions Ledger Table */}
            <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
              <h3 style={styles.cardTitle}>ખર્ચ પત્રકની હિસાબી વિગતો</h3>
              {expenses.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>હજુ સુધી કોઈ ખર્ચ નોંધાયેલ નથી.</p>
              ) : (
                <div style={styles.tableResponsive}>
                  <table style={{ ...styles.table, minWidth: isMobile ? '550px' : '100%' }}>
                    <thead>
                      <tr>
                        <th style={styles.th}>તારીખ</th>
                        <th style={styles.th}>કેટેગરી</th>
                        <th style={styles.th}>વિગત / નોંધ</th>
                        <th style={styles.th}>રકમ</th>
                        <th style={styles.th}>કાર્યવહી</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((exp) => (
                        <tr key={exp.id} style={styles.tr}>
                          <td style={styles.td}>{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                          <td style={styles.td}>
                            <span className="badge badge-primary">{exp.category}</span>
                          </td>
                          <td style={styles.td}>{exp.description || 'કોઈ નોંધ નથી'}</td>
                          <td style={{ ...styles.td, fontWeight: 700, color: 'var(--text-main)' }}>₹{exp.amount.toLocaleString('en-IN')}</td>
                          <td style={styles.td}>
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

        {/* ================= PHASE 4: BUSINESS SELECTION GRID ================= */}
        {mode === 'business' && !selectedBiz && (
          <div className="animate-slide-up" style={styles.subPageContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <button className="back-navigation-btn" onClick={resetPortal}>
                <ArrowLeft size={16} />
                <span>મુખ્ય પોર્ટલ પર પાછા જાઓ</span>
              </button>

              <button className="btn btn-primary" onClick={() => setShowBizModal(true)}>
                <Plus size={16} /> નવો ધંધો રજીસ્ટર કરો
              </button>
            </div>

            <h2 style={styles.sectionTitle}>નોંધાયેલા ધંધાઓની યાદી</h2>
            <p style={styles.sectionSubtitle}>નાણાકીય હિસાબ પત્રકો અને ખરીદી-વેચાણનો ચાર્ટ જોવા ધંધાનું નામ પસંદ કરો.</p>

            <div className="layout-grid" style={{ marginTop: '24px' }}>
              {businesses.map((biz) => (
                <div
                  key={biz.id}
                  className="glass-card-interactive"
                  style={{ padding: '24px', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  onClick={() => setSelectedBiz(biz)}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <LayoutGrid size={24} color="var(--secondary)" />
                      {(user?.role === 'admin' || biz.manager_id === user?.id) && (
                        <button
                          className="btn-icon"
                          style={{ color: 'var(--error)' }}
                          onClick={(e) => handleDeleteBusiness(biz.id, e)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginTop: '14px' }}>{biz.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>{biz.description || 'કોઈ વિગત લખેલી નથી.'}</p>
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%', marginTop: '16px', fontSize: '0.85rem', padding: '6px' }}>
                    પત્રક ખોલો
                  </button>
                </div>
              ))}
              {businesses.length === 0 && (
                <div className="glass-card" style={{ padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)' }}>હજુ સુધી કોઈ ધંધાનું રજીસ્ટ્રેશન થયેલ નથી. નવો ધંધો ઉમેરવા ઉપરના બટન પર ક્લિક કરો.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PHASE 5: BUSINESS DRILL DOWN ================= */}
        {mode === 'business' && selectedBiz && (
          <div className="animate-slide-up" style={styles.subPageContainer}>
            <button className="back-navigation-btn" onClick={() => { setSelectedBiz(null); setSuccess(null); setError(null); }}>
              <ArrowLeft size={16} />
              <span>ધંધાઓની યાદી પર પાછા જાઓ</span>
            </button>

            <div className="glass-card" style={{ marginTop: '16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px', padding: isMobile ? '12px 16px' : '20px' }}>
              <div className="selection-avatar-badge" style={{ margin: 0, width: '50px', height: '50px', fontSize: '1.3rem', background: 'linear-gradient(135deg, var(--secondary), var(--primary))' }}>
                <Briefcase size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: isMobile ? '1.2rem' : '1.4rem' }}>{selectedBiz.name} ખાતાવહી</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedBiz.description || 'ધંધાકીય હિસાબ સંચાલન'}</p>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="layout-grid" style={{ marginTop: '24px' }}>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>કુલ માસિક આવક</span>
                <h3 style={{ ...styles.metricVal, color: 'var(--secondary-hover)' }}>₹{totalRev.toLocaleString('en-IN')}</h3>
              </div>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>કુલ માસિક ખર્ચ (ખરીદી + સંચાલન)</span>
                <h3 style={{ ...styles.metricVal, color: '#f87171' }}>₹{totalCost.toLocaleString('en-IN')}</h3>
              </div>
              <div className="glass-card" style={styles.metricCard}>
                <span style={styles.metricLabel}>ચોખ્ખો નફો (Net Profit)</span>
                <h3 style={{ ...styles.metricVal, color: netProfit >= 0 ? '#34d399' : '#f87171' }}>
                  ₹{netProfit.toLocaleString('en-IN')}
                </h3>
              </div>
            </div>

            {/* Investment Summary */}
            <div className="glass-card" style={{ padding: '20px', marginTop: '16px' }}>
              <h3 style={{ ...styles.cardTitle, marginBottom: '16px' }}>રોકાણ અને ઉપાડ</h3>
              <div className="layout-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ ...styles.metricCard, background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                  <span style={styles.metricLabel}>કુલ રોકાણ (Total Invested)</span>
                  <h3 style={{ ...styles.metricVal, color: '#34d399', marginTop: '8px' }}>
                    ₹{totalInvested.toLocaleString('en-IN')}
                  </h3>
                </div>
                <div style={{ ...styles.metricCard, background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                  <span style={styles.metricLabel}>કુલ ઉપાડ (Total Withdrawn)</span>
                  <h3 style={{ ...styles.metricVal, color: '#f87171', marginTop: '8px' }}>
                    ₹{totalWithdrawn.toLocaleString('en-IN')}
                  </h3>
                </div>
                <div style={{ ...styles.metricCard, background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                  <span style={styles.metricLabel}>બાકી રોકાણ (Remaining Balance)</span>
                  <h3 style={{ ...styles.metricVal, color: (totalInvested - totalWithdrawn) >= 0 ? '#60a5fa' : '#f87171', marginTop: '8px' }}>
                    ₹{(totalInvested - totalWithdrawn).toLocaleString('en-IN')}
                  </h3>
                </div>
              </div>
            </div>

            {/* Log monthly financials button */}
            {(user?.role === 'admin' || selectedBiz.manager_id === user?.id) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button className="btn btn-primary" onClick={() => setShowRecordModal(true)}>
                  <Plus size={16} /> માસિક નાણાકીય વિગતો ભરો
                </button>
              </div>
            )}

            {/* Ledger Table */}
            <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{...styles.cardTitle, margin: 0, borderBottom: 'none', paddingBottom: 0}}>ધંધાકીય ખાતાવહીનું માસિક પત્રક</h3>
                <button className="btn btn-secondary" onClick={() => setShowAddColumnModal(true)} style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> નવી કોલમ ઉમેરો
                </button>
              </div>
              {processedRecords.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>કોઈ માસિક એન્ટ્રી નથી.</p>
              ) : (
                <div style={styles.tableResponsive}>
                  <table style={{ ...styles.table, minWidth: isMobile ? '700px' : '100%' }}>
                    <thead>
                      <tr>
                        <th style={styles.th}>તારીખ</th>
                        <th style={styles.th}>વેચાણ આવક</th>
                        <th style={styles.th}>માલ ખરીદી ખર્ચ</th>
                        <th style={styles.th}>સંચાલન ખર્ચ</th>
                        {selectedBiz.custom_columns?.map((col: string) => (
                          <th key={col} style={styles.th}>{col}</th>
                        ))}
                        <th style={styles.th}>અન્ય વિશિષ્ટ ખર્ચ</th>
                        <th style={styles.th}>ચોખ્ખો નફો / નુકસાન</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedRecords.map((rec) => (
                        <tr key={rec.id} style={styles.tr}>
                          <td style={{ ...styles.td, fontWeight: 700, color: 'var(--text-main)' }}>
                            {new Date(rec.date).toString() === 'Invalid Date' ? rec.date : new Date(rec.date).toLocaleDateString('en-IN')}
                          </td>
                          <td style={{ ...styles.td, color: 'var(--success)' }}>₹{rec.revenue.toLocaleString('en-IN')}</td>
                          <td style={styles.td}>₹{rec.cost.toLocaleString('en-IN')}</td>
                          <td style={styles.td}>₹{rec.expenses.toLocaleString('en-IN')}</td>
                          
                          {selectedBiz.custom_columns?.map((col: string) => (
                            <td key={col} style={styles.td}>
                              {rec.custom_data && rec.custom_data[col] !== undefined 
                                ? (typeof rec.custom_data[col] === 'number' ? `₹${rec.custom_data[col].toLocaleString('en-IN')}` : rec.custom_data[col]) 
                                : '-'}
                            </td>
                          ))}
                          
                          <td style={styles.td}>
                            {(() => {
                              const otherData = { ...(rec.custom_data || {}) };
                              selectedBiz.custom_columns?.forEach((col: string) => delete otherData[col]);
                              const keys = Object.keys(otherData);
                              if (keys.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>કંઈ નથી</span>;
                              return (
                                <div style={styles.customGrid}>
                                  {keys.map((k) => (
                                    <span key={k} style={styles.customFieldBadge}>
                                      <strong>{k}:</strong> {otherData[k]}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ ...styles.td, fontWeight: 700, color: rec.profit >= 0 ? 'var(--success)' : 'var(--error)' }}>
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
            <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ ...styles.cardTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>રોકાણ અને ઉપાડ</h3>
                <button className="btn btn-primary" onClick={() => setShowInvModal(true)}>
                  <Plus size={16} /> રોકાણ / ઉપાડ ઉમેરો
                </button>
              </div>

              {investments.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>કોઈ નોંધ નથી.</p>
              ) : (
                <div style={styles.tableResponsive}>
                  <table style={{ ...styles.table, minWidth: isMobile ? '600px' : '100%' }}>
                    <thead>
                      <tr>
                        <th style={styles.th}>તારીખ</th>
                        <th style={styles.th}>વ્યક્તિનું નામ</th>
                        <th style={styles.th}>પ્રકાર</th>
                        <th style={styles.th}>રકમ</th>
                        <th style={styles.th}>કાર્ય</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map((inv) => (
                        <tr key={inv.id} style={styles.tr}>
                          <td style={{ ...styles.td, color: 'var(--text-main)' }}>{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                          <td style={{ ...styles.td, fontWeight: 600, color: 'var(--text-main)' }}>{inv.person_name}</td>
                          <td style={styles.td}>
                            {inv.type === 'INVESTMENT' ? (
                              <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>રોકાણ (Invested)</span>
                            ) : (
                              <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', fontSize: '0.75rem', fontWeight: 600 }}>ઉપાડ (Get back)</span>
                            )}
                          </td>
                          <td style={{ ...styles.td, fontWeight: 700, color: inv.type === 'INVESTMENT' ? 'var(--success)' : 'var(--error)' }}>
                            ₹{inv.amount.toLocaleString('en-IN')}
                          </td>
                          <td style={styles.td}>
                            <button type="button" onClick={() => handleDeleteInvestment(inv.id)} className="btn-icon" style={{ color: 'var(--error)' }}>
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

            {/* Performance chart */}
            <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
              <h3 style={styles.cardTitle}>આવક અને નફાકારકતાનો વળાંક</h3>
              {processedRecords.length === 0 ? (
                <div style={styles.noData}>
                  <TrendingUp size={48} color="var(--border-glass-active)" />
                  <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>પત્રક દોરવા માટે પૂરતો નાણાકીય ડેટા નથી.</p>
                </div>
              ) : (
                <div style={{ height: '260px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...processedRecords].reverse()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevPortal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProfitPortal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="displayMonth" stroke="var(--text-muted)" fontSize={10} />
                      <YAxis stroke="var(--text-muted)" fontSize={10} />
                      <Tooltip contentStyle={{ background: '#121426', border: '1px solid var(--border-glass)' }} />
                      <Area type="monotone" dataKey="revenue" stroke="var(--secondary)" fillOpacity={1} fill="url(#colorRevPortal)" name="આવક" />
                      <Area type="monotone" dataKey="profit" stroke="var(--primary)" fillOpacity={1} fill="url(#colorProfitPortal)" name="નફો" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Business Modal Overlay */}
      {showBizModal && (
        <div style={styles.modalBackdrop}>
          <div className="glass-card animate-slide-up" style={{ ...styles.modalCard, width: '90%', maxWidth: '450px', padding: isMobile ? '20px 16px' : '24px' }}>
            <div style={styles.modalHeader}>
              <h3>નવો ધંધો રજીસ્ટર કરો</h3>
              <button className="btn-icon" onClick={() => setShowBizModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateBusiness} style={styles.form}>
              <div className="form-group">
                <label className="form-label">ધંધાનું નામ</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="દા.ત. વ્રજ કાપડ ઉદ્યોગ"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">ધંધાની વિગત / વર્ણન</label>
                <textarea
                  className="input-field"
                  placeholder="ધંધો કયા પ્રકારનો છે તેની વિગતો લખો..."
                  value={bizDesc}
                  onChange={(e) => setBizDesc(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">મેનેજિંગ પર્સન (સંચાલક)</label>
                <select
                  className="input-field"
                  value={bizManagerId}
                  onChange={(e) => setBizManagerId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">-- સંચાલક પસંદ કરો --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role === 'admin' ? 'એડમિન' : 'સભ્ય'})</option>
                  ))}
                </select>
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBizModal(false)}>
                  રદ કરો
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  રજીસ્ટર કરો
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Business Record Modal Overlay */}
      {showRecordModal && selectedBiz && (
        <div style={styles.modalBackdrop}>
          <div className="glass-card animate-slide-up" style={{ ...styles.modalCard, width: '90%', maxWidth: '700px', padding: isMobile ? '20px 16px' : '30px' }}>
            <div style={styles.modalHeader}>
              <h3>માસિક નાણાકીય વિગતો ભરો ({selectedBiz.name})</h3>
              <button className="btn-icon" onClick={() => setShowRecordModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddBusinessRecord} style={{ ...styles.form, marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">તારીખ</label>
                  <input
                    type="date"
                    className="input-field"
                    value={bizDate}
                    onChange={(e) => setBizDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">કુલ આવક (રૂપિયામાં)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="આવક લખો"
                    value={bizRevenue}
                    onChange={(e) => setBizRevenue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">માલસામાન ખરીદી ખર્ચ</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="ખરીદીનો ખર્ચ લખો"
                    value={bizCost}
                    onChange={(e) => setBizCost(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">સંચાલન ખર્ચ (ભાડું/પાવર)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="બીજા સંચાલન ખર્ચાઓ"
                    value={bizExpenses}
                    onChange={(e) => setBizExpenses(e.target.value)}
                    required
                  />
                </div>
              </div>

              {selectedBiz?.custom_columns && selectedBiz.custom_columns.length > 0 && (
                <>
                  <h4 style={{ margin: '20px 0 10px', fontSize: '0.9rem', color: 'var(--text-main)' }}>કોલમની વિગતો</h4>
                  <div style={styles.formGrid}>
                    {selectedBiz.custom_columns.map((col: string) => (
                      <div className="form-group" key={col}>
                        <label className="form-label">{col}</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          placeholder="રકમ"
                          value={globalCustomValues[col] || ''}
                          onChange={(e) => setGlobalCustomValues({...globalCustomValues, [col]: e.target.value})}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={styles.customFieldBuilder}>
                <label className="form-label" style={{ marginBottom: '12px', display: 'block', fontSize: '0.85rem' }}>
                  વધારાની વિશિષ્ટ વિગતો (દા.ત. બોનસ / કરવેરા)
                </label>

                <div style={{ marginBottom: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                      <tr>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>વિગતનું નામ</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>રકમ</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', width: '50px' }}>કાર્ય</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customFields.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>કોઈ વિગત નથી. નવી વિગત નીચેથી ઉમેરો.</td>
                        </tr>
                      ) : (
                        customFields.map((f, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-main)' }}>{f.key}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-main)' }}>{f.value}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button type="button" onClick={() => handleRemoveCustomField(i)} className="btn-icon" style={{ color: 'var(--error)' }}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="નામ લખો (દા.ત. બોનસ)"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '8px 12px', fontSize: '0.85rem' }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="રકમ"
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '8px 12px', fontSize: '0.85rem' }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={handleAddCustomField} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <Plus size={16} /> ઉમેરો
                  </button>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRecordModal(false)}>
                  રદ કરો
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  માસિક પત્રક સાચવો
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Family Expense Modal Overlay */}
      {showExpenseModal && selectedMember && (
        <div style={styles.modalBackdrop}>
          <div className="glass-card animate-slide-up" style={{ ...styles.modalCard, width: '90%', maxWidth: '600px', padding: isMobile ? '20px 16px' : '30px' }}>
            <div style={styles.modalHeader}>
              <h3>નવો ખર્ચ ઉમેરો ({selectedMember.name})</h3>
              <button className="btn-icon" onClick={() => setShowExpenseModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddExpense} style={{ ...styles.form, marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">ખર્ચની રકમ (રૂપિયામાં)</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <IndianRupee size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="રકમ લખો"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ width: '100%', paddingLeft: '36px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">ખર્ચની કેટેગરી</label>
                  <select
                    className="input-field"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">તારીખ</label>
                  <input
                    type="date"
                    className="input-field"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">ખર્ચની વિગત / નોંધ</label>
                <textarea
                  className="input-field"
                  placeholder="ખર્ચ કઈ બાબતમાં થયો તેની માહિતી લખો..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>
                  રદ કરો
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  ખર્ચ સાચવો
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Investment Modal */}
      {showInvModal && selectedBiz && (
        <div style={styles.modalBackdrop}>
          <div className="glass-card animate-slide-up" style={{ ...styles.modalCard, width: '90%', maxWidth: '500px', padding: isMobile ? '20px 16px' : '30px' }}>
            <div style={styles.modalHeader}>
              <h3>રોકાણ / ઉપાડ નોંધ (Investment / Withdrawal)</h3>
              <button className="btn-icon" onClick={() => setShowInvModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddInvestment} style={{ ...styles.form, marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">વ્યક્તિનું નામ</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="નામ લખો"
                  value={invPersonName}
                  onChange={(e) => setInvPersonName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">પ્રકાર</label>
                  <select
                    className="input-field"
                    value={invType}
                    onChange={(e) => setInvType(e.target.value as "INVESTMENT" | "WITHDRAWAL")}
                    required
                  >
                    <option value="INVESTMENT">રોકાણ (Invested)</option>
                    <option value="WITHDRAWAL">ઉપાડ (Get back)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">તારીખ</label>
                  <input
                    type="date"
                    className="input-field"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">રકમ</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="રકમ"
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  required
                />
              </div>

              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowInvModal(false)}>
                  રદ કરો
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  સાચવો
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Global Column Modal */}
      {showAddColumnModal && selectedBiz && (
        <div style={styles.modalBackdrop}>
          <div className="glass-card animate-slide-up" style={{ ...styles.modalCard, width: '90%', maxWidth: '400px', padding: '30px' }}>
            <div style={styles.modalHeader}>
              <h3>નવી કોલમ ઉમેરો</h3>
              <button className="btn-icon" onClick={() => setShowAddColumnModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddGlobalColumn} style={{...styles.form, marginTop: '20px'}}>
              <div className="form-group">
                <label className="form-label">કોલમનું નામ (દા.ત. Diamond Duty)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="કોલમનું નામ લખો"
                  value={newGlobalColumnName}
                  onChange={(e) => setNewGlobalColumnName(e.target.value)}
                  required
                />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddColumnModal(false)}>
                  રદ કરો
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  ઉમેરો
                </button>
              </div>
            </form>
          </div>
        </div>
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
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid var(--border-glass)',
    borderTopColor: 'var(--primary)',
    animation: 'spin 1s linear infinite',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 40px',
    borderRadius: 0,
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    zIndex: 90,
    flexWrap: 'wrap',
    gap: '16px',
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
  },
  logoBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1rem',
  },
  logoText: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 700,
    fontSize: '1.2rem',
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-glass)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--primary-hover)',
  },
  profileText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  username: {
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  btnText: {
    display: 'inline-block',
  },
  mainContent: {
    flex: 1,
    padding: '30px 40px',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
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
  portalChoiceContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '70vh',
    textAlign: 'center',
  },
  portalTitle: {
    fontSize: '2.5rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    marginBottom: '10px',
  },
  portalSubtitle: {
    color: 'var(--text-muted)',
    maxWidth: '600px',
    fontSize: '1rem',
    lineHeight: '1.6',
    marginBottom: '20px',
  },
  choiceIconBox: {
    width: '70px',
    height: '70px',
    borderRadius: '20px',
    border: '1px solid transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  choiceCardTitle: {
    fontSize: '1.4rem',
    fontWeight: 700,
    marginBottom: '10px',
  },
  choiceCardDesc: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    lineHeight: '1.5',
    flex: 1,
  },
  subPageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionTitle: {
    fontSize: '1.8rem',
    fontWeight: 700,
    marginTop: '10px',
  },
  sectionSubtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  entityBanner: {
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  metricCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metricLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  metricVal: {
    fontSize: '1.6rem',
    fontWeight: 800,
  },
  cardTitle: {
    fontSize: '1.15rem',
    marginBottom: '16px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  noData: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '180px',
  },
  legendGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px 12px',
    marginTop: '12px',
    maxHeight: '80px',
    overflowY: 'auto',
    width: '100%',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendText: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  tableCard: {
    padding: '24px',
  },
  tableResponsive: {
    overflowX: 'auto',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-glass)',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  td: {
    padding: '14px',
    borderBottom: '1px solid var(--border-glass)',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  tr: {
    transition: 'var(--transition-smooth)',
  },
  customFieldBuilder: {
    border: '1px solid var(--border-glass)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    marginBottom: '12px',
    background: 'rgba(255, 255, 255, 0.01)',
  },
  customFieldsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '10px',
  },
  fieldTag: {
    background: 'rgba(139, 92, 246, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.15)',
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.7rem',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  removeFieldBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'inline-flex',
    padding: '1px',
  },
  customGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  customFieldBadge: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-glass)',
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    width: 'fit-content',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '450px',
    padding: '24px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '16px',
  },
};
