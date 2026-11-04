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
  const indentStep = isMobile ? 10 : 16;
  const paddingLeft = depth === 0 ? '10px' : `${depth * indentStep + 10}px`;

  return (
    <>
      <tr style={{ background: hasChildren ? 'rgba(0, 0, 0, 0.02)' : 'transparent' }}>
        <td style={{ paddingLeft }}>
          <div className="gnucash-acc-cell">
            <span
              className="gnucash-acc-link"
              onClick={() => onSelectAccount(item.full_name, item.gujarati_name)}
              title="આ ખાતાના વ્યવહારો જુઓ"
              style={{ fontWeight: hasChildren ? 750 : 500 }}
            >
              {item.name}
            </span>
            {item.gujarati_name && item.gujarati_name !== item.name && (
              <span className="gnucash-acc-guj">
                ({item.gujarati_name})
              </span>
            )}
          </div>
        </td>
        <td
          className="gnucash-amt-cell"
          style={{
            fontWeight: hasChildren ? 750 : 500,
            color: item.balance < 0 ? 'var(--error)' : 'inherit',
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

  // Toggle tree node expansion
  const toggleNode = (nodeFullName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeFullName]: !prev[nodeFullName]
    }));
  };

  const expandAllNodes = () => {
    const allExpanded: Record<string, boolean> = {};
    const traverse = (nodes: AccountTreeNode[]) => {
      nodes.forEach(n => {
        allExpanded[n.full_name] = true;
        if (n.children && n.children.length > 0) {
          traverse(n.children);
        }
      });
    };
    traverse(accountsTree);
    setExpandedNodes(allExpanded);
  };

  const collapseAllNodes = () => {
    setExpandedNodes({});
  };

  // Load all data
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [sumData, treeData, bsData, isData] = await Promise.all([
        consolidatedApi.getSummary().catch(() => null),
        consolidatedApi.getAccountsTree().catch(() => []),
        consolidatedApi.getBalanceSheet(bsAsOfDate).catch(() => null),
        consolidatedApi.getIncomeStatement(isStartDate, isEndDate).catch(() => null)
      ]);

      setSummary(sumData);
      setAccountsTree(treeData);
      setBalanceSheet(bsData);
      setIncomeStatement(isData);

      if (treeData && treeData.length > 0 && Object.keys(expandedNodes).length === 0) {
        const initialExpanded: Record<string, boolean> = {};
        treeData.forEach(n => {
          initialExpanded[n.full_name] = true;
          if (n.children) {
            n.children.forEach(c => {
              if (c.children && c.children.length > 0) {
                initialExpanded[c.full_name] = true;
              }
            });
          }
        });
        setExpandedNodes(initialExpanded);
      }
    } catch (err) {
      console.error('Failed to load consolidated ledger data', err);
      showToast('ડેટા લોડ કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [bsAsOfDate, isStartDate, isEndDate]);

  // Sync with URL parameters
  useEffect(() => {
    const urlView = searchParams.get('view');
    if (urlView && (urlView === 'tree' || urlView === 'balance_sheet' || urlView === 'income_statement')) {
      setViewMode(urlView);
    }

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
      showToast('આ ખાતાના વ્યવહારો લોડ કરવામાં ક્ષતિ આવી.', 'error');
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
      showToast('ખાતાઓની યાદી લોડ કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setAccountsListLoading(false);
    }
  };

  const handleStartEditAccount = (acc: ConsolidatedAccountRecord) => {
    setEditingAccountId(acc.id);
    setEditGujaratiName(acc.gujarati_name || '');
    setEditBusinessStream(acc.business_stream || '');
  };

  const handleSaveAccount = async (accountId: number) => {
    setSaveAccountLoading(true);
    try {
      const updated = await consolidatedApi.updateAccount(accountId, {
        gujarati_name: editGujaratiName,
        business_stream: editBusinessStream
      });
      setAccountsList(prev => prev.map(a => a.id === accountId ? updated : a));
      setEditingAccountId(null);
      showToast('ખાતાની વિગતો સાચવવામાં આવી.', 'success');
      loadData(true);
    } catch (err) {
      console.error('Failed to save account', err);
      showToast('ખાતું સાચવવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setSaveAccountLoading(false);
    }
  };

  const handleSyncAccounts = async () => {
    try {
      setAccountsListLoading(true);
      const res = await consolidatedApi.syncAccounts();
      showToast(res.message || 'ખાતાઓ સફળતાપૂર્વક સિન્ક થયા.', 'success');
      const list = await consolidatedApi.getAccountsList();
      setAccountsList(list);
      loadData(true);
    } catch (err) {
      console.error('Failed to sync accounts', err);
      showToast('ખાતાઓ સિન્ક કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setAccountsListLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('કૃપા કરીને ફાઇલ પસંદ કરો.', 'error');
      return;
    }

    setUploadLoading(true);
    try {
      const res = await consolidatedApi.upload(selectedFile);
      setUploadResult(res);
      showToast(res.message, res.duplicate_transactions_skipped > 0 ? 'info' : 'success');
      await loadData();
    } catch (err) {
      console.error('Failed to upload file', err);
      showToast('ફાઇલ અપલોડ કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleResetAll = async () => {
    setResetLoading(true);
    try {
      const res = await consolidatedApi.resetAll();
      showToast(res.message, 'success');
      setShowResetModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to reset consolidated ledger', err);
      showToast('હિસાબ સાફ કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="consolidated-page animate-fade-in" style={{ paddingBottom: '60px' }}>
      {/* ═════════════════════ TOP HEADER BAR (Mobile-Optimized Single Row) ═════════════════════ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '8px',
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
            gap: '5px',
            padding: '6px 12px',
            fontSize: '0.8rem',
            height: '34px',
            flexShrink: 0
          }}
        >
          <ArrowLeft size={15} />
          <span>ધંધાઓ</span>
        </button>

        {/* Compact Action Icon Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="રિફ્રેશ"
            style={{ width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            title="પ્રિન્ટ"
            style={{ width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Printer size={14} />
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenManageAccounts}
            title="ખાતાઓ મેનેજ કરો"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '34px',
              padding: isMobile ? '0 8px' : '0 12px',
              fontSize: '0.78rem'
            }}
          >
            <Settings size={14} />
            <span>{!isMobile ? 'ખાતાઓ મેનેજ કરો' : 'ખાતાઓ'}</span>
          </button>

          {user?.role === 'admin' && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSelectedFile(null);
                  setUploadResult(null);
                  setShowUploadModal(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '34px',
                  padding: isMobile ? '0 10px' : '0 14px',
                  fontSize: '0.78rem'
                }}
              >
                <Upload size={14} />
                <span>{!isMobile ? 'માસિક CSV અપલોડ' : 'અપલોડ'}</span>
              </button>

              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => setShowResetModal(true)}
                title="તમામ ડેટા સાફ કરો"
                style={{ width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═════════════════════ HERO / SUMMARY BANNER (Clean, Balanced Box) ═════════════════════ */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.07) 0%, rgba(245, 158, 11, 0.02) 100%)',
          borderColor: 'rgba(217, 119, 6, 0.22)',
          padding: isMobile ? '12px' : '16px 20px',
          marginBottom: '12px',
          boxSizing: 'border-box'
        }}
      >
        {/* Compact Title Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0 }}>
            <div
              style={{
                width: isMobile ? '34px' : '40px',
                height: isMobile ? '34px' : '40px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
                flexShrink: 0
              }}
            >
              <BookOpen size={isMobile ? 18 : 20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: isMobile ? '1.05rem' : '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  બધા નો મિક્સ હિસાબ
                </h1>
                <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                  માસ્ટર કેશબુક
                </span>
              </div>
              {!isMobile && (
                <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  લૂમ્સ, પ્રિશા ફેબ, હીરા વેપાર, ઉછીના-લોન અને સંયુક્ત પરિવારનો સંકલિત હિસાબ
                </p>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span className="badge" style={{ fontSize: '0.68rem', padding: '3px 8px', background: 'var(--bg-surface-elevated)' }}>
              {summary ? summary.total_count : 0} વ્યવહારો
            </span>
          </div>
        </div>

        {/* 4 Compact Stat Tiles with Equal Heights & Zero Clipping */}
        {summary && (
          <div className="compact-stat-grid">
            {/* Card 1: Rokad Silak */}
            <div className="compact-stat-card" style={{ borderLeftColor: '#10b981' }}>
              <div className="compact-stat-header">
                <span className="compact-stat-title">રોકડ સિલક</span>
                <span className="compact-stat-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>CASH</span>
              </div>
              <div className={`compact-stat-value ${summary.net_cash_balance >= 0 ? 'text-credit' : 'text-debit'}`}>
                {formatCurrency(summary.net_cash_balance)}
              </div>
              <span className="compact-stat-sub">હાથ પર રોકડ</span>
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
              <span className="compact-stat-sub">કુલ રોકડ આવક</span>
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
              <span className="compact-stat-sub">કુલ રોકડ ખર્ચ</span>
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
              <span className="compact-stat-sub">આવક - ખર્ચ તફાવત</span>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════ NATIVE SEGMENTED TAB BAR ═════════════════════ */}
      <div style={{ marginBottom: '12px', width: '100%', boxSizing: 'border-box' }}>
        <div className="compact-segmented-tabs">
          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'tree' ? 'active-primary' : ''}`}
            onClick={() => {
              setViewMode('tree');
              setSearchParams({ view: 'tree' });
            }}
          >
            <Building size={14} />
            <span>{isMobile ? 'એકાઉન્ટ્સ' : 'એકાઉન્ટ્સ વૃક્ષ (Chart of Accounts)'}</span>
          </button>

          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'balance_sheet' ? 'active-amber' : ''}`}
            onClick={() => {
              setViewMode('balance_sheet');
              setSearchParams({ view: 'balance_sheet' });
            }}
          >
            <Scale size={14} />
            <span>{isMobile ? 'બેલેન્સ શીટ' : 'બેલેન્સ શીટ (Balance Sheet)'}</span>
          </button>

          <button
            type="button"
            className={`compact-tab-btn ${viewMode === 'income_statement' ? 'active-emerald' : ''}`}
            onClick={() => {
              setViewMode('income_statement');
              setSearchParams({ view: 'income_statement' });
            }}
          >
            <TrendingUp size={14} />
            <span>{isMobile ? 'નફો-નુકસાન' : 'નફો-નુકસાન પત્રક (Income Statement)'}</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          VIEW 1: CHART OF ACCOUNTS HIERARCHICAL TREE VIEW
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' && (
        <div className="glass-card" style={{ padding: isMobile ? '12px' : '16px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '0.92rem' : '1.05rem', fontWeight: 750, margin: 0, color: 'var(--text-main)' }}>
                સંપૂર્ણ એકાઉન્ટ્સ ચાર્ટ (Hierarchy Tree)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                કોઈપણ ખાતા પર ક્લિક કરીને તેના વ્યવહારો જુઓ.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '5px' }}>
              <button type="button" className="btn btn-secondary" onClick={expandAllNodes} style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
                બધા ખોલો
              </button>
              <button type="button" className="btn btn-secondary" onClick={collapseAllNodes} style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
                બધા બંધ કરો
              </button>
            </div>
          </div>

          <div className="gnucash-table-wrapper">
            <table className="gnucash-table" style={{ width: '100%', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', textAlign: 'left' }}>
                  <th style={{ padding: '7px 8px' }}>ખાતાનું નામ</th>
                  <th style={{ padding: '7px 8px', width: isMobile ? '70px' : '110px' }}>પ્રકાર</th>
                  <th style={{ padding: '7px 8px', width: isMobile ? '105px' : '135px', textAlign: 'right' }}>કુલ રકમ</th>
                </tr>
              </thead>
              <tbody>
                {accountsTree.map((node) => {
                  const renderNode = (n: AccountTreeNode, depth = 0): React.ReactNode => {
                    const isExpanded = expandedNodes[n.full_name] ?? false;
                    const badge = getTypeBadgeStyle(n.type);
                    const indent = isMobile ? depth * 12 + 4 : depth * 18 + 8;

                    return (
                      <React.Fragment key={n.full_name}>
                        <tr>
                          <td style={{ padding: '6px 8px', paddingLeft: `${indent}px` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {n.has_children ? (
                                <button
                                  type="button"
                                  onClick={(e) => toggleNode(n.full_name, e)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '2px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--text-muted)'
                                  }}
                                  title={isExpanded ? 'ફોલ્ડર બંધ કરો' : 'ફોલ્ડર ખોલો'}
                                >
                                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                              ) : (
                                <span style={{ width: '12px', display: 'inline-block' }} />
                              )}

                              {n.has_children ? (
                                isExpanded ? <FolderOpen size={14} color="#d97706" /> : <Folder size={14} color="#d97706" />
                              ) : (
                                <CornerDownRight size={11} color="var(--text-muted)" />
                              )}

                              <div className="gnucash-acc-cell" style={{ marginLeft: '2px' }}>
                                <span
                                  className="gnucash-acc-link"
                                  onClick={() => handleOpenAccountModal(n.full_name, n.gujarati_name)}
                                  title="આ ખાતાના વ્યવહારો જુઓ"
                                  style={{ fontWeight: depth === 0 ? 800 : n.has_children ? 700 : 500 }}
                                >
                                  {n.name}
                                </span>
                                {n.gujarati_name && n.gujarati_name !== n.name && (
                                  <span className="gnucash-acc-guj">
                                    ({n.gujarati_name})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '6px 8px' }}>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                fontWeight: 650,
                                display: 'inline-block',
                              }}
                            >
                              {n.type}
                            </span>
                          </td>

                          <td
                            className="gnucash-amt-cell"
                            style={{
                              padding: '6px 8px',
                              fontWeight: depth === 0 || n.has_children ? 800 : 600,
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
          VIEW 2: DYNAMIC BALANCE SHEET (All Section Boxes with Perfect Borders)
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'balance_sheet' && balanceSheet && (
        <div className="gnucash-statement-card">
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '1.02rem' : '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Balance Sheet (Multicolumn) {balanceSheet.as_of_date_formatted}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ સરવૈયું / સ્થિતિ દર્શક પત્રક (તારીખ: {balanceSheet.as_of_date_formatted} સુધી)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} color="var(--text-muted)" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>તારીખ:</span>
                <input
                  type="date"
                  value={bsAsOfDate}
                  onChange={(e) => setBsAsOfDate(e.target.value)}
                  className="input-field"
                  style={{ height: '28px', fontSize: '0.72rem', padding: '2px 6px' }}
                />
              </div>

              <span className="badge badge-success" style={{ fontSize: '0.66rem', padding: '2px 7px' }}>
                ✓ સરભર છે
              </span>
            </div>
          </div>

          {/* Multicolumn Layout: Left = Asset | Right = Liability & Equity */}
          <div className="gnucash-statement-grid">
            {/* ══════ LEFT COLUMN: ASSET ══════ */}
            <div className="gnucash-col">
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Asset (સંપત્તિ)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.80rem' : '0.86rem' }}>
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

            {/* ══════ RIGHT COLUMN: LIABILITY & EQUITY ══════ */}
            <div className="gnucash-col">
              {/* 1. Liability Section */}
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Liability (દેવું અને લોન)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.80rem' : '0.86rem' }}>
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
                    </tbody>
                  </table>
                </div>

                <div className="gnucash-total-bar">
                  <span>Total For Liability</span>
                  <span>{formatCurrency(balanceSheet.liabilities.total_liability)}</span>
                </div>
              </div>

              {/* 2. Equity Section */}
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Equity (મૂડી)</span>
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
                          <td style={{ paddingLeft: '10px' }}>
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
                        <td style={{ paddingLeft: '10px' }}>Unrealized Gains</td>
                        <td className="gnucash-amt-cell">
                          {formatCurrency(balanceSheet.equity.unrealized_gains)}
                        </td>
                      </tr>

                      <tr>
                        <td style={{ paddingLeft: '10px' }}>Retained Earnings (સંચિત નફો)</td>
                        <td className="gnucash-amt-cell">
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

              {/* Total For Liability and Equity */}
              <div
                className="gnucash-total-bar"
                style={{
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.14) 0%, rgba(245, 158, 11, 0.2) 100%)',
                  border: '1px solid rgba(217, 119, 6, 0.35)',
                  borderBottom: '3px double #d97706',
                  color: '#b45309',
                  fontSize: isMobile ? '0.84rem' : '0.94rem'
                }}
              >
                <span>Total For Liability and Equity</span>
                <span>{formatCurrency(balanceSheet.total_liability_and_equity)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 3: DYNAMIC INCOME STATEMENT (All Section Boxes with Perfect Borders)
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'income_statement' && incomeStatement && (
        <div className="gnucash-statement-card">
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '1.02rem' : '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Income Statement (Multicolumn) {incomeStatement.start_date_formatted} to {incomeStatement.end_date_formatted}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ આવક-ખર્ચ પત્રક (નફો-નુકસાન પત્રક)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} color="var(--text-muted)" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>તારીખ:</span>
                <input
                  type="date"
                  value={isStartDate}
                  onChange={(e) => setIsStartDate(e.target.value)}
                  className="input-field"
                  style={{ height: '28px', fontSize: '0.72rem', padding: '2px 6px' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>થી</span>
                <input
                  type="date"
                  value={isEndDate}
                  onChange={(e) => setIsEndDate(e.target.value)}
                  className="input-field"
                  style={{ height: '28px', fontSize: '0.72rem', padding: '2px 6px' }}
                />
              </div>
            </div>
          </div>

          {/* Multicolumn Layout: Left = Income | Right = Expense */}
          <div className="gnucash-statement-grid">
            {/* ══════ LEFT COLUMN: INCOME ══════ */}
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
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.80rem' : '0.86rem' }}>
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

              {/* Net Income Box */}
              <div
                className="gnucash-section-box"
                style={{
                  border: `1px solid ${incomeStatement.net_income >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                }}
              >
                <div
                  className="gnucash-sec-header"
                  style={{
                    background: incomeStatement.net_income >= 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: '#ffffff',
                    borderBottom: 'none'
                  }}
                >
                  <span>Net Income (ચોખ્ખો નફો)</span>
                  <span>ચોખ્ખી રકમ (₹)</span>
                </div>

                <div
                  className="gnucash-total-bar"
                  style={{
                    background: incomeStatement.net_income >= 0 ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)',
                    color: incomeStatement.net_income >= 0 ? '#047857' : '#b91c1c',
                    fontSize: isMobile ? '0.84rem' : '0.94rem',
                    borderTop: 'none',
                    borderBottom: 'none',
                    padding: '10px 14px'
                  }}
                >
                  <span>Total For Net Income (ચોખ્ખો નફો)</span>
                  <span>{formatCurrency(incomeStatement.net_income)}</span>
                </div>
              </div>
            </div>

            {/* ══════ RIGHT COLUMN: EXPENSE ══════ */}
            <div className="gnucash-col">
              <div className="gnucash-section-box">
                <div className="gnucash-sec-header">
                  <span>Expense (ખર્ચાઓ)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.80rem' : '0.86rem' }}>
                          {incomeStatement.expense.root_name}
                        </td>
                        <td className="gnucash-amt-cell" style={{ fontWeight: 800 }}>
                          {formatCurrency(incomeStatement.expense.root_total)}
                        </td>
                      </tr>

                      {/* 100% Dynamic Recursive rendering of all expense categories and sub-accounts */}
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
          ONE-CLICK ACCOUNT STATEMENT MODAL / DRAWER
          ═══════════════════════════════════════════════════════════ */}
      <Modal
        show={Boolean(selectedAccountModal)}
        onClose={handleCloseAccountModal}
        title={
          selectedAccountModal
            ? accountStatement?.gujarati_name
              ? `${accountStatement.gujarati_name} (${selectedAccountModal})`
              : selectedAccountModal
            : 'ખાતાવહી'
        }
        maxWidth="820px"
      >
        {accountStatementLoading ? (
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--primary)' }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>ખાતાના વ્યવહારો લોડ થઈ રહ્યા છે...</div>
          </div>
        ) : accountStatement ? (
          <div>
            {/* Account Metrics Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              <div className="compact-stat-card" style={{ borderLeftColor: '#3b82f6', minHeight: '66px', padding: '6px 8px' }}>
                <span className="compact-stat-title">કુલ આવક</span>
                <div className="compact-stat-value text-credit" style={{ fontSize: isMobile ? '0.88rem' : '1.02rem' }}>
                  {formatCurrency(accountStatement.total_inflow)}
                </div>
                <span className="compact-stat-sub">કુલ જમા</span>
              </div>

              <div className="compact-stat-card" style={{ borderLeftColor: '#ef4444', minHeight: '66px', padding: '6px 8px' }}>
                <span className="compact-stat-title">કુલ ખર્ચ</span>
                <div className="compact-stat-value text-debit" style={{ fontSize: isMobile ? '0.88rem' : '1.02rem' }}>
                  {formatCurrency(accountStatement.total_outflow)}
                </div>
                <span className="compact-stat-sub">કુલ ઉધાર</span>
              </div>

              <div className="compact-stat-card" style={{ borderLeftColor: '#10b981', minHeight: '66px', padding: '6px 8px' }}>
                <span className="compact-stat-title">નેટ બેલેન્સ</span>
                <div className={`compact-stat-value ${accountStatement.net_balance >= 0 ? 'text-credit' : 'text-debit'}`} style={{ fontSize: isMobile ? '0.88rem' : '1.02rem' }}>
                  {formatCurrency(accountStatement.net_balance)}
                </div>
                <span className="compact-stat-sub">ચોખ્ખી રકમ</span>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="gnucash-table-wrapper" style={{ maxHeight: isMobile ? '320px' : '400px', overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: isMobile ? '0.74rem' : '0.8rem' }}>
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
                        આ ખાતામાં કોઈ વ્યવહાર મળ્યા નથી.
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

            <div className="modal-footer" style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                ખાતું: <code>{accountStatement.account_name}</code>
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseAccountModal}
                style={{ padding: '5px 12px', fontSize: '0.78rem' }}
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
        title="⚙️ ખાતાઓનું મેનેજમેન્ટ (Dynamic Accounts)"
        maxWidth="860px"
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              કોઈપણ ખાતાનું ગુજરાતી નામ અથવા બિઝનેસ સ્ટ્રીમ અહીંથી સીધું બદલી શકો છો.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSyncAccounts}
              disabled={accountsListLoading}
              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
            >
              <RefreshCw size={13} className={accountsListLoading ? 'animate-spin' : ''} />
              <span>ખાતાઓ સિન્ક કરો</span>
            </button>
          </div>

          <div className="gnucash-table-wrapper" style={{ maxHeight: isMobile ? '340px' : '440px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.74rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>ખાતાનું નામ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', width: '70px' }}>પ્રકાર</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>ગુજરાતી નામ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>બિઝનેસ પ્રવાહ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: '70px' }}>ક્રિયા</th>
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
                            className="input-field"
                            style={{ fontSize: '0.74rem', height: '26px', padding: '2px 6px' }}
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
                            className="input-field"
                            style={{ fontSize: '0.74rem', height: '26px', padding: '2px 6px' }}
                            placeholder="બિઝનેસ પ્રવાહ..."
                          />
                        ) : (
                          <span className="badge" style={{ fontSize: '0.62rem' }}>{acc.business_stream || '-'}</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleSaveAccount(acc.id)}
                              disabled={saveAccountLoading}
                              style={{ padding: '3px 7px', fontSize: '0.66rem' }}
                              title="સાચવો"
                            >
                              <Save size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setEditingAccountId(null)}
                              style={{ padding: '3px 6px', fontSize: '0.66rem' }}
                              title="રદ કરો"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleStartEditAccount(acc)}
                            style={{ padding: '3px 7px', fontSize: '0.66rem' }}
                            title="સુધારો કરો"
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

          <div className="modal-footer" style={{ marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowManageAccountsModal(false);
                setEditingAccountId(null);
              }}
              style={{ padding: '5px 12px', fontSize: '0.78rem' }}
            >
              બંધ કરો
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════ CENTER-ALIGNED RESPONSIVE UPLOAD MODAL ═══════ */}
      <Modal
        show={showUploadModal}
        onClose={() => {
          if (!uploadLoading) {
            setShowUploadModal(false);
            setSelectedFile(null);
            setUploadResult(null);
          }
        }}
        title="માસિક CSV / GnuCash ફાઇલ અપલોડ કરો"
        maxWidth="520px"
      >
        <form onSubmit={handleUploadSubmit}>
          <div
            style={{
              padding: isMobile ? '16px 10px' : '22px 16px',
              border: '2px dashed #d97706',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              background: 'rgba(217, 119, 6, 0.04)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(217, 119, 6, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                }}
              >
                <Upload size={18} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-main)' }}>
                {selectedFile ? selectedFile.name : 'દર મહિનાની CSV ફાઇલ અહીં પસંદ કરો'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {selectedFile ? `કદ: ${(selectedFile.size / 1024).toFixed(1)} KB` : '(GnuCash એક્સપોર્ટ અથવા સ્ટાન્ડર્ડ એકાઉન્ટિંગ CSV)'}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '10px',
              padding: '8px 10px',
              background: 'rgba(59, 130, 246, 0.05)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.70rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              border: '1px solid rgba(59, 130, 246, 0.15)'
            }}
          >
            <strong style={{ color: 'var(--primary)' }}>🛡️ ડાયનેમિક એકાઉન્ટ પ્રોટેક્શન સક્રિય:</strong>
            <br />
            નવી CSV ફાઇલ અપલોડ થતાં જ જૂનો હિસાબ સાફ થઈને નવો હિસાબ ઉમેરાશે. તમામ નવા ખાતાઓ આપમેળે સિસ્ટમમાં રજીસ્ટર થઈ જશે.
          </div>

          {uploadResult && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 10px',
                background: uploadResult.duplicate_transactions_skipped > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${uploadResult.duplicate_transactions_skipped > 0 ? '#f59e0b' : '#10b981'}`,
                fontSize: '0.74rem'
              }}
            >
              <div style={{ fontWeight: 700, color: uploadResult.duplicate_transactions_skipped > 0 ? '#d97706' : '#059669', marginBottom: '3px' }}>
                {uploadResult.message}
              </div>
              <div>ઉમેરાયેલ વ્યવહારો: <strong>{uploadResult.new_transactions_added}</strong></div>
              {uploadResult.date_min && (
                <div>સમયગાળો: {uploadResult.date_min} થી {uploadResult.date_max}</div>
              )}
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowUploadModal(false)}
              disabled={uploadLoading}
              style={{ padding: '5px 12px', fontSize: '0.78rem' }}
            >
              બંધ કરો
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || uploadLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', fontSize: '0.78rem' }}
            >
              {uploadLoading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>અપલોડ થઈ રહ્યું છે...</span>
                </>
              ) : (
                <>
                  <Upload size={13} />
                  <span>અપલોડ કરો અને સેવ કરો</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════ FULL RESET CONFIRMATION MODAL ═══════ */}
      <Modal
        show={showResetModal}
        onClose={() => {
          if (!resetLoading) setShowResetModal(false);
        }}
        title="⚠️ તમામ કન્સોલિડેટેડ હિસાબ સાફ કરવો છે?"
        maxWidth="460px"
      >
        <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            આ ક્રિયાથી <strong>બધા નો મિક્સ હિસાબ</strong> ના તમામ વ્યવહારો અને ખાતાવહી એન્ટ્રીઓ ડેટાબેઝમાંથી કાયમ માટે સાફ થઈ જશે.
          </p>
          <p style={{ marginTop: '8px' }}>
            શું તમે ખરેખર આગળ વધવા માંગો છો? આ કર્યા પછી તમે ગમે ત્યારે CSV ફાઇલ ફરીથી અપલોડ કરી શકશો.
          </p>
        </div>

        <div className="modal-footer" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowResetModal(false)}
            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
          >
            રદ કરો
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleResetAll}
            disabled={resetLoading}
            style={{ padding: '5px 14px', fontSize: '0.78rem' }}
          >
            {resetLoading ? 'સાફ થઈ રહ્યું છે...' : 'હા, તમામ ડેટા સાફ કરો'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
