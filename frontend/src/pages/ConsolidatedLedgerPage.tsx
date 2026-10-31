import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, Printer, Search, Filter,
  BookOpen, CheckCircle2, ChevronDown, ChevronUp,
  FileText, RefreshCw, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { consolidatedApi } from '../api';
import type {
  ConsolidatedTransaction,
  ConsolidatedSummary,
  ConsolidatedUploadResponse
} from '../api';
import Modal from '../components/ui/Modal';
import LoadingScreen from '../components/ui/LoadingScreen';
import EmptyState from '../components/ui/EmptyState';

const ACCOUNT_GUJARATI_NAMES: Record<string, string> = {
  'INCOME:M.J & J.T': 'M.J & J.T ટ્રેડિંગ આવક',
  'INCOME:EMBRO-PRISHA FAB': 'પ્રિશા ફેબ એમ્બ્રોઈડરી આવક',
  'INCOME:LOOMS': 'લૂમ્સ ખાતાની આવક',
  'ASSETS:DAIMOND KG': 'કેયુર જેમ્સ હીરા વેપાર',
  'INCOME:Other Income': 'અન્ય આવક (ભાડું/પગાર)',
  'LIABILITIES:UCHINA LIDHELA': 'ઉછીના લીધેલા (UCHINA LIDHELA)',
  'LIABILITIES:VALLBHBHAI N.': 'વલ્લભભાઈ એન. લોન',
  'LIABILITIES:BHARATBHAI GARAGE': 'ભારતભાઈ ગેરેજ લોન',
  'LIABILITIES:GoldLoan': 'ગોલ્ડ લોન (Gold Loan)',
  'LIABILITIES:DADA': 'દાદા ખાતે લોન',
  'LIABILITIES:DEVANA CM CO.': 'દેવાના CM CO.',
  'ASSETS:UCHINA APELA': 'ઉછીના આપેલા (UCHINA APELA)',
  'ASSETS:EMBRO-HARDIK/RAVI-INVEST XX': 'એમ્બ્રોઈડરી રોકાણ (હાર્દિક/રવિ)',
  'ASSETS:EMBRO-AKASH/MAYANK-INVEST PF': 'એમ્બ્રોઈડરી રોકાણ (આકાશ/મયંક)',
  'EXPENSES:BHEGA:BIG': 'મોટા ઘરખર્ચ (મકાન/પ્રસંગ)',
  'EXPENSES:BHEGA:Monthly': 'નિયમિત માસિક ઘરખર્ચ',
  'EXPENSES:BHEGA:Small': 'પરચૂરણ રોજિંદો ઘરખર્ચ',
  'EXPENSES:Medical': 'મેડિકલ & હોસ્પિટલ',
  'EXPENSES:School & Education': 'શિક્ષણ & સ્કૂલ ફી',
  'EXPENSES:Intrest & EMIs': 'વ્યાજ & લોન EMI',
  'EXPENSES:Car & Bike': 'વાહન ખર્ચ (પેટ્રોલ/રીપેરીંગ)',
  'EXPENSES:TRAVEL': 'પ્રવાસ અને ટૂર ખર્ચ',
  'EXPENSES:Mobile & Recharge': 'મોબાઈલ રિચાર્જ',
  'EXPENSES:Insuranse': 'મેડિક્લેમ ઇન્સ્યોરન્સ',
  'Cap. Old-Money 24-25': 'જૂની મૂડી ૨૦૨૪-૨૫',
  'Capital Acc': 'મૂડી ખાતું (Capital Acc)',
};

