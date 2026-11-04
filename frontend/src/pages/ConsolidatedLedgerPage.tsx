import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Upload, Printer,
  BookOpen, ChevronDown, ChevronRight,
  RefreshCw, Trash2, Building,
  FolderOpen, Folder,
  Calendar, TrendingUp, Scale, Settings, Edit3, Save, X, Search
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
// Clean, interactive, high-contrast rows without 1990s red underlines
// ═══════════════════════════════════════════════════════════════════════════
interface StatementRowProps {
  item: StatementItem;
  depth?: number;
  isMobile?: boolean;
  onSelectAccount: (fullName: string, gujaratiName?: string) => void;
}

const StatementItemRow: React.FC<StatementRowProps> = ({ item, depth = 0, isMobile = false, onSelectAccount }) => {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const indentStep = isMobile ? 8 : 16;
  const paddingLeft = depth === 0 ? (isMobile ? '6px' : '14px') : `${depth * indentStep + (isMobile ? 6 : 14)}px`;

  return (
    <>
      <tr style={{ background: hasChildren ? 'rgba(0, 0, 0, 0.015)' : 'transparent' }}>
        <td style={{ paddingLeft, padding: isMobile ? '5px 7px' : '9px 16px' }}>
          <div className="gnucash-acc-cell">
            <span
              className="gnucash-acc-link"
              onClick={() => onSelectAccount(item.full_name, item.gujarati_name)}
              title="આ ખાતાના વ્યવહારો જુઓ"
              style={{
                fontWeight: hasChildren ? 750 : 500,
                fontSize: isMobile ? '0.76rem' : '0.86rem',
                color: hasChildren ? 'var(--text-main)' : undefined
              }}
            >
              {item.name}
            </span>
            {item.gujarati_name && item.gujarati_name !== item.name && (
              <span className="gnucash-acc-guj" style={{ fontSize: isMobile ? '0.64rem' : '0.72rem' }}>
                ({item.gujarati_name})
              </span>
            )}
          </div>
        </td>
        <td
          className="gnucash-amt-cell"
          style={{
            fontWeight: hasChildren ? 800 : 550,
            fontSize: isMobile ? '0.78rem' : '0.88rem',
            color: item.balance < 0 ? 'var(--error)' : 'inherit',
            padding: isMobile ? '5px 7px' : '9px 16px',
            width: isMobile ? '95px' : '135px',
            minWidth: isMobile ? '85px' : '115px'
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  // Tab View Mode: 'tree' | 'balance_sheet' | 'income_statement'
  const initialView = searchParams.get('view') || 'tree';
  const [viewMode, setViewMode] = useState<'tree' | 'balance_sheet' | 'income_statement'>(
    initialView === 'balance_sheet' || initialView === 'income_statement' ? initialView : 'tree'
  );

  // Core Data States
  const [summary, setSummary] = useState<ConsolidatedSummary | null>(null);
  const [accountsTree, setAccountsTree] = useState<AccountTreeNode[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementData | null>(null);
  const [accountsList, setAccountsList] = useState<ConsolidatedAccountRecord[]>([]);

  // Tree Node Expansion
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Filter States for Balance Sheet & Income Statement
  const [balanceSheetDate, setBalanceSheetDate] = useState<string>('2026-12-31');
  const [incomeStartDate, setIncomeStartDate] = useState<string>('2025-11-01');
  const [incomeEndDate, setIncomeEndDate] = useState<string>('2026-12-31');

  // Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Account Statement Modal / Drawer (One-Click Drill-down)
  const [selectedAccountModal, setSelectedAccountModal] = useState<string | null>(null);
  const [accountStatement, setAccountStatement] = useState<AccountStatementData | null>(null);
  const [accountStatementLoading, setAccountStatementLoading] = useState<boolean>(false);
  const [statementFilterText, setStatementFilterText] = useState<string>('');

  // Manage Accounts Modal
  const [showManageAccountsModal, setShowManageAccountsModal] = useState<boolean>(false);
  const [accountsListLoading, setAccountsListLoading] = useState<boolean>(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editGujaratiName, setEditGujaratiName] = useState<string>('');
  const [editBusinessStream, setEditBusinessStream] = useState<string>('');
  const [saveAccountLoading, setSaveAccountLoading] = useState<boolean>(false);

  // Upload CSV Modal
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<ConsolidatedUploadResponse | null>(null);

  // Reset Confirmation Modal
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);

  // Synchronize URL query params with active tab
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'tree' || view === 'balance_sheet' || view === 'income_statement') {
      setViewMode(view);
    }
  }, [searchParams]);

  // Load all primary datasets
  const loadData = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [sumRes, treeRes, bsRes, incRes] = await Promise.all([
        consolidatedApi.getSummary(),
        consolidatedApi.getAccountsTree(),
        consolidatedApi.getBalanceSheet(balanceSheetDate),
        consolidatedApi.getIncomeStatement(incomeStartDate, incomeEndDate),
      ]);

      setSummary(sumRes);
      setAccountsTree(treeRes);
      setBalanceSheet(bsRes);
      setIncomeStatement(incRes);

      // Auto-expand top level nodes on first load
      if (!isRefresh && Object.keys(expandedNodes).length === 0) {
        const initialExpanded: Record<string, boolean> = {};
        treeRes.forEach((n) => {
          initialExpanded[n.full_name] = true;
        });
        setExpandedNodes(initialExpanded);
      }

      if (isRefresh) {
        showToast('ડેટા સફળતાપૂર્વક રિફ્રેશ થયો.', 'success');
      }
    } catch (err: any) {
      console.error('Failed to load consolidated ledger data:', err);
      showToast(err?.response?.data?.detail || 'ડેટા લોડ કરવામાં નિષ્ફળ.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open Account Statement Modal / Drawer
  const handleOpenAccountModal = async (fullName: string, gujaratiName?: string) => {
    try {
      setSelectedAccountModal(fullName);
      setAccountStatementLoading(true);
      setStatementFilterText('');
      const data = await consolidatedApi.getAccountStatement(fullName);
      if (gujaratiName && !data.gujarati_name) {
        data.gujarati_name = gujaratiName;
      }
      setAccountStatement(data);
    } catch (err: any) {
      console.error('Failed to load account statement:', err);
      showToast('આ ખાતાના વ્યવહારો લોડ કરવામાં નિષ્ફળ.', 'error');
    } finally {
      setAccountStatementLoading(false);
    }
  };

  const handleCloseAccountModal = () => {
    setSelectedAccountModal(null);
    setAccountStatement(null);
    setStatementFilterText('');
  };

  // Toggle tree node expansion
  const toggleNode = (fullName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({
      ...prev,
      [fullName]: !prev[fullName],
    }));
  };

  const expandAllNodes = () => {
    const all: Record<string, boolean> = {};
    const recurse = (nodes: AccountTreeNode[]) => {
      nodes.forEach((n) => {
        all[n.full_name] = true;
        if (n.children && n.children.length > 0) recurse(n.children);
      });
    };
    recurse(accountsTree);
    setExpandedNodes(all);
  };

  const collapseAllNodes = () => {
    setExpandedNodes({});
  };

  // Manage Accounts Modal Handlers
  const handleOpenManageAccounts = async () => {
    setShowManageAccountsModal(true);
    setAccountsListLoading(true);
    try {
      const list = await consolidatedApi.getAccountsList();
      setAccountsList(list);
    } catch (err: any) {
      showToast('ખાતાઓની યાદી લોડ કરવામાં ભૂલ.', 'error');
    } finally {
      setAccountsListLoading(false);
    }
  };

  const handleSaveAccount = async (acc: ConsolidatedAccountRecord) => {
    setSaveAccountLoading(true);
    try {
      await consolidatedApi.updateAccount(acc.id, {
        gujarati_name: editGujaratiName,
        business_stream: editBusinessStream,
      });
      showToast('ખાતું સફળતાપૂર્વક અપડેટ થયું.', 'success');
      setEditingAccountId(null);
      const list = await consolidatedApi.getAccountsList();
      setAccountsList(list);
      loadData(true);
    } catch (err: any) {
      showToast('ખાતું અપડેટ કરવામાં નિષ્ફળ.', 'error');
    } finally {
      setSaveAccountLoading(false);
    }
  };

  const handleSyncAccounts = async () => {
    setAccountsListLoading(true);
    try {
      const res = await consolidatedApi.syncAccounts();
      showToast(`ખાતાઓ સિંક થયા. (${res.added_count} નવા ઉમેરાયા)`, 'success');
      const list = await consolidatedApi.getAccountsList();
      setAccountsList(list);
      loadData(true);
    } catch (err: any) {
      showToast('સિંક કરવામાં ભૂલ.', 'error');
    } finally {
      setAccountsListLoading(false);
    }
  };

  // CSV Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadLoading(true);
    setUploadResult(null);

    try {
      const res = await consolidatedApi.upload(selectedFile);
      setUploadResult(res);
      showToast(res.message, res.duplicate_transactions_skipped > 0 ? 'warning' : 'success');
      loadData(true);
    } catch (err: any) {
      console.error('Upload failed:', err);
      showToast(err?.response?.data?.detail || 'CSV અપલોડ કરવામાં નિષ્ફળ.', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  // Reset All Data
  const handleResetAll = async () => {
    setResetLoading(true);
    try {
      const res = await consolidatedApi.resetAll();
      showToast(res.message || 'તમામ સંકલિત હિસાબ સાફ થઈ ગયો.', 'success');
      setShowResetModal(false);
      loadData(true);
    } catch (err: any) {
      console.error('Reset failed:', err);
      showToast(err?.response?.data?.detail || 'ડેટા સાફ કરવામાં નિષ્ફળ.', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  // Dynamic Root Type Badge Styler
  const getTypeBadgeStyle = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ASSET':
        return { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      case 'LIABILITY':
        return { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'EQUITY':
        return { bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' };
      case 'INCOME':
        return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'EXPENSE':
        return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.12)', color: 'var(--text-muted)', border: 'var(--border-glass)' };
    }
  };

  if (loading && !summary) {
    return <LoadingScreen />;
  }

  // Filtered transactions for Account Statement Modal
  const modalTransactions = accountStatement?.transactions.filter((t) => {
    if (!statementFilterText.trim()) return true;
    const query = statementFilterText.toLowerCase();
    return (
      (t.description && t.description.toLowerCase().includes(query)) ||
      (t.notes && t.notes.toLowerCase().includes(query)) ||
      (t.date && t.date.includes(query)) ||
      (t.business_stream && t.business_stream.toLowerCase().includes(query))
    );
  }) || [];

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* ═════════════════════ TOP NAVIGATION & ACTION STRIP ═════════════════════ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '12px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className={isMobile ? 'btn btn-secondary' : 'desktop-action-btn'}
          style={isMobile ? {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            fontSize: '0.76rem',
            height: '34px',
            minHeight: '34px',
            flexShrink: 0
          } : undefined}
        >
          <ArrowLeft size={isMobile ? 14 : 16} />
          <span>ધંધાઓ</span>
        </button>

        {/* Action Buttons: Unified 38px on Desktop, 34x34px on Mobile */}
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <button
              type="button"
              className="mobile-action-btn"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="રિફ્રેશ કરો"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              className="mobile-action-btn"
              onClick={handleOpenManageAccounts}
              title="ખાતાઓ ગોઠવો"
            >
              <Settings size={17} />
            </button>

            {user?.role === 'admin' && (
              <>
                <button
                  type="button"
                  className="mobile-action-btn mobile-action-btn-primary"
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadResult(null);
                    setShowUploadModal(true);
                  }}
                  title="CSV અપલોડ કરો"
                >
                  <Upload size={17} />
                </button>

                <button
                  type="button"
                  className="mobile-action-btn mobile-action-btn-danger"
                  onClick={() => setShowResetModal(true)}
                  title="ડેટા સાફ કરો"
                >
                  <Trash2 size={17} />
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="desktop-action-btn"
              onClick={() => window.print()}
              title="પ્રિન્ટ કરો"
            >
              <Printer size={16} />
              <span>પ્રિન્ટ</span>
            </button>

            <button
              type="button"
              className="desktop-action-btn"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="રિફ્રેશ કરો"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>રિફ્રેશ</span>
            </button>

            <button
              type="button"
              className="desktop-action-btn"
              onClick={handleOpenManageAccounts}
              title="ખાતાઓ ગોઠવો"
            >
              <Settings size={16} />
              <span>ખાતાઓ</span>
            </button>

            {user?.role === 'admin' && (
              <>
                <button
                  type="button"
                  className="desktop-action-btn desktop-action-btn-primary"
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadResult(null);
                    setShowUploadModal(true);
                  }}
                  title="માસિક CSV અપલોડ કરો"
                >
                  <Upload size={16} />
                  <span>માસિક CSV</span>
                </button>

                <button
                  type="button"
                  className="desktop-action-btn desktop-action-btn-danger"
                  onClick={() => setShowResetModal(true)}
                  title="તમામ ડેટા સાફ કરો"
                >
                  <Trash2 size={16} />
                  <span>સાફ કરો</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═════════════════════ HERO / SUMMARY BANNER ═════════════════════ */}
      <div
        className="glass-card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          padding: isMobile ? '10px 12px' : '20px 24px',
          marginBottom: '14px',
          boxSizing: 'border-box'
        }}
      >
        {/* Title Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', minWidth: 0 }}>
            <div
              style={{
                width: isMobile ? '30px' : '44px',
                height: isMobile ? '30px' : '44px',
                borderRadius: isMobile ? '6px' : '10px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #b45309 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px var(--primary-glow)',
                flexShrink: 0
              }}
            >
              <BookOpen size={isMobile ? 16 : 22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: isMobile ? '0.94rem' : '1.40rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  બધા નો મિક્સ હિસાબ
                </h1>
                <span className="badge badge-primary" style={{ fontSize: isMobile ? '0.58rem' : '0.68rem', padding: '2px 8px', flexShrink: 0 }}>
                  {summary ? summary.total_count : 0} વ્યવહારો
                </span>
              </div>
              {!isMobile && (
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  લૂમ્સ, પ્રિશા ફેબ, હીરા વેપાર, ઉછીના-લોન અને સંયુક્ત પરિવારનો સંકલિત હિસાબ
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 4 Executive KPI Stat Tiles */}
        {summary && (
          <div className="compact-stat-grid">
            {/* Card 1: Rokad Silak */}
            <div className="compact-stat-card card-cash">
              <div className="compact-stat-header">
                <span className="compact-stat-title">રોકડ સિલક</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>CASHBOOK</span>
              </div>
              <div className={`compact-stat-value ${summary.net_cash_balance >= 0 ? 'text-credit' : 'text-debit'}`}>
                {formatCurrency(summary.net_cash_balance)}
              </div>
              <span className="compact-stat-sub">હાથ પર રોકડ / કેશબોક્સ</span>
            </div>

            {/* Card 2: Period Inflow */}
            <div className="compact-stat-card card-inflow">
              <div className="compact-stat-header">
                <span className="compact-stat-title">કુલ રોકડ આવક</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>જમા (+)</span>
              </div>
              <div className="compact-stat-value text-credit">
                {formatCurrency(summary.period_inflow)}
              </div>
              <span className="compact-stat-sub">પસંદ કરેલ ફિલ્ટરમાં કુલ જમા</span>
            </div>

            {/* Card 3: Period Outflow */}
            <div className="compact-stat-card card-outflow">
              <div className="compact-stat-header">
                <span className="compact-stat-title">કુલ રોકડ ખર્ચ</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>ઉધાર (-)</span>
              </div>
              <div className="compact-stat-value text-debit">
                {formatCurrency(summary.period_outflow)}
              </div>
              <span className="compact-stat-sub">પસંદ કરેલ ફિલ્ટરમાં કુલ ઉધાર</span>
            </div>

            {/* Card 4: Net Flow */}
            <div className="compact-stat-card card-net">
              <div className="compact-stat-header">
                <span className="compact-stat-title">ચોખ્ખો પ્રવાહ</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>ચોખ્ખી અસર</span>
              </div>
              <div className={`compact-stat-value ${summary.net_change >= 0 ? 'text-credit' : 'text-debit'}`}>
                {formatCurrency(summary.net_change, true)}
              </div>
              <span className="compact-stat-sub">આવક - ખર્ચ તફાવત</span>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════ NATIVE SEGMENTED TAB BAR ═════════════════════ */}
      <div style={{ marginBottom: '14px', width: '100%', boxSizing: 'border-box' }}>
        <div className="compact-segmented-tabs">
          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'tree' ? 'active-tab' : ''}`}
            onClick={() => {
              setViewMode('tree');
              setSearchParams({ view: 'tree' });
            }}
          >
            <Building size={15} />
            <span>{isMobile ? 'એકાઉન્ટ્સ' : 'એકાઉન્ટ્સ વૃક્ષ (Chart of Accounts)'}</span>
          </button>

          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'balance_sheet' ? 'active-tab' : ''}`}
            onClick={() => {
              setViewMode('balance_sheet');
              setSearchParams({ view: 'balance_sheet' });
            }}
          >
            <Scale size={15} />
            <span>{isMobile ? 'બેલેન્સ શીટ' : 'બેલેન્સ શીટ (Balance Sheet)'}</span>
          </button>

          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'income_statement' ? 'active-tab' : ''}`}
            onClick={() => {
              setViewMode('income_statement');
              setSearchParams({ view: 'income_statement' });
            }}
          >
            <TrendingUp size={15} />
            <span>{isMobile ? 'નફો-નુકસાન' : 'આવક-ખર્ચ હિસાબ (Income Statement)'}</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          VIEW 1: CHART OF ACCOUNTS HIERARCHICAL TREE VIEW
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' && (
        <div className="gnucash-statement-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '0.90rem' : '1.20rem', fontWeight: 750, margin: 0, color: 'var(--text-main)' }}>
                તમામ એકાઉન્ટ્સ વૃક્ષ (Hierarchy Tree)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: isMobile ? '0.66rem' : '0.76rem', color: 'var(--text-muted)' }}>
                કોઈપણ ખાતા પર ક્લિક કરીને વિગતવાર વ્યવહારો જુઓ.
              </p>
            </div>

            {/* Tree Expansion Controls */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="tree-toggle-btn" onClick={expandAllNodes}>
                બધું ખોલો
              </button>
              <button type="button" className="tree-toggle-btn" onClick={collapseAllNodes}>
                બધું બંધ કરો
              </button>
            </div>
          </div>

          <div className="gnucash-table-wrapper">
            <table className="gnucash-table">
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass-active)', textAlign: 'left' }}>
                  <th style={{ padding: isMobile ? '6px 8px' : '10px 16px', fontWeight: 750 }}>એકાઉન્ટ નામ</th>
                  <th style={{ padding: isMobile ? '6px 8px' : '10px 16px', width: isMobile ? '70px' : '130px', fontWeight: 750 }}>પ્રકાર</th>
                  <th style={{ padding: isMobile ? '6px 8px' : '10px 16px', width: isMobile ? '100px' : '160px', textAlign: 'right', fontWeight: 750 }}>કુલ રકમ</th>
                </tr>
              </thead>
              <tbody>
                {accountsTree.map((node) => {
                  const renderNode = (n: AccountTreeNode, depth = 0): React.ReactNode => {
                    const isExpanded = expandedNodes[n.full_name] ?? false;
                    const badge = getTypeBadgeStyle(n.type);
                    const indent = isMobile ? depth * 8 + 2 : depth * 18 + 8;

                    return (
                      <React.Fragment key={n.full_name}>
                        <tr>
                          <td style={{ padding: isMobile ? '5px 7px' : '9px 16px', paddingLeft: `${indent}px` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              ) : (
                                <span style={{ width: 14, display: 'inline-block' }} />
                              )}

                              {n.has_children ? (
                                isExpanded ? <FolderOpen size={15} color="var(--primary)" /> : <Folder size={15} color="var(--text-muted)" />
                              ) : (
                                <span style={{ width: 15, display: 'inline-block' }} />
                              )}

                              <div className="gnucash-acc-cell">
                                <span
                                  className="gnucash-acc-link"
                                  onClick={() => handleOpenAccountModal(n.full_name, n.gujarati_name)}
                                  style={{
                                    fontWeight: n.has_children ? 750 : 500,
                                    fontSize: isMobile ? '0.76rem' : '0.86rem',
                                    color: n.has_children ? 'var(--text-main)' : undefined
                                  }}
                                >
                                  {n.name}
                                </span>
                                {n.gujarati_name && n.gujarati_name !== n.name && (
                                  <span className="gnucash-acc-guj" style={{ fontSize: isMobile ? '0.64rem' : '0.72rem' }}>
                                    ({n.gujarati_name})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: isMobile ? '5px 7px' : '9px 16px' }}>
                            <span
                              style={{
                                fontSize: isMobile ? '0.60rem' : '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                fontWeight: 700,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {n.type}
                            </span>
                          </td>

                          <td
                            className="gnucash-amt-cell"
                            style={{
                              padding: isMobile ? '5px 7px' : '9px 16px',
                              fontWeight: n.has_children ? 800 : 600,
                              fontSize: isMobile ? '0.78rem' : '0.88rem',
                              color: n.balance < 0 ? 'var(--error)' : 'inherit',
                            }}
                          >
                            {formatCurrency(n.balance)}
                          </td>
                        </tr>

                        {isExpanded && n.children && n.children.map((child) => renderNode(child, depth + 1))}
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
          VIEW 2: BALANCE SHEET (MULTICOLUMN)
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'balance_sheet' && balanceSheet && (
        <div className="gnucash-statement-card">
          {/* Header Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '0.92rem' : '1.30rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Balance Sheet (Multicolumn) {balanceSheet.as_of_date_formatted}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: isMobile ? '0.66rem' : '0.76rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ સરવૈયું / સ્થિતિ દર્શક પત્રક (સંપત્તિ = દેવાં + મૂડી)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="statement-date-bar">
                <Calendar size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: isMobile ? '0.70rem' : '0.80rem', fontWeight: 600 }}>તારીખ:</span>
                <input
                  type="date"
                  value={balanceSheetDate}
                  onChange={(e) => {
                    setBalanceSheetDate(e.target.value);
                    if (e.target.value) {
                      consolidatedApi.getBalanceSheet(e.target.value).then(setBalanceSheet).catch(console.error);
                    }
                  }}
                  className="statement-date-input"
                />
              </div>

              <button
                type="button"
                className="tree-toggle-btn"
                onClick={() => {
                  const d = '2026-12-31';
                  setBalanceSheetDate(d);
                  consolidatedApi.getBalanceSheet(d).then(setBalanceSheet).catch(console.error);
                }}
              >
                આજ સુધી (All Time)
              </button>
            </div>
          </div>

          {/* Multicolumn Balance Sheet Grid */}
          <div className="gnucash-statement-grid">
            {/* ───── LEFT COLUMN: ASSETS ───── */}
            <div className="gnucash-col">
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Asset (સંપત્તિ / લેણાં)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      {/* ASSETS ROOT ROW */}
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.80rem' : '0.90rem', padding: isMobile ? '5px 7px' : '9px 16px' }}>
                          {balanceSheet.assets.root_name}
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 800 }}>
                          {formatCurrency(balanceSheet.assets.root_total)}
                        </td>
                      </tr>

                      {/* HIERARCHICAL ASSET ACCOUNTS */}
                      {balanceSheet.assets.children.map((item) => (
                        <StatementItemRow
                          key={item.full_name}
                          item={item}
                          depth={1}
                          isMobile={isMobile}
                          onSelectAccount={handleOpenAccountModal}
                        />
                      ))}

                      {/* STANDALONE ASSET ACCOUNTS */}
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
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.80rem' : '0.90rem', padding: isMobile ? '5px 7px' : '9px 16px' }}>
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
                          <td style={{ padding: isMobile ? '5px 7px' : '9px 16px', paddingLeft: isMobile ? '6px' : '14px' }}>
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

                      <tr>
                        <td style={{ padding: isMobile ? '5px 7px' : '9px 16px', paddingLeft: isMobile ? '6px' : '14px', color: 'var(--text-muted)' }}>
                          Unrealized Gains
                        </td>
                        <td className="gnucash-amt-cell" style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(balanceSheet.equity.unrealized_gains)}
                        </td>
                      </tr>

                      <tr>
                        <td style={{ padding: isMobile ? '5px 7px' : '9px 16px', paddingLeft: isMobile ? '6px' : '14px', fontWeight: 600 }}>
                          Retained Earnings (સંચિત કમાણી)
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 600 }}>
                          {formatCurrency(balanceSheet.equity.retained_earnings)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="gnucash-total-bar">
                  <span>Total For Equity</span>
                  <span>
                    {formatCurrency(
                      (balanceSheet.equity.accounts?.reduce((sum, a) => sum + a.balance, 0) || balanceSheet.equity.capital_acc) +
                      balanceSheet.equity.unrealized_gains +
                      balanceSheet.equity.retained_earnings
                    )}
                  </span>
                </div>
              </div>

              {/* GRAND COMBINED TOTAL */}
              <div className="gnucash-grand-total">
                <span>Total For Liability and Equity</span>
                <span style={{ fontSize: isMobile ? '0.92rem' : '1.08rem', color: 'var(--primary)' }}>
                  {formatCurrency(balanceSheet.total_liability_and_equity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 3: INCOME STATEMENT (MULTICOLUMN PROFIT & LOSS)
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'income_statement' && incomeStatement && (
        <div className="gnucash-statement-card">
          {/* Header Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '0.92rem' : '1.30rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Income Statement (Multicolumn) {incomeStatement.start_date_formatted} to {incomeStatement.end_date_formatted}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: isMobile ? '0.66rem' : '0.76rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ આવક-ખર્ચ પત્રક (નફો-નુકસાન પત્રક)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="statement-date-bar">
                <Calendar size={15} style={{ color: 'var(--primary)' }} />
                <input
                  type="date"
                  value={incomeStartDate}
                  onChange={(e) => setIncomeStartDate(e.target.value)}
                  className="statement-date-input"
                />
                <span style={{ fontSize: isMobile ? '0.66rem' : '0.76rem', color: 'var(--text-muted)' }}>થી</span>
                <input
                  type="date"
                  value={incomeEndDate}
                  onChange={(e) => setIncomeEndDate(e.target.value)}
                  className="statement-date-input"
                />
                <button
                  type="button"
                  className="tree-toggle-btn"
                  onClick={() => {
                    consolidatedApi.getIncomeStatement(incomeStartDate, incomeEndDate).then(setIncomeStatement).catch(console.error);
                  }}
                  style={{ background: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }}
                >
                  લાગુ કરો
                </button>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="tree-toggle-btn"
                  onClick={() => {
                    setIncomeStartDate('2025-11-01');
                    setIncomeEndDate('2026-12-31');
                    consolidatedApi.getIncomeStatement('2025-11-01', '2026-12-31').then(setIncomeStatement).catch(console.error);
                  }}
                >
                  બધો સમય
                </button>
                <button
                  type="button"
                  className="tree-toggle-btn"
                  onClick={() => {
                    setIncomeStartDate('2026-04-01');
                    setIncomeEndDate('2026-12-31');
                    consolidatedApi.getIncomeStatement('2026-04-01', '2026-12-31').then(setIncomeStatement).catch(console.error);
                  }}
                >
                  FY 26-27
                </button>
              </div>
            </div>
          </div>

          {/* Multicolumn Income Statement Grid */}
          <div className="gnucash-statement-grid">
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
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.80rem' : '0.90rem', padding: isMobile ? '5px 7px' : '9px 16px' }}>
                          INCOME
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 800 }}>
                          {formatCurrency(incomeStatement.income.total_income)}
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
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.80rem' : '0.90rem', padding: isMobile ? '5px 7px' : '9px 16px' }}>
                          {incomeStatement.expense.root_name}
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 800 }}>
                          {formatCurrency(incomeStatement.expense.root_total)}
                        </td>
                      </tr>

                      {/* BHEGA GROUP RECURSIVE ROW */}
                      {incomeStatement.expense.bhega && (
                        <StatementItemRow
                          key={incomeStatement.expense.bhega.full_name}
                          item={incomeStatement.expense.bhega}
                          depth={1}
                          isMobile={isMobile}
                          onSelectAccount={handleOpenAccountModal}
                        />
                      )}

                      {/* OTHER EXPENSE CATEGORIES */}
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

          {/* NET INCOME FULL-WIDTH BOTTOM CARD */}
          <div
            style={{
              marginTop: '18px',
              padding: isMobile ? '12px 14px' : '18px 24px',
              background: incomeStatement.net_income >= 0
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.03) 100%)',
              border: `1px solid ${incomeStatement.net_income >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div>
              <div style={{ fontSize: isMobile ? '0.80rem' : '1.02rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {incomeStatement.net_income >= 0 ? 'ચોખ્ખો નફો (Total For Net Income)' : 'ચોખ્ખી ખોટ (Total For Net Loss)'}
              </div>
              <div style={{ fontSize: isMobile ? '0.64rem' : '0.74rem', color: 'var(--text-muted)' }}>
                કુલ આવકમાંથી તમામ ખર્ચ બાદ કરતાં વાસ્તવિક ચોખ્ખી બચત
              </div>
            </div>
            <div
              style={{
                fontSize: isMobile ? '1.10rem' : '1.50rem',
                fontWeight: 850,
                fontFamily: 'var(--font-heading)',
                color: incomeStatement.net_income >= 0 ? '#10b981' : '#ef4444'
              }}
            >
              {formatCurrency(incomeStatement.net_income, true)}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ONE-CLICK ACCOUNT STATEMENT MODAL / DRAWER (Bold Date & Zero Clipping)
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
        maxWidth="960px"
      >
        {accountStatementLoading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--primary)' }} />
            <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>ખાતાના વ્યવહારો લોડ થઈ રહ્યા છે...</div>
          </div>
        ) : accountStatement ? (
          <div>
            {/* Account Path Header */}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '8px', wordBreak: 'break-all' }}>
              {accountStatement.account_name}
            </div>

            {/* Account Metrics Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                padding: isMobile ? '6px 8px' : '10px 14px',
                marginBottom: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: isMobile ? '0.60rem' : '0.70rem', color: 'var(--text-muted)', fontWeight: 600 }}>કુલ આવક (+)</div>
                <div className="text-credit" style={{ fontSize: isMobile ? '0.80rem' : '1.10rem', fontWeight: 800, fontFamily: 'monospace' }}>
                  {formatCurrency(accountStatement.total_inflow)}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '0.60rem' : '0.70rem', color: 'var(--text-muted)', fontWeight: 600 }}>કુલ ખર્ચ (-)</div>
                <div className="text-debit" style={{ fontSize: isMobile ? '0.80rem' : '1.10rem', fontWeight: 800, fontFamily: 'monospace' }}>
                  {formatCurrency(accountStatement.total_outflow)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: isMobile ? '0.60rem' : '0.70rem', color: 'var(--text-muted)', fontWeight: 600 }}>ચોખ્ખી બાકી</div>
                <div
                  className={accountStatement.net_balance >= 0 ? 'text-credit' : 'text-debit'}
                  style={{ fontSize: isMobile ? '0.80rem' : '1.10rem', fontWeight: 800, fontFamily: 'monospace' }}
                >
                  {formatCurrency(accountStatement.net_balance)}
                </div>
              </div>
            </div>

            {/* Search Filter Bar inside Modal */}
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={statementFilterText}
                onChange={(e) => setStatementFilterText(e.target.value)}
                placeholder="વ્યવહાર, નોંધ અથવા તારીખ શોધો..."
                style={{
                  width: '100%',
                  height: isMobile ? '30px' : '34px',
                  paddingLeft: '32px',
                  paddingRight: '10px',
                  fontSize: isMobile ? '0.74rem' : '0.82rem',
                  border: '1px solid var(--border-glass-active)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Transactions Section: Responsive Mobile Feed Cards OR Desktop Table */}
            {isMobile ? (
              /* Mobile High-Density Ledger Rows with BOLD DATE */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '52vh', overflowY: 'auto' }}>
                {modalTransactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                    આ ખાતામાં કોઈ વ્યવહારો મળ્યા નથી.
                  </div>
                ) : (
                  modalTransactions.map((t) => {
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

                        {/* Bottom Line: BOLD DATE, Stream & Badge */}
                        <div className="mobile-ledger-bot">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.74rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                              📅 {t.date}
                            </span>
                            <span className="badge" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
                              {t.business_stream}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.58rem',
                              fontWeight: 800,
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
              /* Desktop CA 5-Column Table with BOLD DATE */
              <div className="gnucash-table-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.80rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: '110px' }}>તારીખ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: '130px' }}>બિઝનેસ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>વિગત / નોંધ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '130px' }}>આવક (+)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '130px' }}>જાવક (-)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          આ ખાતામાં કોઈ વ્યવહારો મળ્યા નથી.
                        </td>
                      </tr>
                    ) : (
                      modalTransactions.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-main)' }}>
                            {t.date}
                          </td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                            <span className="badge" style={{ fontSize: '0.64rem' }}>{t.business_stream}</span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 600 }}>{t.description}</div>
                            {t.notes && t.notes !== t.description && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>{t.notes}</div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                            {t.inflow > 0 ? formatCurrency(t.inflow, true) : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
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
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {modalTransactions.length} વ્યવહારો મળ્યા
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseAccountModal}
                style={{ padding: '4px 14px', fontSize: '0.78rem', height: '30px' }}
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
        maxWidth="880px"
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              તમામ ખાતાઓના ગુજરાતી નામ અને બિઝનેસ પ્રવાહ અહીંથી ગોઠવી શકો છો.
            </p>
            <button
              type="button"
              className="tree-toggle-btn"
              onClick={handleSyncAccounts}
              disabled={accountsListLoading}
            >
              <RefreshCw size={12} className={accountsListLoading ? 'animate-spin' : ''} />
              <span style={{ marginLeft: 4 }}>ખાતાઓ સિંક કરો</span>
            </button>
          </div>

          <div className="gnucash-table-wrapper" style={{ maxHeight: isMobile ? '320px' : '440px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.74rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>ખાતાનું નામ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', width: '70px' }}>પ્રકાર</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>ગુજરાતી નામ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>બિઝનેસ પ્રવાહ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: '70px' }}>એક્શન</th>
                </tr>
              </thead>
              <tbody>
                {accountsList.map((acc) => {
                  const isEditing = editingAccountId === acc.id;
                  const badge = getTypeBadgeStyle(acc.root_type);

                  return (
                    <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                        <div>{acc.name}</div>
                        <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{acc.full_name}</div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                          {acc.root_type}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGujaratiName}
                            onChange={(e) => setEditGujaratiName(e.target.value)}
                            style={{
                              fontSize: '0.74rem',
                              height: '26px',
                              padding: '2px 6px',
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
                      <td style={{ padding: '6px 8px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editBusinessStream}
                            onChange={(e) => setEditBusinessStream(e.target.value)}
                            style={{
                              fontSize: '0.74rem',
                              height: '26px',
                              padding: '2px 6px',
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
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleSaveAccount(acc)}
                              disabled={saveAccountLoading}
                              style={{ padding: '3px 7px', fontSize: '0.68rem', height: '26px' }}
                              title="સાચવો"
                            >
                              <Save size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setEditingAccountId(null)}
                              style={{ padding: '3px 7px', fontSize: '0.68rem', height: '26px' }}
                              title="રદ કરો"
                            >
                              <X size={12} />
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
                            style={{ padding: '3px 7px', fontSize: '0.68rem', height: '26px' }}
                            title="એડિટ કરો"
                          >
                            <Edit3 size={12} />
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
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.80rem', fontWeight: 600 }}>
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
                padding: '10px',
                fontSize: '0.78rem',
                border: '1px dashed var(--border-glass-active)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                boxSizing: 'border-box'
              }}
            />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              {selectedFile ? `કદ: ${(selectedFile.size / 1024).toFixed(1)} KB` : '(GnuCash એકાઉન્ટિંગમાંથી એક્સપોર્ટ થયેલ વ્યવહારોની CSV)'}
            </span>
          </div>

          {uploadResult && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: uploadResult.duplicate_transactions_skipped > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${uploadResult.duplicate_transactions_skipped > 0 ? '#f59e0b' : '#10b981'}`,
                marginBottom: '12px',
                fontSize: '0.76rem',
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
              style={{ padding: '5px 14px', fontSize: '0.78rem' }}
            >
              રદ કરો
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || uploadLoading}
              style={{ padding: '5px 16px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Upload size={15} className={uploadLoading ? 'animate-spin' : ''} />
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
        <p style={{ fontSize: '0.80rem', color: 'var(--text-main)', margin: '0 0 14px' }}>
          શું તમે ખરેખર તમામ સંકલિત વ્યવહારો, સ્પ્લિટ્સ અને હિસાબ સાફ કરવા માંગો છો? આ ક્રિયા પાછી વાળી શકાશે નહીં.
        </p>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowResetModal(false)}
            disabled={resetLoading}
            style={{ padding: '5px 14px', fontSize: '0.78rem' }}
          >
            ના, રહેવા દો
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleResetAll}
            disabled={resetLoading}
            style={{ padding: '5px 16px', fontSize: '0.78rem' }}
          >
            {resetLoading ? 'સાફ થઈ રહ્યું છે...' : 'હા, તમામ ડેટા સાફ કરો'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
