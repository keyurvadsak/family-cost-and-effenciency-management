import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, Printer, Search, Filter,
  BookOpen, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
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

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all'); // 'all' | 'inflow' | 'outflow' | 'journal'
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

  // Fetch summary and transactions
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const filterParams = {
        financial_year: selectedYear,
        month: selectedMonth,
        category_group: selectedCategory,
        tx_type: selectedType,
        search: searchQuery.trim() || undefined,
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

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, selectedCategory, selectedType]);

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

  // Upload CSV handler with duplicate reporting
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

      if (res.is_duplicate_file) {
        showToast(res.message, 'warning');
      } else if (res.new_transactions_added > 0) {
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

  if (loading) return <LoadingScreen />;

  return (
    <div className="animate-slide-up">
      {/* ═══════ PRINT HEADER ═══════ */}
      <div className="print-only print-header">
        <h1>વડસક પરિવાર — બધા નો મિક્સ હિસાબ (Master Cashbook)</h1>
        <p>સંયુક્ત ધંધાકીય અને પારિવારિક ખાતાવહી અહેવાલ</p>
        <p style={{ fontSize: '9pt', color: '#666' }}>
          તારીખ: {new Date().toLocaleDateString('gu-IN')} | નાણાકીય વર્ષ: {selectedYear === 'all' ? 'તમામ' : selectedYear} | મહિનો: {formatMonthGujarati(selectedMonth)}
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

      {/* ═══════ POWERFUL MULTI-FILTER BAR ═══════ */}
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
              placeholder="વિગત, નોંધ અથવા ખાતું શોધો..."
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
              style={{ height: '36px', padding: '0 10px', whiteSpace: 'nowrap' }}
            >
              <Filter size={13} />
              <span>ફિલ્ટર્સ</span>
              {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Collapsible Filters Row */}
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
            {/* Financial Year */}
            <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
              <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', color: 'var(--text-muted)' }}>
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

            {/* Month */}
            <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
              <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', color: 'var(--text-muted)' }}>
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

            {/* Category Group */}
            <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
              <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', color: 'var(--text-muted)' }}>
                વર્ગીકરણ / ખાતું
              </label>
              <select
                className="input-field mix-filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">તમામ ખાતાઓ</option>
                {summary?.available_categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Type */}
            <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
              <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', color: 'var(--text-muted)' }}>
                પ્રકાર
              </label>
              <select
                className="input-field mix-filter-select"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="all">તમામ વ્યવહારો</option>
                <option value="inflow">આવક (+ Inflow)</option>
                <option value="outflow">જાવક (- Outflow)</option>
                <option value="journal">જર્નલ (ટ્રાન્સફર)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ TRANSACTIONS TABLE / LIST ═══════ */}
      <div className="glass-card" style={{ marginTop: '12px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="var(--primary)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
              {ledgerMode === 'simple' ? 'સરળ રોકડ ખાતાવહી (Cashbook Entries)' : 'દ્વિ-નોંધી ખાતાવહી (Double Entry Splits)'}
            </h3>
            <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
              {transactions.length} નોંધો
            </span>
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
          <div>
            {/* Desktop Table View */}
            <div className="hide-on-mobile" style={{ overflowX: 'auto' }}>
              <table className="acc-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, width: '100px' }}>તારીખ</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700 }}>વિગત / નોંધ</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, width: '140px' }}>વર્ગીકરણ</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'right', width: '120px' }}>આવક (+)</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'right', width: '120px' }}>જાવક (-)</th>
                    {user?.role === 'admin' && (
                      <th style={{ padding: '10px 14px', width: '40px' }}></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
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
                        <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-main)' }}>
                          {tx.description}
                        </div>
                        {tx.notes && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {tx.notes}
                          </div>
                        )}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          સામેનું ખાતું: <code>{tx.primary_account}</code>
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.68rem',
                            background: tx.inflow > 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: tx.inflow > 0 ? 'var(--success)' : 'var(--error)',
                            border: `1px solid ${tx.inflow > 0 ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                          }}
                        >
                          {tx.category_group}
                        </span>
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Clean, No Cutoff, Full Width) */}
            <div className="show-on-mobile-only mix-mobile-tx-list">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`mix-mobile-tx-card ${tx.inflow > 0 ? 'tx-inflow' : tx.outflow > 0 ? 'tx-outflow' : 'tx-transfer'}`}
                  onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                >
                  {/* Header: Date + Category Badge on left, Big colored Amount on right */}
                  <div className="mix-mobile-card-header">
                    <div className="mix-mobile-card-left">
                      <span className="mix-mobile-date">{tx.date}</span>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: tx.inflow > 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: tx.inflow > 0 ? 'var(--success)' : 'var(--error)',
                          border: `1px solid ${tx.inflow > 0 ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                      >
                        {tx.category_group}
                      </span>
                      {tx.number && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>#{tx.number}</span>
                      )}
                    </div>

                    <div className="mix-mobile-card-amount">
                      {tx.inflow > 0 ? (
                        <span className="text-credit" style={{ fontSize: '0.98rem', fontWeight: 800 }}>
                          +₹{tx.inflow.toLocaleString('en-IN')}
                        </span>
                      ) : tx.outflow > 0 ? (
                        <span className="text-debit" style={{ fontSize: '0.98rem', fontWeight: 800 }}>
                          -₹{tx.outflow.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>₹0</span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mix-mobile-card-desc">
                    {tx.description}
                  </div>

                  {/* Notes if any */}
                  {tx.notes && (
                    <div className="mix-mobile-card-notes">
                      {tx.notes}
                    </div>
                  )}

                  {/* Opposing Account + Action Footer */}
                  <div className="mix-mobile-card-footer">
                    <div className="mix-mobile-card-account">
                      <span>સામેનું:</span>
                      <code>{tx.primary_account}</code>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>
                        {expandedTxId === tx.id ? 'સંતાડો ▲' : `દ્વિ-નોંધ (${tx.splits.length}) ▼`}
                      </span>

                      {user?.role === 'admin' && (
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ color: 'var(--error)', padding: '3px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTransaction(tx.id);
                          }}
                          title="વ્યવહાર કાઢી નાખો"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Split Drawer (visible when clicked) */}
                  {expandedTxId === tx.id && (
                    <div className="mix-mobile-split-drawer" onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                        ખાતાવહી સ્પ્લિટ્સ (Double Entry Splits):
                      </div>
                      {tx.splits.map((s) => (
                        <div key={s.id} className="mix-mobile-split-row">
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.74rem', color: 'var(--text-main)', wordBreak: 'break-word' }}>
                              {s.account_name}
                            </div>
                            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                              {s.account_type} {s.memo ? `• ${s.memo}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                            {s.amount > 0 ? (
                              <span className="badge badge-success" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                                ઉધાર ₹{s.amount.toLocaleString('en-IN')}
                              </span>
                            ) : s.amount < 0 ? (
                              <span className="badge badge-danger" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                                જમા ₹{Math.abs(s.amount).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ═══════ PRO ACCOUNTANT (DOUBLE ENTRY) VIEW ═══════ */
          <div>
            {/* Desktop Pro View (4-column table inside card) */}
            <div className="hide-on-mobile" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{tx.date}</span>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>{tx.description}</span>
                        <span className="badge badge-secondary" style={{ fontSize: '0.62rem' }}>{tx.category_group}</span>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Tx ID: <code style={{ fontSize: '0.68rem' }}>{tx.tx_guid.substring(0, 12)}...</code>
                      </div>
                    </div>

                    {/* Splits Ledger Breakdown */}
                    <table style={{ width: '100%', fontSize: '0.75rem', marginTop: '6px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', borderBottom: '1px dashed var(--border-glass)' }}>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>ખાતાનું નામ (Account)</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', width: '90px' }}>પ્રકાર</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right', width: '110px' }}>ઉધાર (Debit)</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right', width: '110px' }}>જમા (Credit)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tx.splits.map((s) => (
                          <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '4px 6px', fontWeight: 500 }}>
                              {s.account_name}
                              {s.memo && <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.68rem' }}>({s.memo})</span>}
                            </td>
                            <td style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>{s.account_type}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: s.amount > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                              {s.amount > 0 ? `₹${s.amount.toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: s.amount < 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                              {s.amount < 0 ? `₹${Math.abs(s.amount).toLocaleString('en-IN')}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Pro View (High-density Split Item rows) */}
            <div className="show-on-mobile-only pro-mobile-list">
              {transactions.map((tx) => (
                <div key={tx.id} className="pro-mobile-card">
                  <div className="pro-mobile-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)' }}>{tx.date}</span>
                      <span className="badge badge-secondary" style={{ fontSize: '0.62rem' }}>{tx.category_group}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      ID: <code style={{ fontSize: '0.65rem' }}>{tx.tx_guid.substring(0, 10)}...</code>
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
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════ CSV UPLOAD MODAL WITH 100% DUPLICATE REPORTING ═══════ */}
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

          {/* Real-time duplicate protection notice */}
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
              🛡️ ૧૦૦% ડુપ્લિકેટ પ્રોટેક્શન સક્રિય:
            </strong>
            જો તમે એ જ ફાઇલ બીજી વાર અપલોડ કરશો તો સિસ્ટમ આપોઆપ શોધીને તેને સ્કીપ કરશે. કોઈ ડુપ્લિકેટ એન્ટ્રી ઉમેરાશે નહીં. નવા મહિનાના ફક્ત નવા વ્યવહારો જ ઉમેરાશે!
          </div>

          {/* Upload Result Feedback */}
          {uploadResult && (
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: uploadResult.is_duplicate_file
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(52, 211, 153, 0.12)',
                border: `1px solid ${uploadResult.is_duplicate_file ? 'rgba(245, 158, 11, 0.35)' : 'rgba(52, 211, 153, 0.35)'}`,
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px', color: uploadResult.is_duplicate_file ? 'var(--warning)' : 'var(--success)' }}>
                {uploadResult.is_duplicate_file ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                <span>{uploadResult.message}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px', color: 'var(--text-main)', fontSize: '0.72rem' }}>
                <div>કુલ વ્યવહારો: <strong>{uploadResult.total_transactions_in_file}</strong></div>
                <div>નવા ઉમેરાયેલ: <strong>{uploadResult.new_transactions_added}</strong></div>
                <div>સ્કીપ થયેલ (જૂના): <strong>{uploadResult.duplicate_transactions_skipped}</strong></div>
                {uploadResult.date_min && (
                  <div>તારીખ ગાળો: <strong>{uploadResult.date_min} થી {uploadResult.date_max}</strong></div>
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
