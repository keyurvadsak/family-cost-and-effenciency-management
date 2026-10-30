import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Briefcase, ChevronRight,
  FileText, ArrowUpRight, ArrowDownRight,
  Search, Printer, BookOpen, ShieldCheck,
  CheckCircle2, Clock, Wallet, TrendingUp, Calculator,
  UserCheck, SlidersHorizontal, LayoutGrid, Table, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { businessApi, authApi } from '../api';
import type { Business, BusinessRecord, User, BusinessInvestment } from '../api';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';

type AccountantTab = 'ledger' | 'pl_statement' | 'capital' | 'ratios';

export default function BusinessPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const bizId = searchParams.get('biz');
  const selectedBiz = bizId ? businesses.find(b => b.id === parseInt(bizId, 10)) || null : null;
  const [records, setRecords] = useState<BusinessRecord[]>([]);
  const [investments, setInvestments] = useState<BusinessInvestment[]>([]);

  // Accountant Workspace Controls
  const [activeTab, setActiveTab] = useState<AccountantTab>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | '30days' | '6months' | 'fy_current' | 'fy_prev'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return 'cards';
    return 'table';
  });

  const [showKpiSummary, setShowKpiSummary] = useState(true);

  useEffect(() => {
    setViewMode(isMobile ? 'cards' : 'table');
  }, [isMobile]);

  // Modal states
  const [showBizModal, setShowBizModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Business create form
  const [bizName, setBizName] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [bizManagerId, setBizManagerId] = useState('');

  // Record / Voucher Form State
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [bizDate, setBizDate] = useState(new Date().toISOString().split('T')[0]);
  const [bizVoucherNo, setBizVoucherNo] = useState('');
  const [bizParticulars, setBizParticulars] = useState('');
  const [bizPaymentMode, setBizPaymentMode] = useState('રોકડ (Cash)');
  const [bizStatus, setBizStatus] = useState<'ચૂકવેલ' | 'બાકી'>('ચૂકવેલ');
  const [bizRevenue, setBizRevenue] = useState('');
  const [bizCost, setBizCost] = useState('');
  const [bizExpenses, setBizExpenses] = useState('');
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [globalCustomValues, setGlobalCustomValues] = useState<Record<string, string>>({});
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [newGlobalColumnName, setNewGlobalColumnName] = useState('');

  // Investment Form State
  const [invPersonName, setInvPersonName] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invAmount, setInvAmount] = useState('');
  const [invType, setInvType] = useState<"INVESTMENT" | "WITHDRAWAL">("INVESTMENT");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [bizList, uList] = await Promise.all([
          businessApi.list(),
          authApi.getUsers().catch(() => [] as User[]),
        ]);
        setBusinesses(bizList);
        setAllUsers(uList);
      } catch (err) {
        console.error('Failed to load businesses', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedBiz) {
      setRecords([]);
      setInvestments([]);
      return;
    }
    const fetchRecords = async () => {
      setDetailLoading(true);
      try {
        const [list, invList] = await Promise.all([
          businessApi.getRecords(selectedBiz.id),
          businessApi.getInvestments(selectedBiz.id),
        ]);
        setRecords(list);
        setInvestments(invList);
      } catch (err) {
        console.error('Failed to load records', err);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchRecords();
  }, [selectedBiz]);

  const selectBiz = (b: Business) => setSearchParams({ biz: b.id.toString() });
  const clearBiz = () => setSearchParams({});

  const canManage = user?.role === 'admin' || selectedBiz?.manager_id === user?.id;
  const currentBiz = selectedBiz ? businesses.find(b => b.id === selectedBiz.id) || selectedBiz : null;

  // Handlers
  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim()) return;
    if (user?.role !== 'admin') {
      showToast('માત્ર એડમિન જ નવો ધંધો ઉમેરી શકે છે.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const parsedManagerId = bizManagerId ? parseInt(bizManagerId) : undefined;
      const newBiz = await businessApi.create(bizName.trim(), bizDesc.trim(), parsedManagerId);
      setBusinesses(prev => [...prev, newBiz]);
      selectBiz(newBiz);
      setBizName('');
      setBizDesc('');
      setBizManagerId('');
      setShowBizModal(false);
      showToast(`ધંધો "${newBiz.name}" સફળતાપૂર્વક રજીસ્ટર થયો છે!`);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'નવો ધંધો ઉમેરવામાં ભૂલ આવી છે.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBusiness = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('શું તમે આ ધંધાની વિગતો અને તેના તમામ માસિક પત્રકો કાયમ માટે કાઢી નાખવા માંગો છો?')) return;
    try {
      await businessApi.delete(id);
      setBusinesses(prev => prev.filter(b => b.id !== id));
      if (selectedBiz?.id === id) clearBiz();
      showToast('ધંધાની ખાતાવહી કાઢી નાખવામાં આવી છે.');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'ધંધો કાઢી નાખવામાં ભૂલ આવી છે.', 'error');
    }
  };

  const handleOpenAddRecord = () => {
    setEditingRecordId(null);
    setBizDate(new Date().toISOString().split('T')[0]);
    setBizVoucherNo(`VCH-${Math.floor(1000 + Math.random() * 9000)}`);
    setBizParticulars('');
    setBizPaymentMode('રોકડ (Cash)');
    setBizStatus('ચૂકવેલ');
    setBizRevenue('');
    setBizCost('');
    setBizExpenses('');
    setCustomFields([]);
    setGlobalCustomValues({});
    setShowRecordModal(true);
  };

  const handleOpenEditRecord = (rec: BusinessRecord) => {
    setEditingRecordId(rec.id);
    setBizDate(rec.date);
    setBizRevenue(rec.revenue.toString());
    setBizCost(rec.cost.toString());
    setBizExpenses(rec.expenses.toString());
    
    // Extract accountant fields from custom_data
    const cData = rec.custom_data || {};
    setBizVoucherNo(cData.voucher_no || `VCH-${rec.id}`);
    setBizParticulars(cData.particulars || '');
    setBizPaymentMode(cData.payment_mode || 'રોકડ (Cash)');
    setBizStatus(cData.status === 'બાકી' ? 'બાકી' : 'ચૂકવેલ');

    // Extract global custom columns
    const globals: Record<string, string> = {};
    if (currentBiz?.custom_columns) {
      currentBiz.custom_columns.forEach(col => {
        if (cData[col] !== undefined) {
          globals[col] = String(cData[col]);
        }
      });
    }
    setGlobalCustomValues(globals);

    // Extract other custom fields
    const reservedKeys = new Set(['voucher_no', 'particulars', 'payment_mode', 'status', ...(currentBiz?.custom_columns || [])]);
    const extras: { key: string; value: string }[] = [];
    Object.keys(cData).forEach(key => {
      if (!reservedKeys.has(key)) {
        extras.push({ key, value: String(cData[key]) });
      }
    });
    setCustomFields(extras);
    setShowRecordModal(true);
  };

  const handleDeleteRecord = async (recordId: number) => {
    if (!window.confirm('શું તમે આ ખાતાવહી એન્ટ્રી કાયમ માટે કાઢી નાખવા માંગો છો?')) return;
    try {
      await businessApi.deleteRecord(recordId);
      setRecords(prev => prev.filter(r => r.id !== recordId));
      showToast('વાઉચર એન્ટ્રી કાઢી નાખવામાં આવી છે.');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'એન્ટ્રી કાઢી નાખવામાં ભૂલ આવી છે.', 'error');
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim() || !newFieldValue.trim()) return;
    setCustomFields(prev => [...prev, { key: newFieldName.trim(), value: newFieldValue.trim() }]);
    setNewFieldName('');
    setNewFieldValue('');
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddGlobalColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz || !newGlobalColumnName.trim()) return;
    setActionLoading(true);
    try {
      const updatedColumns = [...(selectedBiz.custom_columns || []), newGlobalColumnName.trim()];
      const updatedBiz = await businessApi.updateColumns(selectedBiz.id, updatedColumns);
      setBusinesses(prev => prev.map(b => b.id === updatedBiz.id ? updatedBiz : b));
      setSearchParams({ biz: updatedBiz.id.toString() });
      setShowAddColumnModal(false);
      setNewGlobalColumnName('');
      showToast('નવી ખાતાવહી કોલમ સફળતાપૂર્વક ઉમેરવામાં આવી!');
    } catch (err) {
      console.error(err);
      showToast('કોલમ ઉમેરવામાં ભૂલ આવી.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveBusinessRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
    setActionLoading(true);
    try {
      const revVal = parseFloat(bizRevenue) || 0;
      const costVal = parseFloat(bizCost) || 0;
      const expVal = parseFloat(bizExpenses) || 0;
      
      const customDataObj: Record<string, any> = {
        voucher_no: bizVoucherNo.trim() || `VCH-${Math.floor(1000 + Math.random() * 9000)}`,
        particulars: bizParticulars.trim(),
        payment_mode: bizPaymentMode,
        status: bizStatus,
      };

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
        custom_data: customDataObj,
      });

      setRecords(prev => {
        const index = prev.findIndex(r => r.date === bizDate || r.id === updatedRecord.id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = updatedRecord;
          return updated;
        }
        return [updatedRecord, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      });

      setShowRecordModal(false);
      showToast('વાઉચર એન્ટ્રી સફળતાપૂર્વક નોંધાઈ છે!');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'માસિક પત્રક સાચવવામાં નિષ્ફળતા મળી.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
    setActionLoading(true);
    try {
      const amtVal = parseFloat(invAmount) || 0;
      if (amtVal <= 0) throw new Error('રકમ શૂન્ય કરતાં વધુ હોવી જોઈએ.');

      const newInv = await businessApi.saveInvestment({
        business_id: selectedBiz.id,
        person_name: invPersonName.trim(),
        date: invDate,
        amount: amtVal,
        type: invType,
      });

      setInvestments(prev => [newInv, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      setInvPersonName('');
      setInvAmount('');
      setShowInvModal(false);
      showToast('રોકાણ / ઉપાડ નોંધ સફળતાપૂર્વક ઉમેરવામાં આવી!');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'માહિતી સાચવવામાં નિષ્ફળતા મળી.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInvestment = async (id: number) => {
    if (!window.confirm('શું તમે ખરેખર આ મૂડી નોંધ કાઢી નાખવા માંગો છો?')) return;
    try {
      await businessApi.deleteInvestment(id);
      setInvestments(investments.filter(i => i.id !== id));
      showToast('મૂડી નોંધ કાઢી નાખવામાં આવી છે.');
    } catch (err) {
      console.error(err);
      showToast('નોંધ કાઢી નાખવામાં ભૂલ આવી છે.', 'error');
    }
  };

  // Filtered & Processed records for accounting
  const filteredRecords = useMemo(() => {
    let result = records.map(rec => {
      const profit = rec.revenue - (rec.cost + rec.expenses);
      const margin = rec.revenue > 0 ? (profit / rec.revenue) * 100 : 0;
      const voucher = rec.custom_data?.voucher_no || `VCH-${rec.id}`;
      const particulars = rec.custom_data?.particulars || '';
      const mode = rec.custom_data?.payment_mode || 'રોકડ (Cash)';
      const status = rec.custom_data?.status || 'ચૂકવેલ';

      return {
        ...rec,
        profit,
        margin,
        voucher,
        particulars,
        mode,
        status,
        displayDate: new Date(rec.date).toLocaleDateString('gu-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      };
    });

    // Period filter
    const now = new Date();
    if (periodFilter === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter(r => new Date(r.date) >= thirtyDaysAgo);
    } else if (periodFilter === '6months') {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      result = result.filter(r => new Date(r.date) >= sixMonthsAgo);
    } else if (periodFilter === 'fy_current') {
      // Indian FY starts April 1
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyStart = new Date(startYear, 3, 1);
      result = result.filter(r => new Date(r.date) >= fyStart);
    } else if (periodFilter === 'fy_prev') {
      const startYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
      const fyStart = new Date(startYear, 3, 1);
      const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59);
      result = result.filter(r => {
        const d = new Date(r.date);
        return d >= fyStart && d <= fyEnd;
      });
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        return (
          r.voucher.toLowerCase().includes(q) ||
          r.particulars.toLowerCase().includes(q) ||
          r.mode.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.date.includes(q) ||
          r.revenue.toString().includes(q) ||
          r.cost.toString().includes(q)
        );
      });
    }

    return result;
  }, [records, periodFilter, searchQuery]);

  // Aggregate Calculations
  const totalRev = filteredRecords.reduce((sum, item) => sum + item.revenue, 0);
  const totalPurchases = filteredRecords.reduce((sum, item) => sum + item.cost, 0);
  const totalOperatingExp = filteredRecords.reduce((sum, item) => sum + item.expenses, 0);
  const grossProfit = totalRev - totalPurchases;
  const grossMargin = totalRev > 0 ? (grossProfit / totalRev) * 100 : 0;
  const netProfit = totalRev - (totalPurchases + totalOperatingExp);
  const netMargin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

  // Capital ledger calculations
  const totalInvested = investments.filter(i => i.type === 'INVESTMENT').reduce((sum: number, i: any) => sum + i.amount, 0);
  const totalWithdrawn = investments.filter(i => i.type === 'WITHDRAWAL').reduce((sum: number, i: any) => sum + i.amount, 0);
  const netCapitalInHand = totalInvested - totalWithdrawn;
  const totalWorkingBalance = netCapitalInHand + netProfit;

  // Partner summary breakdown
  const partnerBreakdown = useMemo(() => {
    const map: Record<string, { invested: number; withdrawn: number }> = {};
    investments.forEach(inv => {
      if (!map[inv.person_name]) {
        map[inv.person_name] = { invested: 0, withdrawn: 0 };
      }
      if (inv.type === 'INVESTMENT') map[inv.person_name].invested += inv.amount;
      else map[inv.person_name].withdrawn += inv.amount;
    });
    return Object.entries(map).map(([name, data]) => ({
      name,
      invested: data.invested,
      withdrawn: data.withdrawn,
      net: data.invested - data.withdrawn,
    }));
  }, [investments]);

  // Financial ratios & stats
  const avgMonthlyRev = filteredRecords.length > 0 ? totalRev / filteredRecords.length : 0;
  const maxMonthRevRecord = filteredRecords.length > 0 
    ? [...filteredRecords].sort((a, b) => b.revenue - a.revenue)[0] 
    : null;
  const opexRatio = totalRev > 0 ? (totalOperatingExp / totalRev) * 100 : 0;

  // Live calculator for Modal
  const modalRevNum = parseFloat(bizRevenue) || 0;
  const modalCostNum = parseFloat(bizCost) || 0;
  const modalExpNum = parseFloat(bizExpenses) || 0;
  const modalNetProfit = modalRevNum - (modalCostNum + modalExpNum);
  const modalMargin = modalRevNum > 0 ? ((modalNetProfit / modalRevNum) * 100).toFixed(1) : '0.0';

  const handlePrint = () => {
    window.print();
  };

  // ═══════ LOADING ═══════
  if (loading) return <LoadingScreen />;

  // ═══════ BUSINESS SELECTION PORTAL ═══════
  if (!currentBiz) {
    return (
      <div className="animate-slide-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <button className="back-navigation-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} />
            <span>મુખ્ય પોર્ટલ</span>
          </button>
          {user?.role === 'admin' && !isMobile && (
            <button className="btn btn-primary" onClick={() => setShowBizModal(true)}>
              <Plus size={16} /> નવો ધંધો ઉમેરો
            </button>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 className="section-title">વ્યવસાયિક ખાતાવહી પોર્ટલ</h2>
          <p className="section-subtitle">
            સત્તાવાર ઓડિટ, નફો-નુકસાન પત્રક અને દ્વિ-નોંધી ખાતાવહી સંચાલન માટે ધંધાનું નામ પસંદ કરો.
          </p>
        </div>

        {user?.role === 'admin' && isMobile && (
          <button className="fab" onClick={() => setShowBizModal(true)} aria-label="નવો ધંધો">
            <Plus size={24} />
          </button>
        )}

        <div className="layout-grid stagger-children" style={{ marginTop: '16px' }}>
          {/* Master Consolidated Ledger Hub Card (બધા નો મિક્સ હિસાબ) */}
          <div
            className="glass-card-interactive"
            style={{
              gridColumn: '1 / -1',
              padding: isMobile ? '14px 16px' : '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.2), rgba(245, 158, 11, 0.15))',
              border: '1.5px solid rgba(245, 158, 11, 0.45)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/dashboard/consolidated')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/consolidated')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px' }}>
              <div
                style={{
                  width: isMobile ? '44px' : '54px',
                  height: isMobile ? '44px' : '54px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)',
                  flexShrink: 0
                }}
              >
                <BookOpen size={isMobile ? 22 : 28} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: isMobile ? '1.08rem' : '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    બધા નો મિક્સ હિસાબ
                  </h3>
                  <span className="badge badge-primary" style={{ fontSize: '0.62rem', background: '#d97706' }}>
                    માસ્ટર કેશબુક
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.75rem' : '0.84rem', margin: '3px 0 0', lineHeight: 1.4 }}>
                  લૂમ્સ, પ્રિશા ફેબ એમ્બ્રોઈડરી, હીરા વેપાર (કેયુર જેમ્સ), ઉછીના-લોન અને સંયુક્ત પરિવારનો માસિક કેશબુક હિસાબ
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', fontWeight: 800, fontSize: isMobile ? '0.84rem' : '0.94rem' }}>
              <span>ખાતાવહી ખોલો</span>
              <ChevronRight size={18} />
            </div>
          </div>

          {businesses.map(biz => {
            const bizManager = allUsers.find(u => u.id === biz.manager_id);
            const isManager = biz.manager_id === user?.id;

            return (
              <div
                key={biz.id}
                className="glass-card-interactive"
                style={{
                  padding: isMobile ? '16px' : '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '180px',
                  borderTop: isManager ? '3px solid var(--secondary)' : undefined
                }}
                onClick={() => selectBiz(biz)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && selectBiz(biz)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Briefcase size={22} color="var(--secondary)" />
                    </div>
                    {(user?.role === 'admin' || isManager) && (
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--error)' }}
                        onClick={(e) => handleDeleteBusiness(biz.id, e)}
                        title="ધંધો કાઢી નાખો"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.2rem', marginTop: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {biz.name}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px', lineHeight: 1.4 }}>
                    {biz.description || 'કોઈ ખાસ નોંધ નથી.'}
                  </p>
                </div>

                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      સંચાલક: <strong>{bizManager ? bizManager.username : 'બધા સભ્યો'}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span>ખાતાવહી</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            );
          })}

          {businesses.length === 0 && (
            <div className="glass-card" style={{ gridColumn: '1/-1' }}>
              <EmptyState icon={Briefcase} message="હજુ સુધી કોઈ વ્યવસાય નોંધાયેલ નથી. એડમિન દ્વારા નવો વ્યવસાય ઉમેરો." />
            </div>
          )}
        </div>

        {/* Create Business Modal */}
        <Modal show={showBizModal} onClose={() => setShowBizModal(false)} title="નવો ધંધો / વ્યવસાય રજીસ્ટર કરો" maxWidth="480px">
          <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            <div className="form-group">
              <label className="form-label">ધંધાનું સત્તાવાર નામ *</label>
              <input
                type="text"
                className="input-field"
                placeholder="દા.ત. વ્રજ ટેક્સટાઈલ્સ અથવા શ્યામ ડાયમંડ"
                value={bizName}
                onChange={e => setBizName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">ધંધાનો પ્રકાર / વર્ણન</label>
              <textarea
                className="input-field"
                placeholder="કાપડ વેપાર, હીરા ઘસવાનો વ્યવસાય, મશીનરી વર્ક..."
                value={bizDesc}
                onChange={e => setBizDesc(e.target.value)}
                style={{ minHeight: '75px' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">જવાબદાર સંચાલક (Manager)</label>
              <select className="input-field" value={bizManagerId} onChange={e => setBizManagerId(e.target.value)}>
                <option value="">-- સંચાલક પસંદ કરો (બધા સભ્યો માત્ર જોઈ શકશે) --</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role === 'admin' ? 'એડમિન' : 'સભ્ય'})
                  </option>
                ))}
              </select>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
                માત્ર એડમિન અને પસંદ કરેલા સંચાલક જ આ ધંધામાં હિસાબ ઉમેરી કે સુધારી શકશે.
              </small>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBizModal(false)}>રદ</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>નોંધણી કરો</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ═══════ BUSINESS DETAIL: ACCOUNTANT WORKBENCH ═══════
  if (detailLoading) return <LoadingScreen />;

  return (
    <div className="animate-slide-up">
      {/* Print Only Official Ledger Header */}
      <div className="print-only print-header">
        <h1>{currentBiz.name} — સત્તાવાર હિસાબી પત્રક</h1>
        <p>{currentBiz.description || 'વ્યવસાયિક ખાતાવહી અને નાણાકીય અહેવાલ'}</p>
        <p style={{ fontSize: '9pt', color: '#666', marginTop: '4px' }}>
          તારીખ: {new Date().toLocaleDateString('gu-IN', { day: '2-digit', month: 'long', year: 'numeric' })} | સંચાલક: {allUsers.find(u => u.id === currentBiz.manager_id)?.username || 'મુખ્ય સંચાલક'}
        </p>
      </div>

      {/* Screen Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '6px' : '10px', marginBottom: isMobile ? '6px' : '12px' }}>
        <button className="back-navigation-btn" onClick={clearBiz} style={{ margin: 0 }}>
          <ArrowLeft size={14} />
          <span>ધંધાઓ</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint} title="હિસાબી પત્રક પ્રિન્ટ / PDF ડાઉનલોડ">
            <Printer size={14} />
            <span className={isMobile ? 'hide-on-mobile' : ''}>પ્રિન્ટ</span>
          </button>
          {canManage && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenAddRecord}>
              <Plus size={14} />
              <span>વાઉચર એન્ટ્રી</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Business Header Banner */}
      <div className="glass-card entity-banner" style={{ marginTop: isMobile ? '4px' : '12px', padding: isMobile ? '7px 10px' : '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
          <div className="selection-avatar-badge" style={{ margin: 0, width: isMobile ? '32px' : '48px', height: isMobile ? '32px' : '48px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>
            <Briefcase size={isMobile ? 16 : 22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 style={{ fontSize: isMobile ? '0.98rem' : '1.4rem', fontWeight: 800, margin: 0 }}>{currentBiz.name}</h2>
              <span className="badge badge-primary" style={{ fontSize: '0.6rem' }}>ઓડિટ</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', margin: '1px 0 0' }}>
              {currentBiz.description || 'ચાર્ટર્ડ એકાઉન્ટન્ટ સ્ટાન્ડર્ડ ખાતાવહી'}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>સંચાલક</span>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            {allUsers.find(u => u.id === currentBiz.manager_id)?.username || 'કોઈ નથી'}
          </p>
        </div>
      </div>

      {/* High-Density Accountant Executive KPI Cards (Zero Graphs) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: isMobile ? '6px' : '10px', marginBottom: '2px' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          નાણાકીય સારાંશ (Executive KPIs)
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
          <span>વેચાણ: <strong className="text-credit">₹{totalRev.toLocaleString('en-IN')}</strong></span>
          <span>•</span>
          <span>ખરીદી: <strong className="text-debit">₹{totalPurchases.toLocaleString('en-IN')}</strong></span>
          <span>•</span>
          <span className={netProfit >= 0 ? 'text-net-profit' : 'text-net-loss'}>
            નફો: <strong>₹{netProfit.toLocaleString('en-IN')}</strong>
          </span>
        </div>
      ) : (
        <div className="acc-kpi-grid">
          <div className="acc-kpi-card kpi-income">
            <div className="acc-kpi-header">
              <span className="acc-kpi-title">કુલ વેચાણ ટર્નઓવર</span>
              <span className="acc-kpi-badge badge-success">આવક</span>
            </div>
            <div className="acc-kpi-value text-credit">₹{totalRev.toLocaleString('en-IN')}</div>
            <div className="acc-kpi-subtext">
              <span>સરેરાશ: ₹{Math.round(avgMonthlyRev).toLocaleString('en-IN')}/મહિને</span>
            </div>
          </div>

          <div className="acc-kpi-card kpi-expense">
            <div className="acc-kpi-header">
              <span className="acc-kpi-title">માલ ખરીદી (COGS)</span>
              <span className="acc-kpi-badge badge-danger">ખરીદી</span>
            </div>
            <div className="acc-kpi-value text-debit">₹{totalPurchases.toLocaleString('en-IN')}</div>
            <div className="acc-kpi-subtext">
              <span>કાચો નફો: ₹{grossProfit.toLocaleString('en-IN')} ({grossMargin.toFixed(1)}%)</span>
            </div>
          </div>

          <div className="acc-kpi-card kpi-expense">
            <div className="acc-kpi-header">
              <span className="acc-kpi-title">સંચાલન ખર્ચ (OPEX)</span>
              <span className="acc-kpi-badge" style={{ background: 'rgba(251, 191, 36, 0.15)', color: 'var(--warning)' }}>ઓફિસ</span>
            </div>
            <div className="acc-kpi-value text-debit">₹{totalOperatingExp.toLocaleString('en-IN')}</div>
            <div className="acc-kpi-subtext">
              <span>રેશિયો: {opexRatio.toFixed(1)}%</span>
            </div>
          </div>

          <div className="acc-kpi-card kpi-profit">
            <div className="acc-kpi-header">
              <span className="acc-kpi-title">ચોખ્ખો સંચાલન નફો</span>
              <span className={`acc-kpi-badge ${netProfit >= 0 ? 'badge-success' : 'badge-danger'}`}>
                {netMargin.toFixed(1)}%
              </span>
            </div>
            <div className={`acc-kpi-value ${netProfit >= 0 ? 'text-net-profit' : 'text-net-loss'}`}>
              ₹{netProfit.toLocaleString('en-IN')}
            </div>
            <div className="acc-kpi-subtext">
              <span>{netProfit >= 0 ? 'ચોખ્ખી નફાકારકતા' : 'ધંધામાં નુકસાન'}</span>
            </div>
          </div>

          <div className="acc-kpi-card kpi-capital">
            <div className="acc-kpi-capital-content">
              <div className="acc-kpi-header">
                <span className="acc-kpi-title">ચોખ્ખી કાર્યકારી મૂડી</span>
                <span className="acc-kpi-badge badge-secondary">બેલેન્સ</span>
              </div>
              <div className="acc-kpi-subtext">
                <span>રોકાણ: ₹{totalInvested.toLocaleString('en-IN')} | ઉપાડ: ₹{totalWithdrawn.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="acc-kpi-value" style={{ color: 'var(--secondary)' }}>
              ₹{totalWorkingBalance.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      {/* Accountant Toolbar (Search, Filter, Actions, Tabs) */}
      <div className="accountant-toolbar">
        <div className="accountant-toolbar-left">
          {/* Tab Selection */}
          <div className="accountant-tabs">
            <button
              className={`acc-tab ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
            >
              <BookOpen size={15} />
              <span>ખાતાવહી પત્રક</span>
            </button>
            <button
              className={`acc-tab ${activeTab === 'pl_statement' ? 'active' : ''}`}
              onClick={() => setActiveTab('pl_statement')}
            >
              <Calculator size={15} />
              <span>નફો-નુકસાન પત્રક (P&L)</span>
            </button>
            <button
              className={`acc-tab ${activeTab === 'capital' ? 'active' : ''}`}
              onClick={() => setActiveTab('capital')}
            >
              <Wallet size={15} />
              <span>મૂડી અને રોકાણ ખાતું</span>
            </button>
            <button
              className={`acc-tab ${activeTab === 'ratios' ? 'active' : ''}`}
              onClick={() => setActiveTab('ratios')}
            >
              <ShieldCheck size={15} />
              <span>ઓડિટ રેશિયો</span>
            </button>
          </div>
        </div>

        <div className="accountant-toolbar-right">
          {/* Search Box */}
          <div className="accountant-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="accountant-search-input"
              placeholder="વાઉચર, નોંધ, રકમ શોધો..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Period Filter */}
          <select
            className="accountant-filter-select"
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value as any)}
          >
            <option value="all">તમામ હિસાબ (All Time)</option>
            <option value="30days">છેલ્લા ૩૦ દિવસ</option>
            <option value="6months">છેલ્લા ૬ મહિના</option>
            <option value="fy_current">ચાલુ નાણાકીય વર્ષ (FY)</option>
            <option value="fy_prev">ગત નાણાકીય વર્ષ (Prev FY)</option>
          </select>
        </div>
      </div>

      {/* ═══════════ TAB 1: GENERAL LEDGER ═══════════ */}
      {activeTab === 'ledger' && (
        <div className="glass-card" style={{ padding: isMobile ? '12px' : '20px', marginTop: isMobile ? '8px' : '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '10px' : '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0, fontSize: isMobile ? '1rem' : '1.15rem' }}>
                વ્યવસાયિક ખાતાવહી (General Ledger)
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem', margin: '2px 0 0' }}>
                તમામ વાઉચર એન્ટ્રીઓ, ખરીદી, વેચાણ અને ચોખ્ખા નફાની દ્વિ-નોંધી ખાતાવહી.
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

              {canManage && (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddColumnModal(true)}>
                  <Plus size={14} /> <span className={isMobile ? 'hide-on-mobile' : ''}>નવી કોલમ</span>
                </button>
              )}
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <EmptyState icon={FileText} message="આ સમયગાળામાં કોઈ ખાતાવહી એન્ટ્રીઓ ઉપલબ્ધ નથી." />
          ) : viewMode === 'cards' ? (
            <div>
              {/* Mobile Ledger Summary Totals */}
              <div className="mobile-ledger-totals">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)' }}>
                    કુલ સરવાળો (TOTALS)
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {filteredRecords.length} વાઉચર
                  </span>
                </div>
                <div className="mobile-ledger-totals-grid">
                  <div className="mobile-ledger-totals-item">
                    <span className="acc-financial-cell-title">કુલ વેચાણ [જમા]</span>
                    <span className="acc-financial-cell-val text-credit">₹{totalRev.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mobile-ledger-totals-item">
                    <span className="acc-financial-cell-title">માલ ખરીદી [ઉધાર]</span>
                    <span className="acc-financial-cell-val text-debit">₹{totalPurchases.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mobile-ledger-totals-item">
                    <span className="acc-financial-cell-title">સંચાલન ખર્ચ [ઉધાર]</span>
                    <span className="acc-financial-cell-val text-debit">₹{totalOperatingExp.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mobile-ledger-totals-item highlight">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="acc-financial-cell-title" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                        ચોખ્ખો નફો [સિલક]
                      </span>
                      <span className={`badge ${netProfit >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.62rem' }}>
                        {netMargin.toFixed(1)}%
                      </span>
                    </div>
                    <span className={`acc-financial-cell-val ${netProfit >= 0 ? 'text-net-profit' : 'text-net-loss'}`} style={{ fontSize: '1.05rem' }}>
                      ₹{netProfit.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Voucher Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredRecords.map(rec => (
                  <div key={rec.id} className={`acc-record-card ${rec.profit >= 0 ? 'profit' : 'loss'}`}>
                    <div className="acc-record-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="acc-record-card-date">{rec.displayDate}</span>
                        <span className="acc-record-card-voucher">{rec.voucher}</span>
                      </div>
                      <span className={`status-pill ${rec.status === 'ચૂકવેલ' ? 'status-paid' : 'status-pending'}`}>
                        {rec.status === 'ચૂકવેલ' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {rec.status}
                      </span>
                    </div>

                    <div className="acc-record-card-particulars">
                      {rec.particulars || 'નિયમિત વ્યવસાયિક હિસાબ'}
                    </div>

                    <div className="acc-record-financial-grid">
                      <div>
                        <span className="acc-financial-cell-title">વેચાણ (CR)</span>
                        <span className="acc-financial-cell-val text-credit">₹{rec.revenue.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="acc-financial-cell-title">ખરીદી (DR)</span>
                        <span className="acc-financial-cell-val text-debit">₹{rec.cost.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="acc-financial-cell-title">ખર્ચ (DR)</span>
                        <span className="acc-financial-cell-val text-debit">₹{rec.expenses.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Custom Columns if any */}
                    {currentBiz.custom_columns && currentBiz.custom_columns.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                        {currentBiz.custom_columns.map(col => {
                          const val = rec.custom_data?.[col];
                          if (val === undefined || val === '') return null;
                          return (
                            <span key={col} style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-input)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                              <strong>{col}:</strong> {typeof val === 'number' ? `₹${val.toLocaleString('en-IN')}` : val}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="acc-record-profit-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>ચોખ્ખો નફો:</span>
                        <span className={`badge ${rec.profit >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.6rem' }}>
                          {rec.margin.toFixed(1)}%
                        </span>
                      </div>
                      <span className={`acc-financial-cell-val ${rec.profit >= 0 ? 'text-net-profit' : 'text-net-loss'}`} style={{ fontSize: '0.98rem' }}>
                        ₹{rec.profit.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="acc-record-card-footer">
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {rec.mode}
                      </span>

                      {canManage && (
                        <div className="acc-record-card-actions">
                          <button
                            className="btn-icon"
                            style={{ width: '28px', height: '28px', color: 'var(--primary)' }}
                            onClick={() => handleOpenEditRecord(rec)}
                            title="સુધારો"
                          >
                            <SlidersHorizontal size={14} />
                          </button>
                          <button
                            className="btn-icon"
                            style={{ width: '28px', height: '28px', color: 'var(--error)' }}
                            onClick={() => handleDeleteRecord(rec.id)}
                            title="કાઢી નાખો"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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
                  👈 તમામ ૧૧ કોલમ જોવા માટે આડું સ્ક્રોલ કરો 👉
                </div>
              )}
              <table className="accountant-table">
                <thead>
                  <tr>
                    <th>તારીખ</th>
                    <th>વાઉચર નં.</th>
                    <th>વિગત / શેરો</th>
                    <th className="num-cell">વેચાણ [જમા / CR]</th>
                    <th className="num-cell">માલ ખરીદી [ઉધાર / DR]</th>
                    <th className="num-cell">સંચાલન [ઉધાર / DR]</th>
                    {currentBiz.custom_columns?.map((col: string) => (
                      <th key={col} className="num-cell">{col}</th>
                    ))}
                    <th className="num-cell">ચોખ્ખો નફો [સિલક]</th>
                    <th>ચુકવણી પદ્ધતિ</th>
                    <th>સ્થિતિ</th>
                    {canManage && <th style={{ textAlign: 'center' }}>ક્રિયા</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map(rec => (
                    <tr key={rec.id}>
                      <td className="col-date">{rec.displayDate}</td>
                      <td className="col-voucher">{rec.voucher}</td>
                      <td style={{ maxWidth: '200px', whiteSpace: 'normal', color: 'var(--text-main)' }}>
                        {rec.particulars || 'નિયમિત માસિક હિસાબ'}
                      </td>
                      <td className="num-cell text-credit">₹{rec.revenue.toLocaleString('en-IN')}</td>
                      <td className="num-cell text-debit">₹{rec.cost.toLocaleString('en-IN')}</td>
                      <td className="num-cell text-debit">₹{rec.expenses.toLocaleString('en-IN')}</td>
                      {currentBiz.custom_columns?.map((col: string) => (
                        <td key={col} className="num-cell">
                          {rec.custom_data && rec.custom_data[col] !== undefined
                            ? (typeof rec.custom_data[col] === 'number'
                                ? `₹${rec.custom_data[col].toLocaleString('en-IN')}`
                                : rec.custom_data[col])
                            : '-'}
                        </td>
                      ))}
                      <td className={`num-cell ${rec.profit >= 0 ? 'text-net-profit' : 'text-net-loss'}`}>
                        ₹{rec.profit.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{rec.mode}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${rec.status === 'ચૂકવેલ' ? 'status-paid' : 'status-pending'}`}>
                          {rec.status === 'ચૂકવેલ' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {rec.status}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px', color: 'var(--primary)' }}
                              onClick={() => handleOpenEditRecord(rec)}
                              title="સુધારો"
                            >
                              <SlidersHorizontal size={14} />
                            </button>
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px', color: 'var(--error)' }}
                              onClick={() => handleDeleteRecord(rec.id)}
                              title="કાઢી નાખો"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 800 }}>કુલ સરવાળો (TOTALS)</td>
                    <td className="num-cell text-credit">₹{totalRev.toLocaleString('en-IN')}</td>
                    <td className="num-cell text-debit">₹{totalPurchases.toLocaleString('en-IN')}</td>
                    <td className="num-cell text-debit">₹{totalOperatingExp.toLocaleString('en-IN')}</td>
                    {currentBiz.custom_columns?.map((col: string) => {
                      const colTotal = filteredRecords.reduce((sum, r) => {
                        const val = r.custom_data?.[col];
                        return sum + (typeof val === 'number' ? val : 0);
                      }, 0);
                      return <td key={col} className="num-cell">₹{colTotal.toLocaleString('en-IN')}</td>;
                    })}
                    <td className={`num-cell ${netProfit >= 0 ? 'text-net-profit' : 'text-net-loss'}`}>
                      ₹{netProfit.toLocaleString('en-IN')}
                    </td>
                    <td colSpan={canManage ? 3 : 2}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {filteredRecords.length} વાઉચર એન્ટ્રીઓ
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB 2: PROFIT & LOSS STATEMENT ═══════════ */}
      {activeTab === 'pl_statement' && (
        <div className="pl-statement-card">
          <div className="pl-statement-header">
            <div>
              <div className="pl-statement-title">નફો અને નુકસાન પત્રક (Profit & Loss Statement)</div>
              <div className="pl-statement-period">
                સત્તાવાર ઓડિટ પત્રક | સમયગાળો: {periodFilter === 'all' ? 'સંપૂર્ણ રેકોર્ડ' : periodFilter}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ચોખ્ખો નફો ગુણોત્તર</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: netMargin >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {netMargin.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Section A: Revenue */}
          <div className="pl-section-heading">ભાગ ૧: વેચાણ અને કારોબારી આવક (Trading Revenue)</div>
          <div className="pl-line-item">
            <span>કુલ વેચાણ આવક (Gross Turnover / Sales)</span>
            <span className="num-cell text-credit">₹{totalRev.toLocaleString('en-IN')}</span>
          </div>
          <div className="pl-line-item subtotal">
            <span>કુલ વ્યવસાયિક આવક (A)</span>
            <span className="num-cell text-credit">₹{totalRev.toLocaleString('en-IN')}</span>
          </div>

          {/* Section B: Direct Costs */}
          <div className="pl-section-heading">ભાગ ૨: માલ ખરીદી અને સીધા ખર્ચા (Cost of Goods Sold - COGS)</div>
          <div className="pl-line-item">
            <span>કાચા માલની ખરીદી (Purchases / Stock Cost)</span>
            <span className="num-cell text-debit">₹{totalPurchases.toLocaleString('en-IN')}</span>
          </div>
          <div className="pl-line-item subtotal">
            <span>કુલ સીધા ખર્ચા (B)</span>
            <span className="num-cell text-debit">₹{totalPurchases.toLocaleString('en-IN')}</span>
          </div>

          {/* Gross Profit Line */}
          <div className="pl-line-item" style={{ background: 'rgba(96, 165, 250, 0.08)', fontWeight: 800, marginTop: '8px' }}>
            <span>કાચો નફો (GROSS PROFIT = A - B)</span>
            <span className="num-cell" style={{ color: grossProfit >= 0 ? 'var(--secondary)' : 'var(--error)' }}>
              ₹{grossProfit.toLocaleString('en-IN')} ({grossMargin.toFixed(1)}%)
            </span>
          </div>

          {/* Section C: Operating Expenses */}
          <div className="pl-section-heading">ભાગ ૩: સંચાલન અને પરચૂરણ ખર્ચા (Operating Expenses / OPEX)</div>
          <div className="pl-line-item">
            <span>સંચાલન અને દુકાન/ફેક્ટરી ખર્ચ</span>
            <span className="num-cell text-debit">₹{totalOperatingExp.toLocaleString('en-IN')}</span>
          </div>
          {currentBiz.custom_columns?.map((col: string) => {
            const colTotal = filteredRecords.reduce((sum, r) => {
              const val = r.custom_data?.[col];
              return sum + (typeof val === 'number' ? val : 0);
            }, 0);
            return (
              <div key={col} className="pl-line-item">
                <span>{col}</span>
                <span className="num-cell text-debit">₹{colTotal.toLocaleString('en-IN')}</span>
              </div>
            );
          })}
          <div className="pl-line-item subtotal">
            <span>કુલ સંચાલન ખર્ચા (C)</span>
            <span className="num-cell text-debit">
              ₹{(totalOperatingExp + (currentBiz.custom_columns?.reduce((sum: number, col: string) => {
                return sum + filteredRecords.reduce((s, r) => s + (typeof r.custom_data?.[col] === 'number' ? r.custom_data[col] : 0), 0);
              }, 0) || 0)).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Grand Net Profit */}
          <div className={`pl-line-item grand-total ${netProfit < 0 ? 'loss' : ''}`}>
            <span>ચોખ્ખો સંચાલન નફો (NET OPERATING PROFIT)</span>
            <span className="num-cell" style={{ fontSize: '1.3rem' }}>
              ₹{netProfit.toLocaleString('en-IN')}
            </span>
          </div>

          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ઓડિટ નોંધ: ચોખ્ખો નફો તમામ આવકમાંથી ખરીદી અને સંચાલન ખર્ચા બાદ કર્યા પછીનો સત્તાવાર ચોખ્ખો હિસાબ છે.
            </span>
            <span className="badge badge-success">ઓડિટ પૂર્ણ</span>
          </div>
        </div>
      )}

      {/* ═══════════ TAB 3: CAPITAL & PARTNERS LEDGER ═══════════ */}
      {activeTab === 'capital' && (
        <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
                મૂડી ખાતું અને ભાગીદારોનું પત્રક (Capital Account Ledger)
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>
                વ્યવસાયમાં ભાગીદારો / વ્યક્તિઓ દ્વારા કરવામાં આવેલ રોકાણ અને ઉપાડની નોંધ.
              </p>
            </div>

            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowInvModal(true)}>
                <Plus size={14} /> રોકાણ / ઉપાડ નોંધ
              </button>
            )}
          </div>

          {/* Partner wise summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {partnerBreakdown.map(p => (
              <div key={p.name} className="ratio-box" style={{ flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{p.name}</span>
                  <span className={`badge ${p.net >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.68rem' }}>
                    {p.net >= 0 ? 'રોકાણકાર' : 'ઉપાડદાર'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>કુલ રોકાણ: ₹{p.invested.toLocaleString('en-IN')}</span>
                  <span>ઉપાડ: ₹{p.withdrawn.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: p.net >= 0 ? 'var(--success)' : 'var(--error)', marginTop: '4px' }}>
                  ચોખ્ખી સિલક: ₹{p.net.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>

          {/* Investments Table */}
          {investments.length === 0 ? (
            <EmptyState icon={TrendingUp} message="હજુ સુધી કોઈ રોકાણ અથવા ઉપાડની નોંધ થયેલ નથી." />
          ) : (
            <div className="accountant-table-wrap">
              <table className="accountant-table">
                <thead>
                  <tr>
                    <th>તારીખ</th>
                    <th>વ્યક્તિ / ભાગીદારનું નામ</th>
                    <th>વ્યવહાર પ્રકાર</th>
                    <th className="num-cell">જમા [રોકાણ / CR]</th>
                    <th className="num-cell">ઉધાર [ઉપાડ / DR]</th>
                    {canManage && <th style={{ textAlign: 'center' }}>ક્રિયા</th>}
                  </tr>
                </thead>
                <tbody>
                  {investments.map(inv => (
                    <tr key={inv.id}>
                      <td className="col-date">{new Date(inv.date).toLocaleDateString('gu-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inv.person_name}</td>
                      <td>
                        <span className={`status-pill ${inv.type === 'INVESTMENT' ? 'status-paid' : 'status-pending'}`}>
                          {inv.type === 'INVESTMENT' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {inv.type === 'INVESTMENT' ? 'રોકાણ (Capital Inflow)' : 'ઉપાડ (Drawings Outflow)'}
                        </span>
                      </td>
                      <td className="num-cell text-credit">
                        {inv.type === 'INVESTMENT' ? `₹${inv.amount.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="num-cell text-debit">
                        {inv.type === 'WITHDRAWAL' ? `₹${inv.amount.toLocaleString('en-IN')}` : '-'}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn-icon"
                            style={{ color: 'var(--error)', width: '28px', height: '28px' }}
                            onClick={() => handleDeleteInvestment(inv.id)}
                            title="કાઢી નાખો"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 800 }}>કુલ મૂડી સરવાળો</td>
                    <td className="num-cell text-credit">₹{totalInvested.toLocaleString('en-IN')}</td>
                    <td className="num-cell text-debit">₹{totalWithdrawn.toLocaleString('en-IN')}</td>
                    {canManage && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB 4: AUDIT & FINANCIAL RATIOS ═══════════ */}
      {activeTab === 'ratios' && (
        <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
          <h3 className="card-title" style={{ marginBottom: '14px', borderBottom: 'none', paddingBottom: 0 }}>
            નાણાકીય ગુણોત્તર અને ઓડિટ વિશ્લેષણ (Financial Health & Audit Ratios)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '-10px', marginBottom: '16px' }}>
            ધંધાની નફાકારકતા, સંચાલન કાર્યક્ષમતા અને આર્થિક સ્થિરતાનું પ્રમાણિત વિશ્લેષણ.
          </p>

          <div className="financial-ratios-grid">
            <div className="ratio-box">
              <div className="ratio-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: 'var(--success)' }}>
                <Calculator size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="acc-kpi-title">ચોખ્ખો નફો ગુણોત્તર (Net Margin)</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {netMargin.toFixed(2)}%
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {netMargin >= 20 ? 'ઉચ્ચ નફાકારક શ્રેણી' : netMargin >= 10 ? 'મધ્યમ સ્વીકાર્ય નફો' : 'નફામાં સુધારાની જરૂર'}
                </span>
              </div>
            </div>

            <div className="ratio-box">
              <div className="ratio-icon" style={{ background: 'rgba(96, 165, 250, 0.15)', color: 'var(--secondary)' }}>
                <SlidersHorizontal size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="acc-kpi-title">કાચો નફો ગુણોત્તર (Gross Margin)</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {grossMargin.toFixed(2)}%
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  ખરીદી ખર્ચ બાદ કર્યા પછી ઉપલબ્ધ ગ્રોસ માર્જિન
                </span>
              </div>
            </div>

            <div className="ratio-box">
              <div className="ratio-icon" style={{ background: 'rgba(251, 191, 36, 0.15)', color: 'var(--warning)' }}>
                <Clock size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="acc-kpi-title">સરેરાશ માસિક ટર્નઓવર</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  ₹{Math.round(avgMonthlyRev).toLocaleString('en-IN')}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {filteredRecords.length} મહિનાના ડેટા પર આધારિત રન-રેટ
                </span>
              </div>
            </div>

            <div className="ratio-box">
              <div className="ratio-icon" style={{ background: 'rgba(167, 139, 250, 0.15)', color: 'var(--accent)' }}>
                <TrendingUp size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="acc-kpi-title">સૌથી વધુ આવક ધરાવતો મહિનો</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {maxMonthRevRecord ? `₹${maxMonthRevRecord.revenue.toLocaleString('en-IN')}` : '-'}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {maxMonthRevRecord ? `તારીખ: ${maxMonthRevRecord.displayDate}` : 'કોઈ ડેટા નથી'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODALS ═══════════ */}

      {/* Add / Edit Record Modal */}
      <Modal
        show={showRecordModal && !!currentBiz}
        onClose={() => setShowRecordModal(false)}
        title={editingRecordId ? `વાઉચર સુધારો (#${editingRecordId})` : `નવી ખાતાવહી એન્ટ્રી (${currentBiz.name})`}
        maxWidth="720px"
      >
        <form onSubmit={handleSaveBusinessRecord} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">તારીખ *</label>
              <input
                type="date"
                className="input-field"
                value={bizDate}
                onChange={e => setBizDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">વાઉચર / બિલ નંબર</label>
              <input
                type="text"
                className="input-field"
                placeholder="દા.ત. VCH-102"
                value={bizVoucherNo}
                onChange={e => setBizVoucherNo(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">ચુકવણી સ્થિતિ</label>
              <select
                className="input-field"
                value={bizStatus}
                onChange={e => setBizStatus(e.target.value as any)}
              >
                <option value="ચૂકવેલ">ચૂકવેલ (Settled / Paid)</option>
                <option value="બાકી">બાકી (Pending / Due)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--success)' }}>વેચાણ આવક [જમા / CR] *</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={bizRevenue}
                onChange={e => setBizRevenue(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--error)' }}>માલ ખરીદી ખર્ચ [ઉધાર / DR]</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={bizCost}
                onChange={e => setBizCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--error)' }}>સંચાલન ખર્ચ [ઉધાર / DR]</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={bizExpenses}
                onChange={e => setBizExpenses(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">ચુકવણી પદ્ધતિ (Mode)</label>
              <select
                className="input-field"
                value={bizPaymentMode}
                onChange={e => setBizPaymentMode(e.target.value)}
              >
                <option value="રોકડ (Cash)">રોકડ (Cash)</option>
                <option value="બેંક ટ્રાન્સફર (NEFT/RTGS)">બેંક ટ્રાન્સફર (NEFT/RTGS)</option>
                <option value="UPI / QR કોડ">UPI / QR કોડ</option>
                <option value="ચેક (Cheque)">ચેક (Cheque)</option>
                <option value="ક્રેડિટ / ઉધાર">ક્રેડિટ / ઉધાર</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">વિગત / શેરો (Particulars / Notes)</label>
              <input
                type="text"
                className="input-field"
                placeholder="પાર્ટીનું નામ, માલની વિગત કે ચૂકવણી નોંધ..."
                value={bizParticulars}
                onChange={e => setBizParticulars(e.target.value)}
              />
            </div>
          </div>

          {/* Dynamic Global Custom Columns */}
          {currentBiz.custom_columns && currentBiz.custom_columns.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '10px', marginTop: '6px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', color: 'var(--secondary)' }}>
                વ્યવસાયિક ખાતા કોલમો (Custom Columns)
              </label>
              <div className="form-grid">
                {currentBiz.custom_columns.map((col: string) => (
                  <div className="form-group" key={col}>
                    <label className="form-label">{col}</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="0.00"
                      value={globalCustomValues[col] || ''}
                      onChange={e => setGlobalCustomValues({ ...globalCustomValues, [col]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Dynamic Tags */}
          <div style={{ border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '12px', marginTop: '6px', background: 'var(--bg-input)' }}>
            <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
              વિશેષ વિગતો (Additional Custom Fields)
            </label>
            {customFields.length > 0 && (
              <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {customFields.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                    <span><strong>{f.key}:</strong> {f.value}</span>
                    <button type="button" onClick={() => handleRemoveCustomField(i)} className="btn-icon" style={{ color: 'var(--error)', width: '24px', height: '24px' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                className="input-field"
                placeholder="ફીલ્ડ નામ (દા.ત. જીએસટી, કમિશન)"
                value={newFieldName}
                onChange={e => setNewFieldName(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: '0.8rem' }}
              />
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="રકમ"
                value={newFieldValue}
                onChange={e => setNewFieldValue(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: '0.8rem' }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCustomField}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Realtime Calculation Preview */}
          <div style={{ background: modalNetProfit >= 0 ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)', border: `1px solid ${modalNetProfit >= 0 ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`, borderRadius: 'var(--radius-md)', padding: '10px 14px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              ગણતરી સારાંશ: ચોખ્ખો નફો
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: modalNetProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
              ₹{modalNetProfit.toLocaleString('en-IN')} (માર્જિન: {modalMargin}%)
            </span>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowRecordModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {editingRecordId ? 'સુધારો સાચવો' : 'ખાતાવહીમાં નોંધો'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Investment Modal */}
      <Modal show={showInvModal && !!currentBiz} onClose={() => setShowInvModal(false)} title="મૂડી રોકાણ / ઉપાડ નોંધ" maxWidth="480px">
        <form onSubmit={handleAddInvestment} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">વ્યક્તિ / ભાગીદારનું નામ *</label>
            <input
              type="text"
              className="input-field"
              placeholder="દા.ત. કેયુરભાઈ, જયેશભાઈ"
              value={invPersonName}
              onChange={e => setInvPersonName(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">વ્યવહાર પ્રકાર *</label>
              <select
                className="input-field"
                value={invType}
                onChange={e => setInvType(e.target.value as "INVESTMENT" | "WITHDRAWAL")}
                required
              >
                <option value="INVESTMENT">રોકાણ (Capital Inflow / જમા)</option>
                <option value="WITHDRAWAL">ઉપાડ (Drawings / ઉધાર)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">તારીખ *</label>
              <input
                type="date"
                className="input-field"
                value={invDate}
                onChange={e => setInvDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">રકમ (₹) *</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              placeholder="0.00"
              value={invAmount}
              onChange={e => setInvAmount(e.target.value)}
              required
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowInvModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>સાચવો</button>
          </div>
        </form>
      </Modal>

      {/* Add Column Modal */}
      <Modal show={showAddColumnModal && !!currentBiz} onClose={() => setShowAddColumnModal(false)} title="ખાતાવહીમાં નવી કાયમી કોલમ ઉમેરો" maxWidth="420px">
        <form onSubmit={handleAddGlobalColumn} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">કોલમનું નામ *</label>
            <input
              type="text"
              className="input-field"
              placeholder="દા.ત. Diamond Duty, જીએસટી, કમિશન"
              value={newGlobalColumnName}
              onChange={e => setNewGlobalColumnName(e.target.value)}
              required
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
              આ કોલમ આ વ્યવસાયના દરેક માસિક પત્રકમાં કાયમી રીતે દેખાશે.
            </small>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddColumnModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>કોલમ ઉમેરો</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
