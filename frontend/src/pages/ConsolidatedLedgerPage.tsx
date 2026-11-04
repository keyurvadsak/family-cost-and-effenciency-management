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
// Supports arbitrary levels of nested categories with mobile-responsive padding
// ═══════════════════════════════════════════════════════════════════════════
interface StatementRowProps {
  item: StatementItem;
  depth?: number;
  isMobile?: boolean;
  onSelectAccount: (fullName: string, gujaratiName?: string) => void;
}

const StatementItemRow: React.FC<StatementRowProps> = ({ item, depth = 0, isMobile = false, onSelectAccount }) => {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const indentStep = isMobile ? 12 : 18;
  const paddingLeft = depth === 0 ? '10px' : `${depth * indentStep + 10}px`;

  return (
    <>
      <tr style={{ background: hasChildren ? 'rgba(0, 0, 0, 0.015)' : 'transparent', borderBottom: '1px solid var(--border-glass)' }}>
        <td style={{ paddingLeft, fontWeight: hasChildren ? 750 : 500, fontSize: isMobile ? '0.78rem' : '0.83rem' }}>
          <span
            className="gnucash-acc-link"
            onClick={() => onSelectAccount(item.full_name, item.gujarati_name)}
            title="આ ખાતાના વ્યવહારો જુઓ"
            style={{ fontWeight: hasChildren ? 750 : 500, cursor: 'pointer' }}
          >
            {item.name}
          </span>
          {item.gujarati_name && item.gujarati_name !== item.name && (
            <span style={{ fontSize: isMobile ? '0.68rem' : '0.72rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
              ({item.gujarati_name})
            </span>
          )}
        </td>
        <td
          style={{
            textAlign: 'right',
            fontWeight: hasChildren ? 750 : 500,
            color: item.balance < 0 ? 'var(--error)' : 'inherit',
            whiteSpace: 'nowrap',
            fontSize: isMobile ? '0.78rem' : '0.84rem',
            fontFamily: 'monospace'
          }}
        >
          {formatCurrency(item.balance)}
        </td>
      </tr>

      {/* Recursively render child accounts at any arbitrary depth */}
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

  // 3 Primary Views:
  // 1. 'tree' (Chart of Accounts Tree)
  // 2. 'balance_sheet' (GnuCash Multicolumn Balance Sheet)
  // 3. 'income_statement' (GnuCash Multicolumn Income Statement)
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

      // Auto expand top level nodes initially
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
      {/* ═════════════════════ TOP HEADER BAR ═════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '6px 10px' : '8px 14px', fontSize: '0.82rem' }}
        >
          <ArrowLeft size={16} />
          <span>ધંધાઓ</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            title="પ્રિન્ટ રિપોર્ટ"
            style={{ padding: isMobile ? '6px 10px' : '8px 12px', fontSize: '0.82rem' }}
          >
            <Printer size={15} />
            {!isMobile && <span>પ્રિન્ટ</span>}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="રિફ્રેશ ડેટા"
            style={{ padding: isMobile ? '6px 10px' : '8px 12px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {!isMobile && <span>રિફ્રેશ</span>}
          </button>

          {/* Dynamic Accounts Registry Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenManageAccounts}
            title="ખાતાઓનું મેનેજમેન્ટ (Gujarati Labels & Streams)"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: isMobile ? '6px 10px' : '8px 14px', fontSize: '0.82rem' }}
          >
            <Settings size={15} />
            <span>{isMobile ? 'ખાતાઓ' : 'ખાતાઓ મેનેજ કરો'}</span>
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
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: isMobile ? '6px 10px' : '8px 14px', fontSize: '0.82rem' }}
              >
                <Upload size={15} />
                <span>{isMobile ? 'અપલોડ' : 'માસિક CSV અપલોડ'}</span>
              </button>

              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => setShowResetModal(true)}
                title="તમામ ડેટા સાફ કરો"
                style={{ padding: isMobile ? '6px 10px' : '8px 12px', fontSize: '0.82rem' }}
              >
                <Trash2 size={15} />
                {!isMobile && <span>રીસેટ</span>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═════════════════════ HERO / SUMMARY BANNER ═════════════════════ */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
          borderColor: 'rgba(217, 119, 6, 0.25)',
          padding: isMobile ? '12px 14px' : '18px 24px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: isMobile ? '38px' : '44px',
                height: isMobile ? '38px' : '44px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.28)',
                flexShrink: 0
              }}
            >
              <BookOpen size={isMobile ? 20 : 22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: isMobile ? '1.15rem' : '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  બધા નો મિક્સ હિસાબ
                </h1>
                <span className="badge badge-warning" style={{ fontSize: '0.66rem', padding: '1px 7px' }}>
                  માસ્ટર કેશબુક
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                લૂમ્સ, પ્રિશા ફેબ, હીરા વેપાર, ઉછીના-લોન અને સંયુક્ત પરિવારનો સંકલિત હિસાબ
              </p>
            </div>
          </div>

          <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              કુલ વ્યવહારો
            </div>
            <div style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {summary ? summary.total_count : 0}
            </div>
          </div>
        </div>

        {/* 4 Financial KPI Summary Cards (All in Rupee ₹) */}
        {summary && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: '8px',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-glass)'
            }}
          >
            {/* Card 1: Rokad Silak */}
            <div className="acc-kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="acc-kpi-title">રોકડ સિલક</span>
                <span className="badge" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>CASHBOOK</span>
              </div>
              <div className={`acc-kpi-value ${summary.net_cash_balance >= 0 ? 'text-credit' : 'text-debit'}`}>
                {formatCurrency(summary.net_cash_balance)}
              </div>
              <span className="acc-kpi-sub">હાથ પર રોકડ સિલક</span>
            </div>

            {/* Card 2: Total Inflow */}
            <div className="acc-kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="acc-kpi-title">કુલ રોકડ આવક</span>
                <span className="badge badge-success" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>જમા (+)</span>
              </div>
              <div className="acc-kpi-value text-credit">
                {formatCurrency(summary.period_inflow)}
              </div>
              <span className="acc-kpi-sub">પસંદ કરેલ સમયગાળામાં આવક</span>
            </div>

            {/* Card 3: Total Outflow */}
            <div className="acc-kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="acc-kpi-title">કુલ રોકડ ખર્ચ</span>
                <span className="badge badge-danger" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>ઉધાર (-)</span>
              </div>
              <div className="acc-kpi-value text-debit">
                {formatCurrency(summary.period_outflow)}
              </div>
              <span className="acc-kpi-sub">પસંદ કરેલ સમયગાળામાં ખર્ચ</span>
            </div>

            {/* Card 4: Net Flow */}
            <div className="acc-kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="acc-kpi-title">ચોખ્ખો પ્રવાહ</span>
                <span className="badge" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>ચોખ્ખી અસર</span>
              </div>
              <div className={`acc-kpi-value ${summary.net_change >= 0 ? 'text-credit' : 'text-debit'}`}>
                {formatCurrency(summary.net_change, true)}
              </div>
              <span className="acc-kpi-sub">આવક - ખર્ચ તફાવત</span>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════ 3 PRIMARY TABS (Scrollable on Mobile) ═════════════════════ */}
      <div
        className="glass-card"
        style={{
          padding: '4px',
          marginBottom: '14px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="gnucash-tabs-container">
          {/* Tab 1: Chart of Accounts */}
          <button
            type="button"
            className="gnucash-tab-btn"
            onClick={() => {
              setViewMode('tree');
              setSearchParams({ view: 'tree' });
            }}
            style={{
              fontWeight: viewMode === 'tree' ? 800 : 500,
              background: viewMode === 'tree' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'tree' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            <Building size={15} />
            <span>એકાઉન્ટ્સ વૃક્ષ (Chart of Accounts)</span>
          </button>

          {/* Tab 2: Balance Sheet */}
          <button
            type="button"
            className="gnucash-tab-btn"
            onClick={() => {
              setViewMode('balance_sheet');
              setSearchParams({ view: 'balance_sheet' });
            }}
            style={{
              fontWeight: viewMode === 'balance_sheet' ? 800 : 500,
              background: viewMode === 'balance_sheet' ? '#d97706' : 'transparent',
              color: viewMode === 'balance_sheet' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            <Scale size={15} />
            <span>બેલેન્સ શીટ (Balance Sheet)</span>
          </button>

          {/* Tab 3: Income Statement */}
          <button
            type="button"
            className="gnucash-tab-btn"
            onClick={() => {
              setViewMode('income_statement');
              setSearchParams({ view: 'income_statement' });
            }}
            style={{
              fontWeight: viewMode === 'income_statement' ? 800 : 500,
              background: viewMode === 'income_statement' ? '#10b981' : 'transparent',
              color: viewMode === 'income_statement' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            <TrendingUp size={15} />
            <span>નફો-નુકસાન પત્રક (Income Statement)</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          VIEW 1: CHART OF ACCOUNTS HIERARCHICAL TREE VIEW
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' && (
        <div className="glass-card" style={{ padding: isMobile ? '12px' : '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '0.95rem' : '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                સંપૂર્ણ એકાઉન્ટ્સ ચાર્ટ (GnuCash Tree Hierarchy)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                કોઈપણ ખાતા પર ક્લિક કરીને તેના વ્યવહારો જુઓ.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="btn btn-secondary" onClick={expandAllNodes} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                બધા ખોલો
              </button>
              <button type="button" className="btn btn-secondary" onClick={collapseAllNodes} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                બધા બંધ કરો
              </button>
            </div>
          </div>

          <div className="gnucash-table-wrapper">
            <table className="gnucash-tree-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>ખાતાનું નામ (Account Name)</th>
                  <th style={{ padding: '8px 10px', width: isMobile ? '80px' : '120px' }}>પ્રકાર</th>
                  <th style={{ padding: '8px 10px', width: isMobile ? '120px' : '150px', textAlign: 'right' }}>કુલ રકમ</th>
                </tr>
              </thead>
              <tbody>
                {accountsTree.map((node) => {
                  const renderNode = (n: AccountTreeNode, depth = 0): React.ReactNode => {
                    const isExpanded = expandedNodes[n.full_name] ?? false;
                    const badge = getTypeBadgeStyle(n.type);
                    const indent = isMobile ? depth * 14 + 6 : depth * 20 + 10;

                    return (
                      <React.Fragment key={n.full_name}>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--border-glass)',
                            transition: 'background 0.1s ease',
                          }}
                          className="gnucash-tree-row"
                        >
                          <td style={{ padding: '6px 8px', paddingLeft: `${indent}px` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              ) : (
                                <span style={{ width: '14px', display: 'inline-block' }} />
                              )}

                              {n.has_children ? (
                                isExpanded ? <FolderOpen size={15} color="#d97706" /> : <Folder size={15} color="#d97706" />
                              ) : (
                                <CornerDownRight size={12} color="var(--text-muted)" />
                              )}

                              <span
                                className="gnucash-acc-link"
                                onClick={() => handleOpenAccountModal(n.full_name, n.gujarati_name)}
                                title="આ ખાતાના વ્યવહારો જુઓ"
                                style={{ fontWeight: depth === 0 ? 800 : n.has_children ? 700 : 500, cursor: 'pointer' }}
                              >
                                {n.name}
                              </span>

                              {n.gujarati_name && n.gujarati_name !== n.name && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                                  ({n.gujarati_name})
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '6px 8px' }}>
                            <span
                              style={{
                                fontSize: '0.64rem',
                                padding: '2px 6px',
                                borderRadius: '8px',
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                fontWeight: 600,
                                display: 'inline-block',
                              }}
                            >
                              {n.type}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontWeight: depth === 0 || n.has_children ? 800 : 600,
                              color: n.balance < 0 ? 'var(--error)' : 'inherit',
                              whiteSpace: 'nowrap',
                              fontFamily: 'monospace',
                              fontSize: isMobile ? '0.78rem' : '0.84rem'
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
          VIEW 2: DYNAMIC BALANCE SHEET (All Amounts in Rupee ₹)
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'balance_sheet' && balanceSheet && (
        <div className="gnucash-statement-card" style={{ marginTop: '10px' }}>
          {/* Header Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '1.05rem' : '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Balance Sheet (Multicolumn) {balanceSheet.as_of_date_formatted}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ સરવૈયું / સ્થિતિ દર્શક પત્રક (તારીખ: {balanceSheet.as_of_date_formatted} સુધી)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={13} color="var(--text-muted)" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>તારીખ:</span>
                <input
                  type="date"
                  value={bsAsOfDate}
                  onChange={(e) => setBsAsOfDate(e.target.value)}
                  className="input-field"
                  style={{ height: '28px', fontSize: '0.74rem', padding: '2px 6px' }}
                />
              </div>

              <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
                ✓ સરભર છે (Balanced)
              </span>
            </div>
          </div>

          {/* Multicolumn Layout: Left = Asset | Right = Liability & Equity */}
          <div className="gnucash-statement-grid">
            {/* ══════ LEFT COLUMN: ASSET ══════ */}
            <div className="gnucash-col">
              <div className="gnucash-sec-header">
                <span>Asset (સંપત્તિ)</span>
                <span>રકમ (₹)</span>
              </div>

              <div className="gnucash-table-wrapper">
                <table className="gnucash-table">
                  <tbody>
                    {/* ASSETS Root Row */}
                    <tr>
                      <td style={{ fontWeight: 800, fontSize: isMobile ? '0.82rem' : '0.88rem' }}>{balanceSheet.assets.root_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: isMobile ? '0.82rem' : '0.88rem' }}>
                        {formatCurrency(balanceSheet.assets.root_total)}
                      </td>
                    </tr>

                    {/* Children of ASSETS rendered dynamically via StatementItemRow */}
                    {balanceSheet.assets.children.map((item) => (
                      <StatementItemRow
                        key={item.full_name}
                        item={item}
                        depth={1}
                        isMobile={isMobile}
                        onSelectAccount={handleOpenAccountModal}
                      />
                    ))}

                    {/* Standalone Asset items (Old-Money, Cashbook, etc.) */}
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

              {/* Total For Asset */}
              <div className="gnucash-total-bar" style={{ marginTop: 'auto' }}>
                <span>Total For Asset (કુલ સંપત્તિ)</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(balanceSheet.assets.total_asset)}</span>
              </div>
            </div>

            {/* ══════ RIGHT COLUMN: LIABILITY & EQUITY ══════ */}
            <div className="gnucash-col">
              {/* 1. Liability */}
              <div>
                <div className="gnucash-sec-header">
                  <span>Liability (દેવું અને લોન)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: isMobile ? '0.82rem' : '0.88rem' }}>{balanceSheet.liabilities.root_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: isMobile ? '0.82rem' : '0.88rem' }}>
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

                {/* Total For Liability */}
                <div className="gnucash-total-bar" style={{ marginTop: '6px' }}>
                  <span>Total For Liability (કુલ દેવું)</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(balanceSheet.liabilities.total_liability)}</span>
                </div>
              </div>

              {/* 2. Equity */}
              <div style={{ marginTop: '10px' }}>
                <div className="gnucash-sec-header">
                  <span>Equity (મૂડી)</span>
                  <span>રકમ (₹)</span>
                </div>

                <div className="gnucash-table-wrapper">
                  <table className="gnucash-table">
                    <tbody>
                      {/* Render explicit equity accounts dynamically */}
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
                            <span
                              className="gnucash-acc-link"
                              onClick={() => handleOpenAccountModal('Capital Acc', 'મૂડી ખાતું')}
                              title="મૂડી ખાતાના વ્યવહારો જુઓ"
                            >
                              Capital Acc
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                              (મૂડી ખાતું)
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatCurrency(balanceSheet.equity.capital_acc)}
                          </td>
                        </tr>
                      )}

                      {/* Unrealized Gains */}
                      <tr>
                        <td style={{ paddingLeft: '10px' }}>Unrealized Gains</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatCurrency(balanceSheet.equity.unrealized_gains)}
                        </td>
                      </tr>

                      {/* Retained Earnings */}
                      <tr>
                        <td style={{ paddingLeft: '10px' }}>Retained Earnings (સંચિત નફો)</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatCurrency(balanceSheet.equity.retained_earnings)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Total For Equity */}
                <div className="gnucash-total-bar" style={{ marginTop: '6px' }}>
                  <span>Total For Equity (કુલ મૂડી & નફો)</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(balanceSheet.equity.total_equity)}</span>
                </div>
              </div>

              {/* Total For Liability and Equity */}
              <div
                className="gnucash-total-bar"
                style={{
                  marginTop: '10px',
                  background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15) 0%, rgba(245, 158, 11, 0.22) 100%)',
                  borderTop: '2px solid #d97706',
                  color: '#b45309',
                  fontSize: isMobile ? '0.85rem' : '0.94rem'
                }}
              >
                <span>Total For Liability and Equity</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(balanceSheet.total_liability_and_equity)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 3: DYNAMIC INCOME STATEMENT (All Amounts in Rupee ₹)
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'income_statement' && incomeStatement && (
        <div className="gnucash-statement-card" style={{ marginTop: '10px' }}>
          {/* Header Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '1.05rem' : '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Income Statement (Multicolumn) {incomeStatement.start_date_formatted} to {incomeStatement.end_date_formatted}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ આવક-ખર્ચ પત્રક (નફો-નુકસાન પત્રક)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={13} color="var(--text-muted)" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>તારીખ:</span>
                <input
                  type="date"
                  value={isStartDate}
                  onChange={(e) => setIsStartDate(e.target.value)}
                  className="input-field"
                  style={{ height: '28px', fontSize: '0.74rem', padding: '2px 6px' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>થી</span>
                <input
                  type="date"
                  value={isEndDate}
                  onChange={(e) => setIsEndDate(e.target.value)}
                  className="input-field"
                  style={{ height: '28px', fontSize: '0.74rem', padding: '2px 6px' }}
                />
              </div>
            </div>
          </div>

          {/* Multicolumn Layout: Left = Income | Right = Expense */}
          <div className="gnucash-statement-grid">
            {/* ══════ LEFT COLUMN: INCOME ══════ */}
            <div className="gnucash-col">
              <div className="gnucash-sec-header">
                <span>Income (આવક)</span>
                <span>રકમ (₹)</span>
              </div>

              <div className="gnucash-table-wrapper">
                <table className="gnucash-table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 800, fontSize: isMobile ? '0.82rem' : '0.88rem' }}>{incomeStatement.income.root_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: isMobile ? '0.82rem' : '0.88rem' }}>
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

              {/* Total For Income */}
              <div className="gnucash-total-bar" style={{ marginTop: 'auto' }}>
                <span>Total For Income (કુલ આવક)</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(incomeStatement.income.total_income)}</span>
              </div>

              {/* Net Income Box */}
              <div style={{ marginTop: '12px' }}>
                <div className="gnucash-sec-header" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff' }}>
                  <span>Net Income (ચોખ્ખો નફો)</span>
                  <span>ચોખ્ખી રકમ (₹)</span>
                </div>

                <div
                  className="gnucash-total-bar"
                  style={{
                    background: incomeStatement.net_income >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    borderTop: `2px solid ${incomeStatement.net_income >= 0 ? '#10b981' : '#ef4444'}`,
                    color: incomeStatement.net_income >= 0 ? '#047857' : '#b91c1c',
                    fontSize: isMobile ? '0.85rem' : '0.94rem',
                    fontFamily: 'monospace'
                  }}
                >
                  <span>Total For Net Income (ચોખ્ખો નફો)</span>
                  <span>{formatCurrency(incomeStatement.net_income)}</span>
                </div>
              </div>
            </div>

            {/* ══════ RIGHT COLUMN: EXPENSE ══════ */}
            <div className="gnucash-col">
              <div className="gnucash-sec-header">
                <span>Expense (ખર્ચાઓ)</span>
                <span>રકમ (₹)</span>
              </div>

              <div className="gnucash-table-wrapper">
                <table className="gnucash-table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 800, fontSize: isMobile ? '0.82rem' : '0.88rem' }}>{incomeStatement.expense.root_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: isMobile ? '0.82rem' : '0.88rem' }}>
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

              {/* Total For Expense */}
              <div className="gnucash-total-bar" style={{ marginTop: 'auto' }}>
                <span>Total For Expense (કુલ ખર્ચ)</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(incomeStatement.expense.total_expense)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ONE-CLICK ACCOUNT STATEMENT MODAL / DRAWER (All Amounts in ₹)
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
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ખાતાના વ્યવહારો લોડ થઈ રહ્યા છે...</div>
          </div>
        ) : accountStatement ? (
          <div>
            {/* Account Metrics Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <div className="acc-kpi-card" style={{ padding: '8px 10px' }}>
                <span className="acc-kpi-title">કુલ આવક / જમા</span>
                <div className="acc-kpi-value text-credit" style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', margin: '2px 0' }}>
                  {formatCurrency(accountStatement.total_inflow)}
                </div>
              </div>

              <div className="acc-kpi-card" style={{ padding: '8px 10px' }}>
                <span className="acc-kpi-title">કુલ ખર્ચ / ઉધાર</span>
                <div className="acc-kpi-value text-debit" style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', margin: '2px 0' }}>
                  {formatCurrency(accountStatement.total_outflow)}
                </div>
              </div>

              <div className="acc-kpi-card" style={{ padding: '8px 10px' }}>
                <span className="acc-kpi-title">ચોખ્ખું બેલેન્સ</span>
                <div className={`acc-kpi-value ${accountStatement.net_balance >= 0 ? 'text-credit' : 'text-debit'}`} style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', margin: '2px 0' }}>
                  {formatCurrency(accountStatement.net_balance)}
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="table-responsive" style={{ maxHeight: isMobile ? '340px' : '420px', overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '0.76rem' : '0.8rem' }}>
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
                          <span className="badge" style={{ fontSize: '0.62rem' }}>{t.business_stream}</span>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ fontWeight: 600 }}>{t.description}</div>
                          {t.notes && t.notes !== t.description && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.notes}</div>
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

            <div className="modal-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                ખાતું: <code>{accountStatement.account_name}</code>
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseAccountModal}
                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
              >
                બંધ કરો
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          DYNAMIC ACCOUNTS REGISTRY MODAL (ZERO-CODE LABELS & STREAMS)
          ═══════════════════════════════════════════════════════════ */}
      <Modal
        show={showManageAccountsModal}
        onClose={() => {
          setShowManageAccountsModal(false);
          setEditingAccountId(null);
        }}
        title="⚙️ ખાતાઓનું મેનેજમેન્ટ (Dynamic Accounts & Custom Labels)"
        maxWidth="860px"
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              કોઈપણ ખાતાનું ગુજરાતી નામ અથવા બિઝનેસ સ્ટ્રીમ અહીંથી સીધું બદલી શકો છો. આ ફેરફારો ભવિષ્યમાં હંમેશાં સચવાઈ રહેશે.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSyncAccounts}
              disabled={accountsListLoading}
              style={{ fontSize: '0.74rem', padding: '4px 10px' }}
            >
              <RefreshCw size={13} className={accountsListLoading ? 'animate-spin' : ''} />
              <span>ખાતાઓ સિન્ક કરો</span>
            </button>
          </div>

          <div className="table-responsive" style={{ maxHeight: isMobile ? '360px' : '460px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>ખાતાનું નામ (Full Path)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', width: '80px' }}>પ્રકાર</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>ગુજરાતી ડિસ્પ્લે નામ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>બિઝનેસ પ્રવાહ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: '80px' }}>ક્રિયા</th>
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
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{acc.full_name}</div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ fontSize: '0.64rem', padding: '2px 5px', borderRadius: '4px', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
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
                            style={{ fontSize: '0.76rem', height: '26px', padding: '2px 6px' }}
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
                            style={{ fontSize: '0.76rem', height: '26px', padding: '2px 6px' }}
                            placeholder="બિઝનેસ પ્રવાહ..."
                          />
                        ) : (
                          <span className="badge" style={{ fontSize: '0.64rem' }}>{acc.business_stream || '-'}</span>
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
                              style={{ padding: '3px 7px', fontSize: '0.68rem' }}
                              title="સાચવો"
                            >
                              <Save size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setEditingAccountId(null)}
                              style={{ padding: '3px 6px', fontSize: '0.68rem' }}
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
                            style={{ padding: '3px 7px', fontSize: '0.68rem' }}
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
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
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
        maxWidth="540px"
      >
        <form onSubmit={handleUploadSubmit}>
          <div
            style={{
              padding: isMobile ? '18px 12px' : '24px 16px',
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
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(217, 119, 6, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                }}
              >
                <Upload size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                {selectedFile ? selectedFile.name : 'દર મહિનાની CSV ફાઇલ અહીં પસંદ કરો'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
              fontSize: '0.72rem',
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
                padding: '10px',
                background: uploadResult.duplicate_transactions_skipped > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${uploadResult.duplicate_transactions_skipped > 0 ? '#f59e0b' : '#10b981'}`,
                fontSize: '0.76rem'
              }}
            >
              <div style={{ fontWeight: 700, color: uploadResult.duplicate_transactions_skipped > 0 ? '#d97706' : '#059669', marginBottom: '4px' }}>
                {uploadResult.message}
              </div>
              <div>ઉમેરાયેલ વ્યવહારો: <strong>{uploadResult.new_transactions_added}</strong></div>
              {uploadResult.date_min && (
                <div>સમયગાળો: {uploadResult.date_min} થી {uploadResult.date_max}</div>
              )}
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '14px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowUploadModal(false)}
              disabled={uploadLoading}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            >
              બંધ કરો
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || uploadLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 14px', fontSize: '0.8rem' }}
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
        maxWidth="480px"
      >
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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
            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
          >
            રદ કરો
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleResetAll}
            disabled={resetLoading}
            style={{ padding: '5px 14px', fontSize: '0.8rem' }}
          >
            {resetLoading ? 'સાફ થઈ રહ્યું છે...' : 'હા, તમામ ડેટા સાફ કરો'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