export default function ConsolidatedLedgerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Data states
  const [transactions, setTransactions] = useState<ConsolidatedTransaction[]>([]);
  const [summary, setSummary] = useState<ConsolidatedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters: FY, Month, Same nu Khatu (સામેનું ખાતું), Flow Type (આવક/ખર્ચ)
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all'); // સામેનું ખાતું
  const [selectedFlow, setSelectedFlow] = useState<string>('all'); // 'all' | 'income' | 'expense'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(!isMobile);

  // View Mode: 'simple' (Cashbook) vs 'pro' (Double Entry Ledger)
  const [ledgerMode, setLedgerMode] = useState<'simple' | 'pro'>('simple');
  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ConsolidatedUploadResponse | null>(null);

  // Reset Confirmation Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Color helper for Business Stream badge
  const getStreamBadgeStyle = (stream: string) => {
    if (!stream) return { bg: 'rgba(107, 114, 128, 0.12)', color: 'var(--text-secondary)', border: 'rgba(107, 114, 128, 0.25)' };
    if (stream.includes('લૂમ્સ') || stream.includes('LOOMS')) {
      return { bg: 'rgba(6, 182, 212, 0.14)', color: '#0891b2', border: 'rgba(6, 182, 212, 0.35)' };
    }
    if (stream.includes('પ્રિશા') || stream.includes('એમ્બ્રોઈડરી')) {
      return { bg: 'rgba(168, 85, 247, 0.14)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.35)' };
    }
    if (stream.includes('કેયુર') || stream.includes('હીરા')) {
      return { bg: 'rgba(245, 158, 11, 0.14)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)' };
    }
    if (stream.includes('M.J') || stream.includes('J.T')) {
      return { bg: 'rgba(59, 130, 246, 0.14)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.35)' };
    }
    if (stream.includes('ઘરખર્ચ')) {
      return { bg: 'rgba(239, 68, 68, 0.14)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.35)' };
    }
    if (stream.includes('લોન') || stream.includes('ઉછીના')) {
      return { bg: 'rgba(249, 115, 22, 0.14)', color: '#ea580c', border: 'rgba(249, 115, 22, 0.35)' };
    }
    if (stream.includes('મૂડી') || stream.includes('રોકાણ')) {
      return { bg: 'rgba(16, 185, 129, 0.14)', color: '#059669', border: 'rgba(16, 185, 129, 0.35)' };
    }
    return { bg: 'rgba(107, 114, 128, 0.12)', color: 'var(--text-secondary)', border: 'rgba(107, 114, 128, 0.25)' };
  };

  // Initial fetch: Load summary and first 15 transactions
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const filterParams = {
        financial_year: selectedYear,
        month: selectedMonth,
        primary_account: selectedAccount,
        flow_type: selectedFlow,
        search: searchQuery.trim() || undefined,
        skip: 0,
        limit: 15,
      };

      const [txList, sumData] = await Promise.all([
        consolidatedApi.getTransactions(filterParams),
        consolidatedApi.getSummary(filterParams),
      ]);

      setTransactions(txList);
      setSummary(sumData);
    } catch (err: any) {
      console.error('Failed to load consolidated ledger', err);
      showToast('ડેટા લોડ કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load More: Fetch next 15 records and append
  const handleLoadMore = async () => {
    if (loadingMore) return;
    try {
      setLoadingMore(true);
      const filterParams = {
        financial_year: selectedYear,
        month: selectedMonth,
        primary_account: selectedAccount,
        flow_type: selectedFlow,
        search: searchQuery.trim() || undefined,
        skip: transactions.length,
        limit: 15,
      };
      const moreList = await consolidatedApi.getTransactions(filterParams);
      if (moreList.length > 0) {
        setTransactions(prev => [...prev, ...moreList]);
      } else {
        showToast('હવે કોઈ વધારાના વ્યવહારો નથી.', 'info');
      }
    } catch (err: any) {
      console.error('Failed to load more records', err);
      showToast('વધુ વ્યવહારો લોડ કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, selectedAccount, selectedFlow]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle CSV file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  // Upload CSV handler (Full clean sync/replace as requested)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('કૃપા કરીને CSV ફાઇલ પસંદ કરો.', 'error');
      return;
    }

    setUploadLoading(true);
    try {
      const res = await consolidatedApi.upload(selectedFile);
      setUploadResult(res);

      if (res.new_transactions_added > 0) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'info');
      }

      // Refresh list
      fetchData();
    } catch (err: any) {
      console.error('Upload failed', err);
      const detail = err.response?.data?.detail || 'ફાઇલ અપલોડ કરવામાં નિષ્ફળતા મળી.';
      showToast(detail, 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  // Delete transaction handler
  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('શું તમે ખરેખર આ વ્યવહાર કાઢી નાખવા માંગો છો?')) return;
    try {
      await consolidatedApi.deleteTransaction(id);
      showToast('વ્યવહાર કાઢી નાખવામાં આવ્યો.', 'success');
      fetchData();
    } catch (err: any) {
      showToast('કાઢી નાખવામાં નિષ્ફળતા મળી.', 'error');
    }
  };

  // Reset all records handler
  const handleResetAll = async () => {
    setResetLoading(true);
    try {
      const res = await consolidatedApi.resetAll();
      showToast(res.message, 'success');
      setShowResetModal(false);
      fetchData();
    } catch (err: any) {
      showToast('રીસેટ કરવામાં ભૂલ આવી.', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  // Month formatter helper (e.g. 2026-08 -> ઓગસ્ટ ૨૦૨૬)
  const formatMonthGujarati = (mStr: string) => {
    if (!mStr || mStr === 'all') return 'તમામ મહિના';
    const [y, m] = mStr.split('-');
    const monthNames: Record<string, string> = {
      '01': 'જાન્યુઆરી', '02': 'ફેબ્રુઆરી', '03': 'માર્ચ',
      '04': 'એપ્રિલ', '05': 'મે', '06': 'જૂન',
      '07': 'જુલાઈ', '08': 'ઓગસ્ટ', '09': 'સપ્ટેમ્બર',
      '10': 'ઓક્ટોબર', '11': 'નવેમ્બર', '12': 'ડિસેમ્બર'
    };
    return `${monthNames[m] || m} ${y}`;
  };

  // Available accounts from summary
  const availableAccounts = summary?.available_accounts || [];

  if (loading) return <LoadingScreen />;

  return (
    <div className="animate-slide-up">
      {/* ═══════ PRINT HEADER ═══════ */}
      <div className="print-only print-header">
        <h1>વડસક પરિવાર — બધા નો મિક્સ હિસાબ (Master Cashbook)</h1>
        <p>સંયુક્ત ધંધાકીય અને પારિવારિક ખાતાવહી અહેવાલ</p>
        <p style={{ fontSize: '9pt', color: '#666' }}>
          તારીખ: {new Date().toLocaleDateString('gu-IN')} | નાણાકીય વર્ષ: {selectedYear === 'all' ? 'તમામ' : selectedYear} | મહિનો: {formatMonthGujarati(selectedMonth)} | સામેનું ખાતું: {selectedAccount === 'all' ? 'તમામ' : selectedAccount}
        </p>
      </div>

      {/* ═══════ TOP NAVIGATION & ACTIONS ═══════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <button className="back-navigation-btn" onClick={() => navigate('/dashboard/business')} style={{ margin: 0 }}>
          <ArrowLeft size={16} />
          <span>ધંધાકીય પોર્ટલ</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            title="અહેવાલ પ્રિન્ટ / PDF"
          >
            <Printer size={14} />
            <span className={isMobile ? 'hide-on-mobile' : ''}>પ્રિન્ટ</span>
          </button>

          {user?.role === 'admin' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setSelectedFile(null);
                setUploadResult(null);
                setShowUploadModal(true);
              }}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
            >
              <Upload size={14} />
              <span>માસિક CSV અપલોડ</span>
            </button>
          )}

          {user?.role === 'admin' && transactions.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowResetModal(true)}
              title="તમામ ડેટા સાફ કરો"
              style={{ color: 'var(--error)' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ═══════ OFFICIAL MASTER BANNER ═══════ */}
      <div
        className="glass-card entity-banner"
        style={{
          marginTop: '4px',
          padding: isMobile ? '12px 14px' : '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.18), rgba(245, 158, 11, 0.12))',
          border: '1px solid rgba(245, 158, 11, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px' }}>
          <div
            style={{
              width: isMobile ? '38px' : '48px',
              height: isMobile ? '38px' : '48px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
            }}
          >
            <BookOpen size={isMobile ? 20 : 24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                બધા નો મિક્સ હિસાબ
              </h2>
              <span className="badge badge-primary" style={{ fontSize: '0.62rem', background: '#d97706' }}>
                માસ્ટર કેશબુક
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.72rem' : '0.82rem', margin: '2px 0 0' }}>
              લૂમ્સ, પ્રિશા ફેબ, હીરા વેપાર, ઉછીના-લોન અને સંયુક્ત પરિવારનો સંકલિત હિસાબ
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            કુલ વ્યવહારો
          </span>
          <p style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
            {summary?.total_count || 0}
          </p>
        </div>
      </div>

      {/* ═══════ HIGH-DENSITY EXECUTIVE KPIS (ZERO GRAPHS) ═══════ */}
      <div className="acc-kpi-grid mix-kpi-grid" style={{ marginTop: '12px' }}>
        <div className="acc-kpi-card kpi-income">
          <div className="acc-kpi-header">
            <span className="acc-kpi-title">પસંદ કરેલી કુલ આવક</span>
            <span className="acc-kpi-badge badge-success">આવક (+)</span>
          </div>
          <div className="acc-kpi-value text-credit">
            ₹{(summary?.period_inflow || 0).toLocaleString('en-IN')}
          </div>
          <div className="acc-kpi-subtext">
            <span>રોકડમાં જમા થયેલ રકમ</span>
          </div>
        </div>

        <div className="acc-kpi-card kpi-expense">
          <div className="acc-kpi-header">
            <span className="acc-kpi-title">પસંદ કરેલ કુલ ખર્ચ</span>
            <span className="acc-kpi-badge badge-danger">જાવક (-)</span>
          </div>
          <div className="acc-kpi-value text-debit">
            ₹{(summary?.period_outflow || 0).toLocaleString('en-IN')}
          </div>
          <div className="acc-kpi-subtext">
            <span>રોકડમાંથી ચૂકવેલ રકમ</span>
          </div>
        </div>

        <div className="acc-kpi-card kpi-profit">
          <div className="acc-kpi-header">
            <span className="acc-kpi-title">ચોખ્ખો રોકડ ફેરફાર</span>
            <span className="acc-kpi-badge badge-primary">સમયગાળો</span>
          </div>
          <div className={`acc-kpi-value ${(summary?.net_change || 0) >= 0 ? 'text-credit' : 'text-debit'}`}>
            ₹{(summary?.net_change || 0).toLocaleString('en-IN')}
          </div>
          <div className="acc-kpi-subtext">
            <span>{(summary?.net_change || 0) >= 0 ? 'ચોખ્ખી બચત' : 'વધારાનો ઉપાડ'}</span>
          </div>
        </div>

        <div className="acc-kpi-card kpi-balance">
          <div className="acc-kpi-header">
            <span className="acc-kpi-title">કુલ રોકડ સિલક</span>
            <span className="acc-kpi-badge badge-warning">કેશબુક</span>
          </div>
          <div className="acc-kpi-value" style={{ color: 'var(--warning)' }}>
            ₹{(summary?.net_cash_balance || 0).toLocaleString('en-IN')}
          </div>
          <div className="acc-kpi-subtext">
            <span>હાથ પર રહેલ કેશબુક સિલક</span>
          </div>
        </div>
      </div>

      {/* ═══════ POWERFUL MULTI-FILTER BAR (SAME NU KHATU & INCOME/EXPENSE FILTERS) ═══════ */}
      <div
        className="glass-card"
        style={{
          marginTop: '12px',
          padding: isMobile ? '10px 12px' : '14px 18px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: isMobile ? '100%' : '240px' }}>
            <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="input-field"
              placeholder="વિગત, નોંધ અથવા સામેનું ખાતું શોધો..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.82rem', height: '36px', width: '100%' }}
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSearchQuery('')}
                style={{ padding: '4px', color: 'var(--text-muted)', flexShrink: 0 }}
                title="શોધ સાફ કરો"
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: '6px' }}>
            {/* View Mode Toggle: Simple vs Pro */}
            <div style={{ display: 'inline-flex', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border-glass)' }}>
              <button
                type="button"
                onClick={() => setLedgerMode('simple')}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  fontWeight: ledgerMode === 'simple' ? 700 : 500,
                  background: ledgerMode === 'simple' ? 'var(--primary)' : 'transparent',
                  color: ledgerMode === 'simple' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: '0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                સરળ કેશબુક
              </button>
              <button
                type="button"
                onClick={() => setLedgerMode('pro')}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  fontWeight: ledgerMode === 'pro' ? 700 : 500,
                  background: ledgerMode === 'pro' ? 'var(--primary)' : 'transparent',
                  color: ledgerMode === 'pro' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: '0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                ખાતાવહી (CA)
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowFilters(!showFilters)}
              style={{ height: '36px', padding: '0 10px' }}
            >
              <Filter size={13} />
              <span>ફિલ્ટર્સ</span>
              {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Collapsible Filters Row: Financial Year, Month, Same nu Khatu (સામેનું ખાતું), Flow Type */}
        {showFilters && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: '8px',
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-glass)',
            }}
          >
            {/* 1. Financial Year */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '3px' }}>
                નાણાકીય વર્ષ (FY)
              </label>
              <select
                className="input-field mix-filter-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="all">તમામ વર્ષો</option>
                {summary?.available_years.map((y) => (
                  <option key={y} value={y}>
                    વર્ષ {y}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Month */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '3px' }}>
                મહિનો
              </label>
              <select
                className="input-field mix-filter-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">તમામ મહિના</option>
                {summary?.available_months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthGujarati(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. SAME NU KHATU (સામેનું ખાતું ફિલ્ટર) */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '3px', fontWeight: 700, color: 'var(--primary)' }}>
                📋 સામેનું ખાતું (Account)
              </label>
              <select
                className="input-field mix-filter-select"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                style={{ fontWeight: selectedAccount !== 'all' ? 700 : 500 }}
              >
                <option value="all">તમામ સામેના ખાતાઓ</option>
                {availableAccounts.map((acc) => {
                  const guj = ACCOUNT_GUJARATI_NAMES[acc];
                  return (
                    <option key={acc} value={acc}>
                      {guj ? `${acc} (${guj})` : acc}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 4. Income / Expense Flow Type (આવક / ખર્ચ ફિલ્ટર) */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '3px' }}>
                💰 આવક / ખર્ચ
              </label>
              <select
                className="input-field mix-filter-select"
                value={selectedFlow}
                onChange={(e) => setSelectedFlow(e.target.value)}
              >
                <option value="all">બધા વ્યવહારો</option>
                <option value="income">માત્ર આવક (+) જમા</option>
                <option value="expense">માત્ર ખર્ચ / જાવક (-) ઉધાર</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ TRANSACTIONS TABLE / LIST ═══════ */}
      <div className="glass-card" style={{ marginTop: '12px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <FileText size={16} color="var(--primary)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
              {ledgerMode === 'simple' ? 'સરળ રોકડ ખાતાવહી (Cashbook Entries)' : 'દ્વિ-નોંધી ખાતાવહી (Double Entry Splits)'}
            </h3>
            <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
              દર્શાવેલ: {transactions.length} / {summary?.total_count || 0}
            </span>
            {selectedAccount !== 'all' && (
              <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                ખાતું: {selectedAccount}
              </span>
            )}
          </div>

          <button
            className="btn-icon"
            onClick={fetchData}
            title="રિફ્રેશ કરો"
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div style={{ padding: '32px 16px' }}>
            <EmptyState
              icon={BookOpen}
              message="પસંદ કરેલા ફિલ્ટર્સ મુજબ કોઈ વ્યવહાર મળ્યો નથી. CSV ફાઇલ અપલોડ કરો અથવા ફિલ્ટર્સ બદલો."
            />
          </div>
        ) : ledgerMode === 'simple' ? (
          /* ═══════ SIMPLE CASHBOOK VIEW ═══════ */
          isMobile ? (
            /* MOBILE CASHBOOK CARDS */
            <div className="mix-mobile-tx-list">
              {transactions.map((tx) => {
                const streamStyle = getStreamBadgeStyle(tx.business_stream);
                const isExpanded = expandedTxId === tx.id;
                const cardTypeClass = tx.inflow > 0 ? 'tx-inflow' : tx.outflow > 0 ? 'tx-outflow' : 'tx-transfer';

                return (
                  <div
                    key={tx.id}
                    className={`mix-mobile-tx-card ${cardTypeClass}`}
                    onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                  >
                    <div className="mix-mobile-card-header">
                      <div className="mix-mobile-card-left">
                        <span className="mix-mobile-date">{tx.date}</span>
                        {tx.number && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            #{tx.number}
                          </span>
                        )}
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            background: streamStyle.bg,
                            color: streamStyle.color,
                            border: `1px solid ${streamStyle.border}`,
                          }}
                        >
                          {tx.business_stream}
                        </span>
                      </div>

                      <div className="mix-mobile-card-amount">
                        {tx.inflow > 0 ? (
                          <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.92rem' }}>
                            +₹{tx.inflow.toLocaleString('en-IN')}
                          </span>
                        ) : tx.outflow > 0 ? (
                          <span style={{ color: 'var(--error)', fontWeight: 800, fontSize: '0.92rem' }}>
                            -₹{tx.outflow.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>-</span>
                        )}
                      </div>
                    </div>

                    <div className="mix-mobile-card-desc">
                      {tx.description}
                    </div>

                    {tx.notes && (
                      <div className="mix-mobile-card-notes">
                        {tx.notes}
                      </div>
                    )}

                    <div className="mix-mobile-card-footer">
                      <div className="mix-mobile-card-account">
                        <span>સામેનું ખાતું:</span>
                        <code>{tx.primary_account}</code>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {ACCOUNT_GUJARATI_NAMES[tx.primary_account] || tx.category_group}
                        </span>
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTransaction(tx.id);
                            }}
                            style={{ color: 'var(--error)', padding: '2px' }}
                            title="વ્યવહાર કાઢી નાખો"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Split Details */}
                    {isExpanded && tx.splits && tx.splits.length > 0 && (
                      <div className="mix-mobile-split-drawer">
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          દ્વિ-નોંધી એન્ટ્રી વિગત (Splits):
                        </div>
                        {tx.splits.map((s) => (
                          <div key={s.id} className="mix-mobile-split-row">
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-main)' }}>
                              {s.account_name} {s.memo ? `(${s.memo})` : ''}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: s.amount > 0 ? 'var(--success)' : s.amount < 0 ? 'var(--error)' : 'var(--text-muted)',
                              }}
                            >
                              {s.amount > 0 ? `+₹${s.amount.toLocaleString('en-IN')}` : s.amount < 0 ? `-₹${Math.abs(s.amount).toLocaleString('en-IN')}` : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* DESKTOP CASHBOOK TABLE */
            <div style={{ overflowX: 'auto' }}>
              <table className="acc-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, width: '95px' }}>તારીખ</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, width: '150px' }}>બિઝનેસ પ્રવાહ</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700 }}>વિગત / નોંધ</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, width: '220px' }}>સામેનું ખાતું</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'right', width: '120px' }}>આવક (+)</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'right', width: '120px' }}>જાવક (-)</th>
                    {user?.role === 'admin' && (
                      <th style={{ padding: '10px 14px', width: '40px' }}></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const streamStyle = getStreamBadgeStyle(tx.business_stream);

                    return (
                      <tr
                        key={tx.id}
                        style={{
                          borderBottom: '1px solid var(--border-glass)',
                          transition: 'background 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                      >
                        <td style={{ padding: '10px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          <strong>{tx.date}</strong>
                          {tx.number && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              #{tx.number}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '10px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: streamStyle.bg,
                              color: streamStyle.color,
                              border: `1px solid ${streamStyle.border}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tx.business_stream}
                          </span>
                        </td>

                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-main)' }}>
                            {tx.description}
                          </div>
                          {tx.notes && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {tx.notes}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            <code>{tx.primary_account}</code>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {ACCOUNT_GUJARATI_NAMES[tx.primary_account] || tx.category_group}
                          </div>
                        </td>

                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontSize: '0.86rem' }}>
                          {tx.inflow > 0 ? `+₹${tx.inflow.toLocaleString('en-IN')}` : '-'}
                        </td>

                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--error)', fontSize: '0.86rem' }}>
                          {tx.outflow > 0 ? `-₹${tx.outflow.toLocaleString('en-IN')}` : '-'}
                        </td>

                        {user?.role === 'admin' && (
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTransaction(tx.id);
                              }}
                              style={{ color: 'var(--error)', padding: '4px' }}
                              title="વ્યવહાર કાઢી નાખો"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ═══════ PRO ACCOUNTANT (DOUBLE ENTRY) VIEW ═══════ */
          <div style={{ padding: '12px' }}>
            <div className="pro-mobile-list">
              {transactions.map((tx) => {
                const streamStyle = getStreamBadgeStyle(tx.business_stream);

                return (
                  <div key={tx.id} className="pro-mobile-card">
                    <div className="pro-mobile-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{tx.date}</span>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            background: streamStyle.bg,
                            color: streamStyle.color,
                            border: `1px solid ${streamStyle.border}`,
                          }}
                        >
                          {tx.business_stream}
                        </span>
                        <span className="badge badge-secondary" style={{ fontSize: '0.62rem' }}>
                          {ACCOUNT_GUJARATI_NAMES[tx.primary_account] || tx.category_group}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Tx ID: <code style={{ fontSize: '0.68rem' }}>{tx.tx_guid.substring(0, 10)}...</code>
                      </div>
                    </div>

                    <div className="pro-mobile-card-desc">
                      {tx.description}
                    </div>

                    {tx.notes && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px', background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '4px' }}>
                        {tx.notes}
                      </div>
                    )}

                    <div className="pro-mobile-splits-list">
                      {tx.splits.map((s) => (
                        <div key={s.id} className="pro-mobile-split-item">
                          <div className="pro-mobile-split-info">
                            <span className="pro-mobile-split-acc">{s.account_name}</span>
                            <span className="pro-mobile-split-type">
                              {s.account_type} {s.memo ? `• ${s.memo}` : ''}
                            </span>
                          </div>
                          <div className="pro-mobile-split-badge">
                            {s.amount > 0 ? (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: 'rgba(52, 211, 153, 0.12)',
                                  color: 'var(--success)',
                                  border: '1px solid rgba(52, 211, 153, 0.25)',
                                }}
                              >
                                ઉધાર ₹{s.amount.toLocaleString('en-IN')}
                              </span>
                            ) : s.amount < 0 ? (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: 'var(--error)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                }}
                              >
                                જમા ₹{Math.abs(s.amount).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>-</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ LOAD MORE (વધુ લોડ કરો) BUTTON ═══════ */}
        {transactions.length < (summary?.total_count || 0) && (
          <div className="load-more-container">
            <button
              type="button"
              className="load-more-btn"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              <RefreshCw size={14} className={loadingMore ? 'animate-spin' : ''} />
              <span>
                {loadingMore
                  ? 'વધુ લોડ થઈ રહ્યું છે...'
                  : `વધુ ૧૫ વ્યવહારો જુઓ (${transactions.length} / ${summary?.total_count || 0})`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ═══════ CSV UPLOAD MODAL (WIPE OLD & INSERT NEW RECORDS) ═══════ */}
      <Modal
        show={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="માસિક CSV / GnuCash ફાઇલ અપલોડ કરો"
        maxWidth="520px"
      >
        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
          <div
            style={{
              border: selectedFile ? '2px solid var(--success)' : '2px dashed var(--border-glass-active)',
              borderRadius: 'var(--radius-md)',
              padding: '24px 16px',
              textAlign: 'center',
              background: selectedFile ? 'rgba(52, 211, 153, 0.06)' : 'rgba(255, 255, 255, 0.02)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => document.getElementById('csvFileInput')?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                setSelectedFile(e.dataTransfer.files[0]);
                setUploadResult(null);
              }
            }}
          >
            {selectedFile ? (
              <div>
                <CheckCircle2 size={36} color="var(--success)" style={{ margin: '0 auto 8px auto' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-main)' }}>
                  {selectedFile.name}
                </p>
                <span style={{ fontSize: '0.74rem', color: 'var(--success)', fontWeight: 600 }}>
                  ફાઇલ પસંદ થઈ ગઈ છે ({(selectedFile.size / 1024).toFixed(1)} KB) — બદલવા માટે ક્લિક કરો
                </span>
              </div>
            ) : (
              <div>
                <Upload size={32} color="var(--primary)" style={{ margin: '0 auto 8px auto' }} />
                <p style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-main)' }}>
                  દર મહિનાની CSV ફાઇલ અહીં ડ્રેગ કરો અથવા પસંદ કરો
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  (GnuCash એક્સપોર્ટ અથવા સ્ટાન્ડર્ડ એકાઉન્ટિંગ CSV)
                </span>
              </div>
            )}
            <input
              id="csvFileInput"
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Sync & replace notice */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.75rem',
              lineHeight: 1.4,
              color: 'var(--text-secondary)',
            }}
          >
            <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '2px' }}>
              🔄 પૂર્ણ રિપ્લેસમેન્ટ & સિંક:
            </strong>
            નવી CSV ફાઇલ અપલોડ કરવાથી જૂનો હિસાબ આપમેળે સાફ થશે અને આ ફાઇલના તમામ નવા વ્યવહારો તાજા ડેટા તરીકે ડેટાબેઝમાં સાચવવામાં આવશે.
          </div>

          {/* Upload Result Feedback */}
          {uploadResult && (
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px', color: 'var(--success)' }}>
                <CheckCircle2 size={15} />
                <span>{uploadResult.message}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px', color: 'var(--text-main)', fontSize: '0.72rem' }}>
                <div>કુલ વ્યવહારો: <strong>{uploadResult.total_transactions_in_file}</strong></div>
                <div>ઉમેરાયેલ: <strong>{uploadResult.new_transactions_added}</strong></div>
                {uploadResult.date_min && (
                  <div style={{ gridColumn: 'span 2' }}>
                    તારીખ ગાળો: <strong>{uploadResult.date_min} થી {uploadResult.date_max}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowUploadModal(false)}
            >
              બંધ કરો
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || uploadLoading}
              style={{
                background: selectedFile ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                color: selectedFile ? '#ffffff' : undefined,
                fontWeight: 700,
                opacity: (!selectedFile || uploadLoading) ? 0.6 : 1,
                cursor: (!selectedFile || uploadLoading) ? 'not-allowed' : 'pointer',
              }}
            >
              {uploadLoading ? 'ચકાસણી અને સેવ થઈ રહ્યું છે...' : 'અપલોડ કરો અને સેવ કરો'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════ RESET CONFIRMATION MODAL ═══════ */}
      <Modal
        show={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="તમામ ડેટા સાફ કરો (Reset Database)"
        maxWidth="440px"
      >
        <div style={{ padding: '8px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <p style={{ color: 'var(--error)', fontWeight: 700 }}>
            ⚠️ સાવચેતી: આ ક્રિયાથી "બધા નો મિક્સ હિસાબ" ના તમામ વ્યવહારો અને ખાતાવહી ડેટાબેઝમાંથી કાયમ માટે ડિલીટ થઈ જશે.
          </p>
          <p style={{ marginTop: '8px' }}>
            શું તમે ખરેખર આગળ વધવા માંગો છો? આ કર્યા પછી તમે ગમે ત્યારે CSV ફાઇલ ફરીથી અપલોડ કરી શકશો.
          </p>
        </div>

        <div className="modal-footer" style={{ marginTop: '14px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowResetModal(false)}
          >
            રદ કરો
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleResetAll}
            disabled={resetLoading}
          >
            {resetLoading ? 'સાફ થઈ રહ્યું છે...' : 'હા, તમામ ડેટા સાફ કરો'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
