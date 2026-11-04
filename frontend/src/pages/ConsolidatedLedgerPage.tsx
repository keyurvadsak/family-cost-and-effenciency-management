import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Upload, Printer,
  BookOpen, ChevronDown, ChevronRight,
  RefreshCw, Trash2, Building,
  FolderOpen, Folder, CornerDownRight,
  Calendar, TrendingUp, Scale, Settings, Edit3, Save, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { consolidatedApi } from '../api';
import type {
  ConsolidatedSummary,
  ConsolidatedUploadResponse,
  AccountTreeNode,
  BalanceSheetData,
  IncomeStatementData,
  AccountStatementData,
  StatementItem,
  ConsolidatedAccountRecord
} from '../api';
import Modal from '../components/ui/Modal';
import LoadingScreen from '../components/ui/LoadingScreen';

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC CURRENCY FORMATTER (Indian Rupee ₹ Standards)
// ═══════════════════════════════════════════════════════════════════════════
const formatCurrency = (amount: number, showSign: boolean = false): string => {
  const isNegative = amount < 0;
  const absFormatted = Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isNegative) {
    return `-₹${absFormatted}`;
  }
  if (showSign && amount > 0) {
    return `+₹${absFormatted}`;
  }
  return `₹${absFormatted}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// RECURSIVE DYNAMIC STATEMENT ROW COMPONENT
// Stacks account name & Gujarati translation to prevent horizontal text clipping
// ═══════════════════════════════════════════════════════════════════════════
interface StatementRowProps {
  item: StatementItem;
  depth?: number;
  isMobile?: boolean;
  onSelectAccount: (fullName: string, gujaratiName?: string) => void;
}

const StatementItemRow: React.FC<StatementRowProps> = ({ item, depth = 0, isMobile = false, onSelectAccount }) => {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const indentStep = isMobile ? 8 : 14;
  const paddingLeft = depth === 0 ? '8px' : `${depth * indentStep + 8}px`;

  return (
    <>
      <tr style={{ background: hasChildren ? 'rgba(0, 0, 0, 0.02)' : 'transparent' }}>
        <td style={{ paddingLeft, padding: isMobile ? '5px 6px' : '7px 10px' }}>
          <div className="gnucash-acc-cell">
            <span
              className="gnucash-acc-link"
              onClick={() => onSelectAccount(item.full_name, item.gujarati_name)}
              title="આ ખાતાના વ્યવહારો જુઓ"
              style={{ fontWeight: hasChildren ? 750 : 500, fontSize: isMobile ? '0.74rem' : '0.82rem' }}
            >
              {item.name}
            </span>
            {item.gujarati_name && item.gujarati_name !== item.name && (
              <span className="gnucash-acc-guj" style={{ fontSize: isMobile ? '0.62rem' : '0.68rem' }}>
                ({item.gujarati_name})
              </span>
            )}
          </div>
        </td>
        <td
          className="gnucash-amt-cell"
          style={{
            fontWeight: hasChildren ? 750 : 500,
            fontSize: isMobile ? '0.76rem' : '0.83rem',
            color: item.balance < 0 ? 'var(--error)' : 'inherit',
            padding: isMobile ? '5px 6px' : '7px 10px',
            width: isMobile ? '88px' : '110px',
            minWidth: isMobile ? '82px' : '95px'
          }}
        >
          {formatCurrency(item.balance)}
        </td>
      </tr>

      {/* Recursively render child accounts at arbitrary depth */}
      {hasChildren &&
        item.children!.map((child) => (
          <StatementItemRow
            key={child.full_name}
            item={child}
            depth={depth + 1}
            isMobile={isMobile}
            onSelectAccount={onSelectAccount}
          />
        ))}
    </>
  );
};


export default function ConsolidatedLedgerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state persistence
  const initialView = (searchParams.get('view') as 'tree' | 'balance_sheet' | 'income_statement') || 'tree';
  const initialAccount = searchParams.get('account') || '';

  // 3 Primary Views
  const [viewMode, setViewMode] = useState<'tree' | 'balance_sheet' | 'income_statement'>(initialView);

  // Data states
  const [summary, setSummary] = useState<ConsolidatedSummary | null>(null);
  const [accountsTree, setAccountsTree] = useState<AccountTreeNode[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Income Statement date filters
  const [isStartDate, setIsStartDate] = useState('2025-11-01');
  const [isEndDate, setIsEndDate] = useState('2026-12-31');

  // Balance sheet as-of date
  const [bsAsOfDate, setBsAsOfDate] = useState('2026-12-31');

  // Expanded nodes in tree view
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Selected account modal / drawer ("one click to show that link")
  const [selectedAccountModal, setSelectedAccountModal] = useState<string | null>(initialAccount || null);
  const [accountStatement, setAccountStatement] = useState<AccountStatementData | null>(null);
  const [accountStatementLoading, setAccountStatementLoading] = useState(false);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ConsolidatedUploadResponse | null>(null);

  // Reset Confirmation Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Accounts Management Modal State (Dynamic Metadata Editor)
  const [showManageAccountsModal, setShowManageAccountsModal] = useState(false);
  const [accountsList, setAccountsList] = useState<ConsolidatedAccountRecord[]>([]);
  const [accountsListLoading, setAccountsListLoading] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editGujaratiName, setEditGujaratiName] = useState('');
  const [editBusinessStream, setEditBusinessStream] = useState('');
  const [saveAccountLoading, setSaveAccountLoading] = useState(false);

  // Helper for Account Type Badge Color
  const getTypeBadgeStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case 'asset':
        return { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.25)' };
      case 'expense':
        return { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' };
      case 'income':
        return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.25)' };
      case 'liability':
        return { bg: 'rgba(249, 115, 22, 0.12)', color: '#f97316', border: 'rgba(249, 115, 22, 0.25)' };
      case 'equity':
        return { bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.25)' };
      case 'bank':
      case 'cash':
        return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' };
      default:
        return { bg: 'rgba(107, 114, 128, 0.12)', color: '#6b7280', border: 'rgba(107, 114, 128, 0.25)' };
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD CORE DATA
  // ═══════════════════════════════════════════════════════════════════════════
  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const [sumRes, treeRes] = await Promise.all([
        consolidatedApi.getSummary(),
        consolidatedApi.getAccountsTree(),
      ]);

      setSummary(sumRes);
      setAccountsTree(treeRes);

      // Auto expand top level nodes
      const initialExpanded: Record<string, boolean> = {};
      treeRes.forEach((n) => {
        initialExpanded[n.full_name] = true;
        if (n.children) {
          n.children.forEach((c) => {
            initialExpanded[c.full_name] = true;
          });
        }
      });
      setExpandedNodes(initialExpanded);

      // Load Balance Sheet
      const bsData = await consolidatedApi.getBalanceSheet(bsAsOfDate);
      setBalanceSheet(bsData);

      // Load Income Statement
      const isData = await consolidatedApi.getIncomeStatement(isStartDate, isEndDate);
      setIncomeStatement(isData);

      if (isManualRefresh) {
        showToast('તમામ હિસાબ અને પત્રકો રિફ્રેશ થઈ ગયા છે', 'success');
      }
    } catch (err) {
      console.error('Failed to load consolidated data', err);
      showToast('ડેટા લોડ કરવામાં ભૂલ આવી', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reload BS when date changes
  useEffect(() => {
    const fetchBS = async () => {
      try {
        const bsData = await consolidatedApi.getBalanceSheet(bsAsOfDate);
        setBalanceSheet(bsData);
      } catch (err) {
        console.error('Failed to update balance sheet date', err);
      }
    };
    if (!loading) fetchBS();
  }, [bsAsOfDate]);

  // Reload IS when date changes
  useEffect(() => {
    const fetchIS = async () => {
      try {
        const isData = await consolidatedApi.getIncomeStatement(isStartDate, isEndDate);
        setIncomeStatement(isData);
      } catch (err) {
        console.error('Failed to update income statement date', err);
      }
    };
    if (!loading) fetchIS();
  }, [isStartDate, isEndDate]);

  // Handle URL account parameter
  useEffect(() => {
    const urlAcc = searchParams.get('account');
    if (urlAcc && urlAcc !== selectedAccountModal) {
      handleOpenAccountModal(urlAcc);
    }
  }, [searchParams]);

  const handleOpenAccountModal = async (accountFullName: string, _gujaratiName?: string) => {
    setSelectedAccountModal(accountFullName);
    setAccountStatementLoading(true);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('account', accountFullName);
      return next;
    });

    try {
      const data = await consolidatedApi.getAccountStatement(accountFullName);
      setAccountStatement(data);
    } catch (err) {
      console.error('Failed to fetch account statement', err);
      showToast('ખાતાવહી ડેટા લોડ ન થઈ શક્યો', 'error');
    } finally {
      setAccountStatementLoading(false);
    }
  };

  const handleCloseAccountModal = () => {
    setSelectedAccountModal(null);
    setAccountStatement(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('account');
      return next;
    });
  };

  const handleOpenManageAccounts = async () => {
    setShowManageAccountsModal(true);
    setAccountsListLoading(true);
    try {
      const list = await consolidatedApi.getAccountsList();
      setAccountsList(list);
    } catch (err) {
      console.error('Failed to load accounts list', err);
      showToast('ખાતાઓની યાદી લોડ ન થઈ શકી', 'error');
    } finally {
      setAccountsListLoading(false);
    }
  };

  const handleSaveAccount = async (account: ConsolidatedAccountRecord) => {
    setSaveAccountLoading(true);
    try {
      const updated = await consolidatedApi.updateAccount(account.id, {
        gujarati_name: editGujaratiName,
        business_stream: editBusinessStream,
      });
      setAccountsList(prev => prev.map(a => a.id === updated.id ? updated : a));
      setEditingAccountId(null);
      showToast(`'${updated.name}' અપડેટ થઈ ગયું`, 'success');
      loadData(false);
    } catch (err) {
      console.error('Failed to save account', err);
      showToast('ખાતું અપડેટ ન થઈ શક્યું', 'error');
    } finally {
      setSaveAccountLoading(false);
    }
  };

  const handleSyncAccounts = async () => {
    setAccountsListLoading(true);
    try {
      const res = await consolidatedApi.syncAccounts();
      showToast(`ખાતાઓ સિંક થઈ ગયા: ${res.added_count} નવા ખાતાઓ ઉમેરાયા`, 'success');
      const list = await consolidatedApi.getAccountsList();
      setAccountsList(list);
      loadData(false);
    } catch (err) {
      console.error('Failed to sync accounts', err);
      showToast('ખાતાઓ સિંક કરવામાં ભૂલ આવી', 'error');
    } finally {
      setAccountsListLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('કૃપા કરીને CSV ફાઇલ પસંદ કરો', 'error');
      return;
    }

    setUploadLoading(true);
    setUploadResult(null);

    try {
      const res = await consolidatedApi.upload(selectedFile);
      setUploadResult(res);
      showToast(`CSV સફળતાપૂર્વક અપલોડ થઈ: ${res.new_transactions_added} નવા વ્યવહારો`, 'success');
      loadData(true);
    } catch (err: any) {
      console.error('Upload failed', err);
      showToast(err.response?.data?.detail || 'CSV અપલોડ કરવામાં ભૂલ આવી', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleResetAll = async () => {
    setResetLoading(true);
    try {
      await consolidatedApi.resetAll();
      showToast('તમામ હિસાબ સાફ થઈ ગયો છે', 'success');
      setShowResetModal(false);
      loadData(true);
    } catch (err) {
      console.error('Reset failed', err);
      showToast('ડેટા રીસેટ કરવામાં ભૂલ આવી', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  const toggleNode = (fullName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [fullName]: !prev[fullName],
    }));
  };

  const expandAllNodes = () => {
    const allExp: Record<string, boolean> = {};
    const recurse = (nodes: AccountTreeNode[]) => {
      nodes.forEach(n => {
        allExp[n.full_name] = true;
        if (n.children) recurse(n.children);
      });
    };
    recurse(accountsTree);
    setExpandedNodes(allExp);
  };

  const collapseAllNodes = () => {
    setExpandedNodes({});
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px 6px' : '16px 20px', boxSizing: 'border-box' }}>
      {/* ═════════════════════ TOP NAVIGATION & COMPACT ACTION STRIP ═════════════════════ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          marginBottom: '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: isMobile ? '4px 8px' : '6px 12px',
            fontSize: isMobile ? '0.74rem' : '0.80rem',
            height: isMobile ? '28px' : '34px',
            flexShrink: 0
          }}
        >
          <ArrowLeft size={isMobile ? 13 : 15} />
          <span>ધંધાઓ</span>
        </button>

        {/* Compact Action Icon Strip: Never overflows on mobile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            type="button"
            className={`btn btn-secondary ${isMobile ? 'icon-btn-compact' : ''}`}
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="રિફ્રેશ કરો"
            style={!isMobile ? { width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } : undefined}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {!isMobile && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.print()}
              title="પ્રિન્ટ કરો"
              style={{ width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Printer size={14} />
            </button>
          )}

          <button
            type="button"
            className={`btn btn-secondary ${isMobile ? 'icon-btn-compact' : ''}`}
            onClick={handleOpenManageAccounts}
            title="ખાતાઓ ગોઠવો"
            style={!isMobile ? {
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '34px',
              padding: '0 12px',
              fontSize: '0.78rem'
            } : undefined}
          >
            <Settings size={13} />
            {!isMobile && <span>ખાતાઓ</span>}
          </button>

          {user?.role === 'admin' && (
            <>
              <button
                type="button"
                className={`btn btn-primary ${isMobile ? 'icon-btn-compact' : ''}`}
                onClick={() => {
                  setSelectedFile(null);
                  setUploadResult(null);
                  setShowUploadModal(true);
                }}
                title="CSV અપલોડ કરો"
                style={!isMobile ? {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '34px',
                  padding: '0 14px',
                  fontSize: '0.78rem'
                } : undefined}
              >
                <Upload size={13} />
                {!isMobile && <span>માસિક CSV</span>}
              </button>

              <button
                type="button"
                className={`btn btn-outline-danger ${isMobile ? 'icon-btn-compact' : ''}`}
                onClick={() => setShowResetModal(true)}
                title="ડેટા સાફ કરો"
                style={!isMobile ? { width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } : undefined}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═════════════════════ HERO / SUMMARY BANNER (High-Density Mobile Header) ═════════════════════ */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.07) 0%, rgba(245, 158, 11, 0.02) 100%)',
          borderColor: 'rgba(217, 119, 6, 0.22)',
          padding: isMobile ? '8px 10px' : '14px 18px',
          marginBottom: '8px',
          boxSizing: 'border-box'
        }}
      >
        {/* Compact Title Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', minWidth: 0 }}>
            <div
              style={{
                width: isMobile ? '26px' : '36px',
                height: isMobile ? '26px' : '36px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
                flexShrink: 0
              }}
            >
              <BookOpen size={isMobile ? 15 : 18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: isMobile ? '0.90rem' : '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  બધા નો મિક્સ હિસાબ
                </h1>
                <span className="badge badge-warning" style={{ fontSize: '0.60rem', padding: '1px 5px', flexShrink: 0 }}>
                  {summary ? summary.total_count : 0} વ્યવહારો
                </span>
              </div>
              {!isMobile && (
                <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  લૂમ્સ, પ્રિશા ફેબ, હીરા વેપાર, ઉછીના-લોન અને સંયુક્ત પરિવારનો સંકલિત હિસાબ
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 4 Compact Stat Tiles with Equal Heights & Zero Clipping */}
        {summary && (
          <div className="compact-stat-grid" style={{ marginTop: '8px', gap: isMobile ? '6px' : '10px' }}>
            {/* Card 1: Rokad Silak */}
            <div className="compact-stat-card" style={{ borderLeftColor: '#10b981' }}>
              <div className="compact-stat-header">
                <span className="compact-stat-title">રોકડ સિલક</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>CASH</span>
              </div>
              <div className={`compact-stat-value ${summary.net_cash_balance >= 0 ? 'text-credit' : 'text-debit'}`}>
                {formatCurrency(summary.net_cash_balance)}
              </div>
              {!isMobile && <span className="compact-stat-sub">હાથ પર રોકડ</span>}
            </div>

            {/* Card 2: Period Inflow */}
            <div className="compact-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
              <div className="compact-stat-header">
                <span className="compact-stat-title">કુલ આવક</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>જમા (+)</span>
              </div>
              <div className="compact-stat-value text-credit">
                {formatCurrency(summary.period_inflow)}
              </div>
              {!isMobile && <span className="compact-stat-sub">કુલ રોકડ આવક</span>}
            </div>

            {/* Card 3: Period Outflow */}
            <div className="compact-stat-card" style={{ borderLeftColor: '#ef4444' }}>
              <div className="compact-stat-header">
                <span className="compact-stat-title">કુલ ખર્ચ</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>ઉધાર (-)</span>
              </div>
              <div className="compact-stat-value text-debit">
                {formatCurrency(summary.period_outflow)}
              </div>
              {!isMobile && <span className="compact-stat-sub">કુલ રોકડ ખર્ચ</span>}
            </div>

            {/* Card 4: Net Change */}
            <div className="compact-stat-card" style={{ borderLeftColor: '#f59e0b' }}>
              <div className="compact-stat-header">
                <span className="compact-stat-title">ચોખ્ખો પ્રવાહ</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>નેટ</span>
              </div>
              <div className={`compact-stat-value ${summary.net_change >= 0 ? 'text-credit' : 'text-debit'}`}>
                {formatCurrency(summary.net_change, true)}
              </div>
              {!isMobile && <span className="compact-stat-sub">આવક - ખર્ચ તફાવત</span>}
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════ NATIVE SEGMENTED TAB BAR ═════════════════════ */}
      <div style={{ marginBottom: '8px', width: '100%', boxSizing: 'border-box' }}>
        <div className="compact-segmented-tabs" style={{ padding: '3px' }}>
          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'tree' ? 'active-primary' : ''}`}
            onClick={() => {
              setViewMode('tree');
              setSearchParams({ view: 'tree' });
            }}
            style={{ padding: isMobile ? '6px 8px' : '8px 12px', fontSize: isMobile ? '0.74rem' : '0.80rem' }}
          >
            <Building size={13} />
            <span>{isMobile ? 'એકાઉન્ટ્સ' : 'એકાઉન્ટ્સ વૃક્ષ (Chart of Accounts)'}</span>
          </button>

          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'balance_sheet' ? 'active-amber' : ''}`}
            onClick={() => {
              setViewMode('balance_sheet');
              setSearchParams({ view: 'balance_sheet' });
            }}
            style={{ padding: isMobile ? '6px 8px' : '8px 12px', fontSize: isMobile ? '0.74rem' : '0.80rem' }}
          >
            <Scale size={13} />
            <span>{isMobile ? 'બેલેન્સ શીટ' : 'બેલેન્સ શીટ (Balance Sheet)'}</span>
          </button>

          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'income_statement' ? 'active-emerald' : ''}`}
            onClick={() => {
              setViewMode('income_statement');
              setSearchParams({ view: 'income_statement' });
            }}
            style={{ padding: isMobile ? '6px 8px' : '8px 12px', fontSize: isMobile ? '0.74rem' : '0.80rem' }}
          >
            <TrendingUp size={13} />
            <span>{isMobile ? 'નફો-નુકસાન' : 'આવક-ખર્ચ હિસાબ (Income Statement)'}</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          VIEW 1: CHART OF ACCOUNTS HIERARCHICAL TREE VIEW
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' && (
        <div className="glass-card" style={{ padding: isMobile ? '10px 8px' : '16px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '0.86rem' : '1.05rem', fontWeight: 750, margin: 0, color: 'var(--text-main)' }}>
                તમામ એકાઉન્ટ્સ વૃક્ષ (Hierarchy Tree)
              </h2>
              <p style={{ margin: '1px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                કોઈપણ ખાતા પર ક્લિક કરીને વિગતવાર વ્યવહારો જુઓ.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button type="button" className="btn btn-secondary" onClick={expandAllNodes} style={{ fontSize: '0.66rem', padding: '2px 7px', height: '26px' }}>
                બધું ખોલો
              </button>
              <button type="button" className="btn btn-secondary" onClick={collapseAllNodes} style={{ fontSize: '0.66rem', padding: '2px 7px', height: '26px' }}>
                બધું બંધ કરો
              </button>
            </div>
          </div>

          <div className="gnucash-table-wrapper">
            <table className="gnucash-table" style={{ width: '100%', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>એકાઉન્ટ નામ</th>
                  <th style={{ padding: '6px 8px', width: isMobile ? '65px' : '110px' }}>પ્રકાર</th>
                  <th style={{ padding: '6px 8px', width: isMobile ? '95px' : '135px', textAlign: 'right' }}>કુલ રકમ</th>
                </tr>
              </thead>
              <tbody>
                {accountsTree.map((node) => {
                  const renderNode = (n: AccountTreeNode, depth = 0): React.ReactNode => {
                    const isExpanded = expandedNodes[n.full_name] ?? false;
                    const badge = getTypeBadgeStyle(n.type);
                    const indent = isMobile ? depth * 10 + 2 : depth * 18 + 8;

                    return (
                      <React.Fragment key={n.full_name}>
                        <tr>
                          <td style={{ padding: isMobile ? '5px 6px' : '6px 8px', paddingLeft: `${indent}px` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {n.has_children ? (
                                <button
                                  type="button"
                                  onClick={(e) => toggleNode(n.full_name, e)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                              ) : (
                                <span style={{ width: 13, display: 'inline-block' }} />
                              )}

                              {n.has_children ? (
                                isExpanded ? <FolderOpen size={13} color="var(--primary)" /> : <Folder size={13} color="var(--text-muted)" />
                              ) : (
                                <CornerDownRight size={11} color="var(--text-muted)" />
                              )}

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, marginLeft: '2px' }}>
                                <span
                                  className="gnucash-acc-link"
                                  onClick={() => handleOpenAccountModal(n.full_name, n.gujarati_name)}
                                  style={{
                                    fontWeight: depth === 0 ? 800 : n.has_children ? 700 : 500,
                                    fontSize: isMobile ? '0.74rem' : '0.82rem',
                                  }}
                                >
                                  {n.name}
                                </span>
                                {n.gujarati_name && n.gujarati_name !== n.name && (
                                  <span className="gnucash-acc-guj" style={{ fontSize: isMobile ? '0.62rem' : '0.68rem' }}>
                                    ({n.gujarati_name})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: isMobile ? '5px 6px' : '6px 8px' }}>
                            <span
                              style={{
                                fontSize: '0.60rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                whiteSpace: 'nowrap',
                                fontWeight: 600
                              }}
                            >
                              {n.type}
                            </span>
                          </td>

                          <td
                            className="gnucash-amt-cell"
                            style={{
                              padding: isMobile ? '5px 6px' : '6px 8px',
                              fontWeight: depth === 0 ? 800 : n.has_children ? 700 : 500,
                              fontSize: isMobile ? '0.76rem' : '0.83rem',
                              color: n.balance < 0 ? 'var(--error)' : 'inherit',
                            }}
                          >
                            {formatCurrency(n.balance)}
                          </td>
                        </tr>

                        {n.has_children && isExpanded && n.children?.map((child) => renderNode(child, depth + 1))}
                      </React.Fragment>
                    );
                  };

                  return renderNode(node, 0);
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 2: DYNAMIC MULTICOLUMN BALANCE SHEET
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'balance_sheet' && balanceSheet && (
        <div className="gnucash-statement-card" style={{ padding: isMobile ? '10px 8px' : '16px' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '6px',
              borderBottom: '1px solid var(--border-glass)',
              paddingBottom: '8px'
            }}
          >
            <div>
              <h2 style={{ fontSize: isMobile ? '0.88rem' : '1.20rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Balance Sheet (Multicolumn) {balanceSheet.as_of_date_formatted}
              </h2>
              <p style={{ margin: '1px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ સરવૈયું / સ્થિતિ દર્શક પત્રક (તારીખ: {balanceSheet.as_of_date_formatted} સુધી)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="statement-date-bar">
                <Calendar size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>તારીખ:</span>
                <input
                  type="date"
                  value={bsAsOfDate}
                  onChange={(e) => setBsAsOfDate(e.target.value)}
                  className="statement-date-input"
                />
              </div>

              <span className="badge badge-success" style={{ fontSize: '0.64rem', padding: '2px 6px' }}>
                ✓ ટેલી છે
              </span>
            </div>
          </div>

          {/* Multicolumn Layout: Left = Asset | Right = Liability & Equity */}
          <div className="gnucash-statement-grid" style={{ marginTop: '10px', gap: isMobile ? '8px' : '14px' }}>
            {/* ───── LEFT COLUMN: ASSETS ───── */}
            <div className="gnucash-col">
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Asset (અસ્કયામતો)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.78rem' : '0.86rem', padding: isMobile ? '5px 6px' : '7px 10px' }}>
                          {balanceSheet.assets.root_name}
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 800 }}>
                          {formatCurrency(balanceSheet.assets.root_total)}
                        </td>
                      </tr>

                      {balanceSheet.assets.children.map((item) => (
                        <StatementItemRow
                          key={item.full_name}
                          item={item}
                          depth={1}
                          isMobile={isMobile}
                          onSelectAccount={handleOpenAccountModal}
                        />
                      ))}

                      {balanceSheet.assets.standalone.map((item) => (
                        <StatementItemRow
                          key={item.full_name}
                          item={item}
                          depth={0}
                          isMobile={isMobile}
                          onSelectAccount={handleOpenAccountModal}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="gnucash-total-bar">
                  <span>Total For Asset</span>
                  <span>{formatCurrency(balanceSheet.assets.total_asset)}</span>
                </div>
              </div>
            </div>

            {/* ───── RIGHT COLUMN: LIABILITIES & EQUITY ───── */}
            <div className="gnucash-col">
              {/* LIABILITIES SECTION */}
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Liability (દેવાં / ચૂકવવાપાત્ર)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.78rem' : '0.86rem', padding: isMobile ? '5px 6px' : '7px 10px' }}>
                          {balanceSheet.liabilities.root_name}
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 800 }}>
                          {formatCurrency(balanceSheet.liabilities.root_total)}
                        </td>
                      </tr>

                      {balanceSheet.liabilities.children.map((item) => (
                        <StatementItemRow
                          key={item.full_name}
                          item={item}
                          depth={1}
                          isMobile={isMobile}
                          onSelectAccount={handleOpenAccountModal}
                        />
                      ))}

                      {balanceSheet.liabilities.standalone && balanceSheet.liabilities.standalone.map((item) => (
                        <StatementItemRow
                          key={item.full_name}
                          item={item}
                          depth={0}
                          isMobile={isMobile}
                          onSelectAccount={handleOpenAccountModal}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="gnucash-total-bar">
                  <span>Total For Liability</span>
                  <span>{formatCurrency(balanceSheet.liabilities.total_liability)}</span>
                </div>
              </div>

              {/* EQUITY SECTION */}
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Equity (માલિકી હક / મૂડી)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      {balanceSheet.equity.accounts && balanceSheet.equity.accounts.length > 0 ? (
                        balanceSheet.equity.accounts.map((acc) => (
                          <StatementItemRow
                            key={acc.full_name}
                            item={acc}
                            depth={0}
                            isMobile={isMobile}
                            onSelectAccount={handleOpenAccountModal}
                          />
                        ))
                      ) : (
                        <tr>
                          <td style={{ padding: isMobile ? '5px 6px' : '7px 10px', paddingLeft: isMobile ? '8px' : '10px' }}>
                            <div className="gnucash-acc-cell">
                              <span
                                className="gnucash-acc-link"
                                onClick={() => handleOpenAccountModal('Capital Acc', 'મૂડી ખાતું')}
                              >
                                Capital Acc
                              </span>
                              <span className="gnucash-acc-guj">(મૂડી ખાતું)</span>
                            </div>
                          </td>
                          <td className="gnucash-amt-cell">
                            {formatCurrency(balanceSheet.equity.capital_acc)}
                          </td>
                        </tr>
                      )}

                      {/* Retained Earnings */}
                      <tr>
                        <td style={{ padding: isMobile ? '5px 6px' : '7px 10px', paddingLeft: isMobile ? '8px' : '10px' }}>
                          <div className="gnucash-acc-cell">
                            <span style={{ fontWeight: 600, fontSize: isMobile ? '0.74rem' : '0.82rem' }}>
                              Retained Earnings
                            </span>
                            <span className="gnucash-acc-guj" style={{ fontSize: isMobile ? '0.62rem' : '0.68rem' }}>
                              (ચાલુ વર્ષનો નફો/અનામત)
                            </span>
                          </div>
                        </td>
                        <td
                          className="gnucash-amt-cell"
                          style={{
                            fontWeight: 600,
                            fontSize: isMobile ? '0.76rem' : '0.83rem',
                            padding: isMobile ? '5px 6px' : '7px 10px',
                            width: isMobile ? '88px' : '110px'
                          }}
                        >
                          {formatCurrency(balanceSheet.equity.retained_earnings)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="gnucash-total-bar">
                  <span>Total For Equity</span>
                  <span>{formatCurrency(balanceSheet.equity.total_equity)}</span>
                </div>
              </div>

              {/* GRAND TOTAL: LIABILITY & EQUITY */}
              <div
                className="gnucash-total-bar"
                style={{
                  background: '#fef3c7',
                  borderTop: '2px solid #d97706',
                  borderBottom: '3px double #b45309',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: isMobile ? '0.80rem' : '0.90rem',
                  padding: isMobile ? '7px 8px' : '10px 14px',
                }}
              >
                <span>Total For Liability and Equity</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {formatCurrency(balanceSheet.total_liability_and_equity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 3: DYNAMIC MULTICOLUMN INCOME STATEMENT
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'income_statement' && incomeStatement && (
        <div className="gnucash-statement-card" style={{ padding: isMobile ? '10px 8px' : '16px' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '6px',
              borderBottom: '1px solid var(--border-glass)',
              paddingBottom: '8px'
            }}
          >
            <div>
              <h2 style={{ fontSize: isMobile ? '0.88rem' : '1.20rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Income Statement (Multicolumn)
              </h2>
              <p style={{ margin: '1px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ આવક-ખર્ચ પત્રક ({incomeStatement.start_date_formatted} થી {incomeStatement.end_date_formatted})
              </p>
            </div>

            {/* Compact Date Range Bar: Fits cleanly on mobile without clipping */}
            <div className="statement-date-bar">
              <Calendar size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                type="date"
                value={isStartDate}
                onChange={(e) => setIsStartDate(e.target.value)}
                className="statement-date-input"
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>થી</span>
              <input
                type="date"
                value={isEndDate}
                onChange={(e) => setIsEndDate(e.target.value)}
                className="statement-date-input"
              />
            </div>
          </div>

          {/* Multicolumn Layout: Left = Income | Right = Expense */}
          <div className="gnucash-statement-grid" style={{ marginTop: '10px', gap: isMobile ? '8px' : '14px' }}>
            {/* ───── LEFT COLUMN: INCOME ───── */}
            <div className="gnucash-col">
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Income (આવક)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.78rem' : '0.86rem', padding: isMobile ? '5px 6px' : '7px 10px' }}>
                          {incomeStatement.income.root_name}
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 800 }}>
                          {formatCurrency(incomeStatement.income.root_total)}
                        </td>
                      </tr>

                      {incomeStatement.income.children.map((item) => (
                        <StatementItemRow
                          key={item.full_name}
                          item={item}
                          depth={1}
                          isMobile={isMobile}
                          onSelectAccount={handleOpenAccountModal}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="gnucash-total-bar">
                  <span>Total For Income</span>
                  <span>{formatCurrency(incomeStatement.income.total_income)}</span>
                </div>
              </div>

              {/* NET INCOME SUMMARY BOX */}
              <div
                className="gnucash-section-box"
                style={{
                  border: `1px solid ${incomeStatement.net_income >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  background: incomeStatement.net_income >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                }}
              >
                <div className="gnucash-sec-header" style={{ background: 'transparent' }}>
                  <span>Net Income (ચોખ્ખો નફો / બચત)</span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: incomeStatement.net_income >= 0 ? '#10b981' : '#ef4444',
                    }}
                  >
                    {formatCurrency(incomeStatement.net_income)}
                  </span>
                </div>
                <div className="gnucash-total-bar" style={{ background: 'transparent' }}>
                  <span>Total For Net Income</span>
                  <span style={{ color: incomeStatement.net_income >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatCurrency(incomeStatement.net_income)}
                  </span>
                </div>
              </div>
            </div>

            {/* ───── RIGHT COLUMN: EXPENSES ───── */}
            <div className="gnucash-col">
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Expense (ખર્ચ)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.78rem' : '0.86rem', padding: isMobile ? '5px 6px' : '7px 10px' }}>
                          {incomeStatement.expense.root_name}
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 800 }}>
                          {formatCurrency(incomeStatement.expense.root_total)}
                        </td>
                      </tr>

                      {incomeStatement.expense.children.map((item) => (
                        <StatementItemRow
                          key={item.full_name}
                          item={item}
                          depth={1}
                          isMobile={isMobile}
                          onSelectAccount={handleOpenAccountModal}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="gnucash-total-bar">
                  <span>Total For Expense</span>
                  <span>{formatCurrency(incomeStatement.expense.total_expense)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ONE-CLICK ACCOUNT STATEMENT MODAL / DRAWER (Zero Clipping)
          ═══════════════════════════════════════════════════════════ */}
      <Modal
        show={Boolean(selectedAccountModal)}
        onClose={handleCloseAccountModal}
        title={
          isMobile
            ? (accountStatement?.gujarati_name || selectedAccountModal || 'ખાતાવહી')
            : (selectedAccountModal
                ? (accountStatement?.gujarati_name
                    ? `${accountStatement.gujarati_name} (${selectedAccountModal})`
                    : selectedAccountModal)
                : 'ખાતાવહી')
        }
        maxWidth="820px"
      >
        {accountStatementLoading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--primary)' }} />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ખાતાના વ્યવહારો લોડ થઈ રહ્યા છે...</div>
          </div>
        ) : accountStatement ? (
          <div>
            {/* Account Path on Mobile */}
            {isMobile && (
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '8px', wordBreak: 'break-all' }}>
                {accountStatement.account_name}
              </div>
            )}

            {/* Compact Account Metrics Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '4px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-glass)',
                borderRadius: '6px',
                padding: '5px 8px',
                marginBottom: '8px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.60rem', color: 'var(--text-muted)', fontWeight: 600 }}>કુલ આવક (+)</div>
                <div className="text-credit" style={{ fontSize: isMobile ? '0.78rem' : '0.94rem', fontWeight: 800, fontFamily: 'monospace' }}>
                  {formatCurrency(accountStatement.total_inflow)}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.60rem', color: 'var(--text-muted)', fontWeight: 600 }}>કુલ ખર્ચ (-)</div>
                <div className="text-debit" style={{ fontSize: isMobile ? '0.78rem' : '0.94rem', fontWeight: 800, fontFamily: 'monospace' }}>
                  {formatCurrency(accountStatement.total_outflow)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.60rem', color: 'var(--text-muted)', fontWeight: 600 }}>ચોખ્ખી બાકી</div>
                <div
                  className={accountStatement.net_balance >= 0 ? 'text-credit' : 'text-debit'}
                  style={{ fontSize: isMobile ? '0.78rem' : '0.94rem', fontWeight: 800, fontFamily: 'monospace' }}
                >
                  {formatCurrency(accountStatement.net_balance)}
                </div>
              </div>
            </div>

            {/* Transactions Section: Responsive Mobile Feed Cards OR Desktop Table */}
            {isMobile ? (
              /* Mobile High-Density Ledger Rows (100% visible, zero clipping) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '52vh', overflowY: 'auto' }}>
                {accountStatement.transactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                    આ ખાતામાં કોઈ વ્યવહારો મળ્યા નથી.
                  </div>
                ) : (
                  accountStatement.transactions.map((t) => {
                    const isInflow = t.inflow > 0;
                    const isOutflow = t.outflow > 0;
                    return (
                      <div key={t.id} className="mobile-ledger-row">
                        {/* Top Line: Description & Prominent Amount */}
                        <div className="mobile-ledger-top">
                          <span className="mobile-ledger-desc">{t.description || 'વ્યવહાર'}</span>
                          <span
                            className="mobile-ledger-amt"
                            style={{
                              color: isInflow ? '#10b981' : isOutflow ? '#ef4444' : 'var(--text-muted)',
                            }}
                          >
                            {isInflow ? `+${formatCurrency(t.inflow)}` : isOutflow ? `-${formatCurrency(t.outflow)}` : '₹0.00'}
                          </span>
                        </div>

                        {/* Note if available and distinct */}
                        {t.notes && t.notes !== t.description && (
                          <div className="mobile-ledger-notes">{t.notes}</div>
                        )}

                        {/* Bottom Line: Date, Stream & Badge */}
                        <div className="mobile-ledger-bot">
                          <span className="mobile-ledger-meta">
                            {t.date} • {t.business_stream}
                          </span>
                          <span
                            style={{
                              fontSize: '0.58rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: isInflow ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: isInflow ? '#10b981' : '#ef4444',
                            }}
                          >
                            {isInflow ? 'જમા (+)' : 'ઉધાર (-)'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Desktop CA 5-Column Table */
              <div className="gnucash-table-wrapper" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>તારીખ</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>બિઝનેસ</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>વિગત / નોંધ</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>આવક (+)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>જાવક (-)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountStatement.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                          આ ખાતામાં કોઈ વ્યવહારો મળ્યા નથી.
                        </td>
                      </tr>
                    ) : (
                      accountStatement.transactions.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontWeight: 600 }}>{t.date}</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                            <span className="badge" style={{ fontSize: '0.60rem' }}>{t.business_stream}</span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ fontWeight: 600 }}>{t.description}</div>
                            {t.notes && t.notes !== t.description && (
                              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{t.notes}</div>
                            )}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                            {t.inflow > 0 ? formatCurrency(t.inflow, true) : '-'}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                            {t.outflow > 0 ? formatCurrency(-t.outflow) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal Footer */}
            <div className="modal-footer" style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {accountStatement.transactions.length} વ્યવહારો મળ્યા
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseAccountModal}
                style={{ padding: '4px 10px', fontSize: '0.74rem', height: '28px' }}
              >
                બંધ કરો
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          DYNAMIC ACCOUNTS REGISTRY MODAL
          ═══════════════════════════════════════════════════════════ */}
      <Modal
        show={showManageAccountsModal}
        onClose={() => {
          setShowManageAccountsModal(false);
          setEditingAccountId(null);
        }}
        title="ડાયનેમિક ખાતાઓનું સંચાલન (Dynamic Accounts)"
        maxWidth="860px"
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              તમામ ખાતાઓના ગુજરાતી નામ અને બિઝનેસ પ્રવાહ અહીંથી ગોઠવી શકો છો.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSyncAccounts}
              disabled={accountsListLoading}
              style={{ fontSize: '0.70rem', padding: '3px 8px', height: '26px' }}
            >
              <RefreshCw size={12} className={accountsListLoading ? 'animate-spin' : ''} />
              <span>ખાતાઓ સિંક કરો</span>
            </button>
          </div>

          <div className="gnucash-table-wrapper" style={{ maxHeight: isMobile ? '320px' : '420px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '5px 7px', textAlign: 'left' }}>ખાતાનું નામ</th>
                  <th style={{ padding: '5px 7px', textAlign: 'left', width: '65px' }}>પ્રકાર</th>
                  <th style={{ padding: '5px 7px', textAlign: 'left' }}>ગુજરાતી નામ</th>
                  <th style={{ padding: '5px 7px', textAlign: 'left' }}>બિઝનેસ પ્રવાહ</th>
                  <th style={{ padding: '5px 7px', textAlign: 'center', width: '65px' }}>એક્શન</th>
                </tr>
              </thead>
              <tbody>
                {accountsList.map((acc) => {
                  const isEditing = editingAccountId === acc.id;
                  const badge = getTypeBadgeStyle(acc.root_type);

                  return (
                    <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '5px 7px', fontWeight: 600 }}>
                        <div>{acc.name}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{acc.full_name}</div>
                      </td>
                      <td style={{ padding: '5px 7px' }}>
                        <span style={{ fontSize: '0.60rem', padding: '1px 5px', borderRadius: '4px', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                          {acc.root_type}
                        </span>
                      </td>
                      <td style={{ padding: '5px 7px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGujaratiName}
                            onChange={(e) => setEditGujaratiName(e.target.value)}
                            style={{
                              fontSize: '0.72rem',
                              height: '24px',
                              padding: '2px 5px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-glass-active)',
                              borderRadius: '4px',
                              color: 'var(--text-main)',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                            placeholder="ગુજરાતી નામ..."
                          />
                        ) : (
                          <span>{acc.gujarati_name || '-'}</span>
                        )}
                      </td>
                      <td style={{ padding: '5px 7px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editBusinessStream}
                            onChange={(e) => setEditBusinessStream(e.target.value)}
                            style={{
                              fontSize: '0.72rem',
                              height: '24px',
                              padding: '2px 5px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-glass-active)',
                              borderRadius: '4px',
                              color: 'var(--text-main)',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                            placeholder="બિઝનેસ પ્રવાહ..."
                          />
                        ) : (
                          <span>{acc.business_stream || '-'}</span>
                        )}
                      </td>
                      <td style={{ padding: '5px 7px', textAlign: 'center' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleSaveAccount(acc)}
                              disabled={saveAccountLoading}
                              style={{ padding: '3px 6px', fontSize: '0.66rem', height: '24px' }}
                              title="સાચવો"
                            >
                              <Save size={11} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setEditingAccountId(null)}
                              style={{ padding: '3px 6px', fontSize: '0.66rem', height: '24px' }}
                              title="રદ કરો"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditingAccountId(acc.id);
                              setEditGujaratiName(acc.gujarati_name || '');
                              setEditBusinessStream(acc.business_stream || '');
                            }}
                            style={{ padding: '3px 6px', fontSize: '0.66rem', height: '24px' }}
                            title="એડિટ કરો"
                          >
                            <Edit3 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          UPLOAD CSV MODAL
          ═══════════════════════════════════════════════════════════ */}
      <Modal
        show={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setSelectedFile(null);
          setUploadResult(null);
        }}
        title="માસિક GnuCash CSV અપલોડ કરો"
        maxWidth="500px"
      >
        <form onSubmit={handleUploadSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
              GnuCash એક્સપોર્ટ થયેલ CSV ફાઇલ પસંદ કરો:
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setSelectedFile(f);
                setUploadResult(null);
              }}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '0.74rem',
                border: '1px dashed var(--border-glass-active)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                boxSizing: 'border-box'
              }}
            />
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              {selectedFile ? `કદ: ${(selectedFile.size / 1024).toFixed(1)} KB` : '(GnuCash એકાઉન્ટિંગમાંથી એક્સપોર્ટ થયેલ વ્યવહારોની CSV)'}
            </span>
          </div>

          {uploadResult && (
            <div
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                background: uploadResult.duplicate_transactions_skipped > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${uploadResult.duplicate_transactions_skipped > 0 ? '#f59e0b' : '#10b981'}`,
                marginBottom: '12px',
                fontSize: '0.74rem',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>{uploadResult.message}</div>
              <div>કુલ વ્યવહારો: {uploadResult.total_transactions_in_file}</div>
              <div>આયાત થયેલ નવા: {uploadResult.new_transactions_added}</div>
              {uploadResult.duplicate_transactions_skipped > 0 && (
                <div style={{ color: '#d97706' }}>ડુપ્લિકેટ અવગણ્યા: {uploadResult.duplicate_transactions_skipped}</div>
              )}
            </div>
          )}

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowUploadModal(false)}
              disabled={uploadLoading}
              style={{ padding: '5px 12px', fontSize: '0.76rem' }}
            >
              રદ કરો
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || uploadLoading}
              style={{ padding: '5px 14px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Upload size={13} className={uploadLoading ? 'animate-spin' : ''} />
              <span>{uploadLoading ? 'પ્રોસેસ થઈ રહ્યું છે...' : 'અપલોડ કરો'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          RESET ALL DATA CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════ */}
      <Modal
        show={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="ચેતવણી: તમામ ડેટા સાફ કરો"
        maxWidth="440px"
      >
        <p style={{ fontSize: '0.78rem', color: 'var(--text-main)', margin: '0 0 14px' }}>
          શું તમે ખરેખર તમામ સંકલિત વ્યવહારો, સ્પ્લિટ્સ અને હિસાબ સાફ કરવા માંગો છો? આ ક્રિયા પાછી વાળી શકાશે નહીં.
        </p>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowResetModal(false)}
            disabled={resetLoading}
            style={{ padding: '5px 12px', fontSize: '0.76rem' }}
          >
            ના, રહેવા દો
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleResetAll}
            disabled={resetLoading}
            style={{ padding: '5px 14px', fontSize: '0.76rem' }}
          >
            {resetLoading ? 'સાફ થઈ રહ્યું છે...' : 'હા, તમામ ડેટા સાફ કરો'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
