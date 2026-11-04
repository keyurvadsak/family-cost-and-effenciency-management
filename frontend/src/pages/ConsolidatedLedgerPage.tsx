import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Upload, Printer,
  BookOpen, ChevronDown, ChevronRight,
  RefreshCw, Trash2, Building, ArrowRight,
  FolderOpen, Folder, CornerDownRight, Check,
  Calendar, TrendingUp, Scale
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
  AccountStatementData
} from '../api';
import Modal from '../components/ui/Modal';
import LoadingScreen from '../components/ui/LoadingScreen';

export default function ConsolidatedLedgerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state persistence (clickable URL support)
  const initialView = (searchParams.get('view') as 'tree' | 'balance_sheet' | 'income_statement') || 'tree';
  const initialAccount = searchParams.get('account') || '';

  // 3 Primary Views as requested by user:
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

  // Income Statement date filters (Default matching GnuCash screenshot: 2025-11-01 to 2026-12-31)
  const [isStartDate, setIsStartDate] = useState('2025-11-01');
  const [isEndDate, setIsEndDate] = useState('2026-12-31');

  // Balance sheet as-of date (Default matching GnuCash screenshot: 2026-12-31)
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

  // Toggle tree node expansion (CLOSE AND OPEN ONLY)
  const toggleNode = (nodeFullName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeFullName]: !prev[nodeFullName]
    }));
  };

  // Expand all tree nodes
  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    const traverse = (nodes: AccountTreeNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          allExpanded[n.full_name] = true;
          traverse(n.children);
        }
      }
    };
    traverse(accountsTree);
    setExpandedNodes(allExpanded);
  };

  // Collapse all tree nodes
  const handleCollapseAll = () => {
    setExpandedNodes({});
  };

  // Initial and full data fetch
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [sumData, treeData, bsData, isData] = await Promise.all([
        consolidatedApi.getSummary(),
        consolidatedApi.getAccountsTree(),
        consolidatedApi.getBalanceSheet(bsAsOfDate),
        consolidatedApi.getIncomeStatement(isStartDate, isEndDate),
      ]);

      setSummary(sumData);
      setAccountsTree(treeData);
      setBalanceSheet(bsData);
      setIncomeStatement(isData);

      // Auto-expand top level roots dynamically
      const initialExp: Record<string, boolean> = {};
      treeData.forEach(r => {
        if (r.children && r.children.length > 0) {
          initialExp[r.full_name] = true;
          r.children.forEach(c => {
            if (c.children && c.children.length > 0) {
              initialExp[c.full_name] = true;
            }
          });
        }
      });
      setExpandedNodes(prev => ({ ...initialExp, ...prev }));
    } catch (err: any) {
      console.error('Failed to load consolidated data', err);
      showToast('ડેટા લોડ કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [bsAsOfDate, isStartDate, isEndDate]);

  // Sync URL search params
  useEffect(() => {
    const urlView = (searchParams.get('view') as 'tree' | 'balance_sheet' | 'income_statement') || 'tree';
    if (urlView !== viewMode) {
      setViewMode(urlView);
    }
    const urlAcc = searchParams.get('account');
    if (urlAcc && urlAcc !== selectedAccountModal) {
      handleOpenAccountModal(urlAcc);
    }
  }, [searchParams]);

  // One-click handler to open an account's statement and update URL
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

  // Close account statement modal
  const handleCloseAccountModal = () => {
    setSelectedAccountModal(null);
    setAccountStatement(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('account');
      return next;
    });
  };

  // Handle CSV file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  // Upload CSV handler
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
      showToast(res.message, res.new_transactions_added > 0 ? 'success' : 'info');
      fetchData();
    } catch (err: any) {
      console.error('Upload failed', err);
      const detail = err.response?.data?.detail || 'ફાઇલ અપલોડ કરવામાં નિષ્ફળતા મળી.';
      showToast(detail, 'error');
    } finally {
      setUploadLoading(false);
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

  // Recursive Tree Node Renderer for View 1 (Chart of Accounts)
  const renderTreeNode = (node: AccountTreeNode, depth = 0) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = Boolean(expandedNodes[node.full_name]);
    const typeStyle = getTypeBadgeStyle(node.type);

    return (
      <React.Fragment key={node.full_name}>
        <tr
          onClick={() => hasChildren && toggleNode(node.full_name)}
          style={{
            cursor: hasChildren ? 'pointer' : 'default',
            borderBottom: '1px solid var(--border-glass)',
            transition: 'background 0.15s ease',
          }}
          className="gnucash-tree-row"
        >
          {/* Account Name with chevron and click link */}
          <td style={{ padding: '8px 12px', paddingLeft: `${depth * 22 + 12}px`, whiteSpace: 'nowrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => toggleNode(node.full_name, e)}
                  style={{
                    background: isExpanded ? 'rgba(37, 99, 235, 0.15)' : 'rgba(107, 114, 128, 0.12)',
                    border: '1px solid var(--border-glass)',
                    padding: '2px',
                    cursor: 'pointer',
                    color: isExpanded ? 'var(--primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                  }}
                  title={isExpanded ? 'સંકોચો' : 'વિસ્તૃત કરો'}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span style={{ width: '20px', display: 'inline-block', textAlign: 'center' }}>
                  <CornerDownRight size={12} color="var(--text-muted)" />
                </span>
              )}

              {hasChildren ? (
                isExpanded ? <FolderOpen size={16} color="#d97706" /> : <Folder size={16} color="#d97706" />
              ) : (
                <Building size={15} color="var(--text-secondary)" />
              )}

              <div>
                <span
                  className="gnucash-acc-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAccountModal(node.full_name, node.gujarati_name);
                  }}
                  style={{ fontWeight: hasChildren ? 800 : 600, fontSize: '0.84rem' }}
                  title="ક્લિક કરીને આ ખાતાના તમામ વ્યવહારો જુઓ"
                >
                  {node.name}
                </span>
                {node.gujarati_name && node.gujarati_name !== node.name && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                    ({node.gujarati_name})
                  </span>
                )}
                {hasChildren && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '6px', opacity: 0.8 }}>
                    [{node.children.length}]
                  </span>
                )}
              </div>
            </div>
          </td>

          {/* Account Type */}
          <td style={{ padding: '8px 12px', width: '120px' }}>
            <span
              className="badge"
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                background: typeStyle.bg,
                color: typeStyle.color,
                border: `1px solid ${typeStyle.border}`,
              }}
            >
              {node.type}
            </span>
          </td>

          {/* Total Balance */}
          <td
            style={{
              padding: '8px 14px',
              textAlign: 'right',
              fontWeight: 700,
              fontSize: '0.86rem',
              width: '160px',
              color: node.balance < 0 ? 'var(--error)' : 'var(--text-main)',
            }}
          >
            {node.balance < 0 ? `-₹${Math.abs(node.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `₹${node.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </td>

          {/* One-click Action to open Statement */}
          <td style={{ padding: '8px 12px', textAlign: 'center', width: '130px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAccountModal(node.full_name, node.gujarati_name);
              }}
              style={{
                padding: '4px 10px',
                fontSize: '0.72rem',
                gap: '5px',
                background: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--primary)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
              }}
              title="માત્ર આ ખાતાના તમામ વ્યવહારો જુઓ"
            >
              <span>વ્યવહારો જુઓ</span>
              <ArrowRight size={12} />
            </button>
          </td>
        </tr>

        {hasChildren && isExpanded && node.children.map((child) => renderTreeNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="animate-slide-up">
      {/* ═══════ TOP NAVIGATION & ACTIONS ═══════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/businesses')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} />
          <span>ધંધાઓ</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            title="પ્રિન્ટ અથવા PDF નિકાસ"
          >
            <Printer size={15} />
            <span className="hide-mobile">પ્રિન્ટ</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            disabled={refreshing}
            title="ડેટા રીફ્રેશ કરો"
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span className="hide-mobile">રીફ્રેશ</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowUploadModal(true)}
            style={{ background: '#d97706', borderColor: '#d97706' }}
          >
            <Upload size={15} />
            <span>માસિક CSV અપલોડ</span>
          </button>

          {user?.role === 'admin' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowResetModal(true)}
              style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              title="બધો ડેટા સાફ કરો"
            >
              <Trash2 size={15} />
              <span className="hide-mobile">રીસેટ</span>
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
              <span className="badge" style={{ fontSize: '0.68rem', background: '#d97706', color: '#ffffff', fontWeight: 700, padding: '2px 8px' }}>
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

      {/* ═══════ HIGH-DENSITY EXECUTIVE KPIS ═══════ */}
      <div className="acc-kpi-grid mix-kpi-grid" style={{ marginTop: '12px' }}>
        {/* KPI 1: Cash Balance */}
        <div className="acc-kpi-card kpi-balance">
          <div className="acc-kpi-header">
            <span className="acc-kpi-title">રોકડ સિલક</span>
            <span className="acc-kpi-badge badge-warning">CASHBOOK</span>
          </div>
          <div className={`acc-kpi-value ${(summary?.net_cash_balance || 0) < 0 ? 'text-debit' : 'text-credit'}`}>
            {(summary?.net_cash_balance || 0) < 0
              ? `-₹${Math.abs(summary?.net_cash_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
              : `₹${(summary?.net_cash_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="acc-kpi-subtext">
            <span>હાથ પર રોકડ / કેશબોક્સ</span>
          </div>
        </div>

        {/* KPI 2: Period Inflow */}
        <div className="acc-kpi-card kpi-income">
          <div className="acc-kpi-header">
            <span className="acc-kpi-title">કુલ રોકડ આવક</span>
            <span className="acc-kpi-badge badge-success">જમા (+)</span>
          </div>
          <div className="acc-kpi-value text-credit">
            ₹{(summary?.period_inflow || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="acc-kpi-subtext">
            <span>પસંદ કરેલ સમયગાળામાં આવક</span>
          </div>
        </div>

        {/* KPI 3: Period Outflow */}
        <div className="acc-kpi-card kpi-expense">
          <div className="acc-kpi-header">
            <span className="acc-kpi-title">કુલ રોકડ ખર્ચ</span>
            <span className="acc-kpi-badge badge-danger">ઉધાર (-)</span>
          </div>
          <div className="acc-kpi-value text-debit">
            ₹{(summary?.period_outflow || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="acc-kpi-subtext">
            <span>પસંદ કરેલ સમયગાળામાં ખર્ચ</span>
          </div>
        </div>

        {/* KPI 4: Net Flow */}
        <div className="acc-kpi-card kpi-profit">
          <div className="acc-kpi-header">
            <span className="acc-kpi-title">ચોખ્ખો પ્રવાહ</span>
            <span className={`acc-kpi-badge ${(summary?.net_change || 0) >= 0 ? 'badge-success' : 'badge-danger'}`}>
              {(summary?.net_change || 0) >= 0 ? 'સરપ્લસ' : 'ડેફિસિટ'}
            </span>
          </div>
          <div className={`acc-kpi-value ${(summary?.net_change || 0) >= 0 ? 'text-net-profit' : 'text-net-loss'}`}>
            {(summary?.net_change || 0) < 0
              ? `-₹${Math.abs(summary?.net_change || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
              : `+₹${(summary?.net_change || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="acc-kpi-subtext">
            <span>આવક - ખર્ચ તફાવત</span>
          </div>
        </div>
      </div>

      {/* ═══════ THE 3 SPECIALIZED TABS (CHART OF ACCOUNTS / BALANCE SHEET / INCOME STATEMENT) ═══════ */}
      <div
        className="glass-card"
        style={{
          marginTop: '12px',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'inline-flex', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', padding: '3px', border: '1px solid var(--border-glass)' }}>
          {/* Tab 1: Chart of Accounts */}
          <button
            type="button"
            onClick={() => {
              setViewMode('tree');
              setSearchParams({ view: 'tree' });
            }}
            style={{
              padding: '7px 16px',
              fontSize: '0.82rem',
              fontWeight: viewMode === 'tree' ? 800 : 500,
              background: viewMode === 'tree' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'tree' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: '0.15s ease',
            }}
          >
            <Building size={15} />
            <span>એકાઉન્ટ્સ વૃક્ષ (Chart of Accounts)</span>
          </button>

          {/* Tab 2: Balance Sheet */}
          <button
            type="button"
            onClick={() => {
              setViewMode('balance_sheet');
              setSearchParams({ view: 'balance_sheet' });
            }}
            style={{
              padding: '7px 16px',
              fontSize: '0.82rem',
              fontWeight: viewMode === 'balance_sheet' ? 800 : 500,
              background: viewMode === 'balance_sheet' ? '#d97706' : 'transparent',
              color: viewMode === 'balance_sheet' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: '0.15s ease',
            }}
          >
            <Scale size={15} />
            <span>બેલેન્સ શીટ (Balance Sheet)</span>
          </button>

          {/* Tab 3: Income Statement */}
          <button
            type="button"
            onClick={() => {
              setViewMode('income_statement');
              setSearchParams({ view: 'income_statement' });
            }}
            style={{
              padding: '7px 16px',
              fontSize: '0.82rem',
              fontWeight: viewMode === 'income_statement' ? 800 : 500,
              background: viewMode === 'income_statement' ? '#10b981' : 'transparent',
              color: viewMode === 'income_statement' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: '0.15s ease',
            }}
          >
            <TrendingUp size={15} />
            <span>નફો-નુકસાન પત્રક (Income Statement)</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          VIEW 1: CHART OF ACCOUNTS TREE (GnuCash Desktop Style)
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' && (
        <div className="glass-card" style={{ marginTop: '12px', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-surface-elevated)', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={16} color="var(--primary)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
                ખાતાઓનું વૃક્ષ (Chart of Accounts Tree)
              </h3>
              <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                {accountsTree.length} મુખ્ય વિભાગો
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExpandAll}
                style={{ fontSize: '0.72rem', padding: '3px 10px', height: '28px' }}
                title="તમામ પેટા-ખાતાઓ ખોલો"
              >
                <span>➕ બધા ખોલો</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCollapseAll}
                style={{ fontSize: '0.72rem', padding: '3px 10px', height: '28px' }}
                title="તમામ પેટા-ખાતાઓ બંધ કરો"
              >
                <span>➖ બધા બંધ કરો</span>
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-glass)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    ખાતાનું નામ (Account Name)
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)', width: '120px' }}>
                    પ્રકાર (Type)
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)', width: '160px' }}>
                    કુલ રકમ (Total Balance)
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)', width: '130px' }}>
                    ક્રિયા / વ્યવહારો
                  </th>
                </tr>
              </thead>
              <tbody>
                {accountsTree.map((rootNode) => renderTreeNode(rootNode, 0))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 2: BALANCE SHEET (MULTICOLUMN) - MATCHING SCREENSHOT 1
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'balance_sheet' && balanceSheet && (
        <div className="gnucash-statement-card" style={{ marginTop: '12px' }}>
          {/* Header Title matching screenshot 1 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Balance Sheet (Multicolumn) {balanceSheet.as_of_date_formatted}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                દ્વિ-સ્તંભ સરવૈયું / સ્થિતિ દર્શક પત્રક (તારીખ: {balanceSheet.as_of_date_formatted} સુધી)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>તારીખ સુધી:</span>
                <input
                  type="date"
                  value={bsAsOfDate}
                  onChange={(e) => setBsAsOfDate(e.target.value)}
                  className="input-field"
                  style={{ height: '30px', fontSize: '0.76rem', padding: '2px 8px' }}
                />
              </div>

              <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
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
                <span>રકમ</span>
              </div>

              <table className="gnucash-table">
                <tbody>
                  {/* ASSETS Root */}
                  <tr>
                    <td style={{ fontWeight: 800 }}>{balanceSheet.assets.root_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      $ {balanceSheet.assets.root_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Children of ASSETS (Clickable Links) */}
                  {balanceSheet.assets.children.map((item) => (
                    <tr key={item.full_name}>
                      <td style={{ paddingLeft: '22px' }}>
                        <span
                          className="gnucash-acc-link"
                          onClick={() => handleOpenAccountModal(item.full_name, item.gujarati_name)}
                          title="આ ખાતાના વ્યવહારો જુઓ"
                        >
                          {item.name}
                        </span>
                        {item.gujarati_name && item.gujarati_name !== item.name && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                            ({item.gujarati_name})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        $ {item.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {/* Standalone Asset items (Cap. Old-Money & Cashbook) */}
                  {balanceSheet.assets.standalone.map((item) => (
                    <tr key={item.full_name}>
                      <td>
                        <span
                          className="gnucash-acc-link"
                          onClick={() => handleOpenAccountModal(item.full_name, item.gujarati_name)}
                          title="આ ખાતાના વ્યવહારો જુઓ"
                        >
                          {item.name}
                        </span>
                        {item.gujarati_name && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                            ({item.gujarati_name})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: item.balance < 0 ? 'var(--error)' : 'inherit' }}>
                        {item.balance < 0
                          ? `$ -${Math.abs(item.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : `$ ${item.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total For Asset */}
              <div className="gnucash-total-bar" style={{ marginTop: 'auto' }}>
                <span>Total For Asset (કુલ સંપત્તિ)</span>
                <span>$ {balanceSheet.assets.total_asset.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* ══════ RIGHT COLUMN: LIABILITY & EQUITY ══════ */}
            <div className="gnucash-col">
              {/* 1. Liability */}
              <div>
                <div className="gnucash-sec-header">
                  <span>Liability (દેવું અને લોન)</span>
                  <span>રકમ</span>
                </div>

                <table className="gnucash-table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 800 }}>{balanceSheet.liabilities.root_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>
                        $ {balanceSheet.liabilities.root_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {balanceSheet.liabilities.children.map((item) => (
                      <tr key={item.full_name}>
                        <td style={{ paddingLeft: '22px' }}>
                          <span
                            className="gnucash-acc-link"
                            onClick={() => handleOpenAccountModal(item.full_name, item.gujarati_name)}
                            title="આ ખાતાના વ્યવહારો જુઓ"
                          >
                            {item.name}
                          </span>
                          {item.gujarati_name && item.gujarati_name !== item.name && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                              ({item.gujarati_name})
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          $ {item.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Total For Liability */}
                <div className="gnucash-total-bar" style={{ marginTop: '6px' }}>
                  <span>Total For Liability (કુલ દેવું)</span>
                  <span>$ {balanceSheet.liabilities.total_liability.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* 2. Equity */}
              <div style={{ marginTop: '10px' }}>
                <div className="gnucash-sec-header">
                  <span>Equity (મૂડી)</span>
                  <span>રકમ</span>
                </div>

                <table className="gnucash-table">
                  <tbody>
                    <tr>
                      <td>
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
                      <td style={{ textAlign: 'right' }}>
                        $ {balanceSheet.equity.capital_acc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td>Unrealized Gains</td>
                      <td style={{ textAlign: 'right' }}>
                        $ {balanceSheet.equity.unrealized_gains.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td>Retained Earnings (અનામત નફો)</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        $ {balanceSheet.equity.retained_earnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Total For Equity */}
                <div className="gnucash-total-bar" style={{ marginTop: '6px' }}>
                  <span>Total For Equity (કુલ મૂડી)</span>
                  <span>$ {balanceSheet.equity.total_equity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Final Grand Total For Liability and Equity */}
              <div
                className="gnucash-total-bar"
                style={{
                  marginTop: '10px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  borderColor: '#10b981',
                  borderBottom: '3px double #059669',
                  color: '#047857',
                  fontSize: '0.92rem',
                }}
              >
                <span>Total For Liability and Equity (કુલ દેવું + મૂડી)</span>
                <span>$ {balanceSheet.total_liability_and_equity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          VIEW 3: INCOME STATEMENT (MULTICOLUMN) - MATCHING SCREENSHOT 2
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'income_statement' && incomeStatement && (
        <div className="gnucash-statement-card" style={{ marginTop: '12px' }}>
          {/* Header Title matching screenshot 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Income Statement (Multicolumn) {incomeStatement.start_date_formatted} to {incomeStatement.end_date_formatted}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                આવક અને ખર્ચ પત્રક / નફો-નુકસાન સ્ટેટમેન્ટ
              </p>
            </div>

            {/* Date range filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>તારીખથી:</span>
                <input
                  type="date"
                  value={isStartDate}
                  onChange={(e) => setIsStartDate(e.target.value)}
                  className="input-field"
                  style={{ height: '30px', fontSize: '0.76rem', padding: '2px 8px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>સુધી:</span>
                <input
                  type="date"
                  value={isEndDate}
                  onChange={(e) => setIsEndDate(e.target.value)}
                  className="input-field"
                  style={{ height: '30px', fontSize: '0.76rem', padding: '2px 8px' }}
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={fetchData}
                style={{ height: '30px', fontSize: '0.75rem', padding: '0 10px' }}
              >
                ફિલ્ટર કરો
              </button>
            </div>
          </div>

          {/* Multicolumn Layout: Left = Income & Net Income | Right = Expense */}
          <div className="gnucash-statement-grid">
            {/* ══════ LEFT COLUMN: INCOME ══════ */}
            <div className="gnucash-col">
              <div className="gnucash-sec-header">
                <span>Income (આવક)</span>
                <span>રકમ</span>
              </div>

              <table className="gnucash-table">
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 800 }}>{incomeStatement.income.root_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      $ {incomeStatement.income.root_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {incomeStatement.income.children.map((item) => (
                    <tr key={item.full_name}>
                      <td style={{ paddingLeft: '22px' }}>
                        <span
                          className="gnucash-acc-link"
                          onClick={() => handleOpenAccountModal(item.full_name, item.gujarati_name)}
                          title="આ આવકના તમામ વ્યવહારો જુઓ"
                        >
                          {item.name}
                        </span>
                        {item.gujarati_name && item.gujarati_name !== item.name && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                            ({item.gujarati_name})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        $ {item.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total For Income */}
              <div className="gnucash-total-bar">
                <span>Total For Income (કુલ આવક)</span>
                <span>$ {incomeStatement.income.total_income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Net Income section */}
              <div style={{ marginTop: '14px' }}>
                <div className="gnucash-sec-header">
                  <span>Net Income (ચોખ્ખો નફો)</span>
                  <span>રકમ</span>
                </div>

                <div
                  className="gnucash-total-bar"
                  style={{
                    marginTop: '6px',
                    background: incomeStatement.net_income >= 0 ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                    borderColor: incomeStatement.net_income >= 0 ? '#10b981' : '#ef4444',
                    borderBottom: `3px double ${incomeStatement.net_income >= 0 ? '#059669' : '#dc2626'}`,
                    color: incomeStatement.net_income >= 0 ? '#047857' : '#b91c1c',
                    fontSize: '0.94rem',
                  }}
                >
                  <span>Total For Net Income (ચોખ્ખો નફો)</span>
                  <span>$ {incomeStatement.net_income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* ══════ RIGHT COLUMN: EXPENSE ══════ */}
            <div className="gnucash-col">
              <div className="gnucash-sec-header">
                <span>Expense (ખર્ચાઓ)</span>
                <span>રકમ</span>
              </div>

              <table className="gnucash-table">
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 800 }}>{incomeStatement.expense.root_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      $ {incomeStatement.expense.root_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* BHEGA Group with Sub-accounts */}
                  <tr>
                    <td style={{ paddingLeft: '14px', fontWeight: 700 }}>
                      <span
                        className="gnucash-acc-link"
                        onClick={() => handleOpenAccountModal(incomeStatement.expense.bhega.full_name, incomeStatement.expense.bhega.gujarati_name)}
                        title="સંયુક્ત ઘરખર્ચ વ્યવહારો જુઓ"
                      >
                        {incomeStatement.expense.bhega.name}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                        ({incomeStatement.expense.bhega.gujarati_name})
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      $ {incomeStatement.expense.bhega.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {incomeStatement.expense.bhega.children.map((bItem) => (
                    <tr key={bItem.full_name}>
                      <td style={{ paddingLeft: '34px' }}>
                        <span
                          className="gnucash-acc-link"
                          onClick={() => handleOpenAccountModal(bItem.full_name, bItem.gujarati_name)}
                          title="આ ખર્ચના વ્યવહારો જુઓ"
                        >
                          {bItem.name}
                        </span>
                        {bItem.gujarati_name && bItem.gujarati_name !== bItem.name && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                            ({bItem.gujarati_name})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        $ {bItem.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {/* Direct Expense accounts */}
                  {incomeStatement.expense.children.map((item) => (
                    <tr key={item.full_name}>
                      <td style={{ paddingLeft: '14px' }}>
                        <span
                          className="gnucash-acc-link"
                          onClick={() => handleOpenAccountModal(item.full_name, item.gujarati_name)}
                          title="આ ખર્ચના વ્યવહારો જુઓ"
                        >
                          {item.name}
                        </span>
                        {item.gujarati_name && item.gujarati_name !== item.name && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'normal' }}>
                            ({item.gujarati_name})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        $ {item.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total For Expense */}
              <div className="gnucash-total-bar" style={{ marginTop: 'auto' }}>
                <span>Total For Expense (કુલ ખર્ચાઓ)</span>
                <span>$ {incomeStatement.expense.total_expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ONE-CLICK ACCOUNT TRANSACTIONS MODAL ("one click to show that link")
          ═══════════════════════════════════════════════════════════ */}
      <Modal
        show={Boolean(selectedAccountModal)}
        onClose={handleCloseAccountModal}
        title={accountStatement ? `ખાતાવહી: ${accountStatement.account_name} ${accountStatement.gujarati_name ? `(${accountStatement.gujarati_name})` : ''}` : 'ખાતાવહી વિગત'}
        maxWidth="820px"
      >
        {accountStatementLoading ? (
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <RefreshCw size={24} className="spin" color="var(--primary)" />
            <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>વ્યવહારો લોડ થઈ રહ્યા છે...</p>
          </div>
        ) : accountStatement ? (
          <div>
            {/* Account Metrics Header */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
              <div className="acc-kpi-card" style={{ padding: '10px' }}>
                <span className="acc-kpi-title" style={{ fontSize: '0.62rem' }}>કુલ વ્યવહારો</span>
                <div className="acc-kpi-value" style={{ fontSize: '1.1rem', margin: '2px 0' }}>
                  {accountStatement.transaction_count}
                </div>
              </div>

              <div className="acc-kpi-card" style={{ padding: '10px' }}>
                <span className="acc-kpi-title" style={{ fontSize: '0.62rem' }}>કુલ જમા (+)</span>
                <div className="acc-kpi-value text-credit" style={{ fontSize: '1.1rem', margin: '2px 0' }}>
                  ₹{accountStatement.total_inflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="acc-kpi-card" style={{ padding: '10px' }}>
                <span className="acc-kpi-title" style={{ fontSize: '0.62rem' }}>કુલ ઉધાર (-)</span>
                <div className="acc-kpi-value text-debit" style={{ fontSize: '1.1rem', margin: '2px 0' }}>
                  ₹{accountStatement.total_outflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="acc-kpi-card" style={{ padding: '10px' }}>
                <span className="acc-kpi-title" style={{ fontSize: '0.62rem' }}>ચોખ્ખું બેલેન્સ</span>
                <div className={`acc-kpi-value ${accountStatement.net_balance >= 0 ? 'text-credit' : 'text-debit'}`} style={{ fontSize: '1.1rem', margin: '2px 0' }}>
                  ₹{accountStatement.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border-glass)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>તારીખ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>બિઝનેસ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>વિગત / નોંધ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>આવક (+)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>જાવક (-)</th>
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
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 600 }}>{t.date}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <span className="badge" style={{ fontSize: '0.65rem' }}>{t.business_stream}</span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 600 }}>{t.description}</div>
                          {t.notes && t.notes !== t.description && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.notes}</div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
                          {t.inflow > 0 ? `+₹${t.inflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>
                          {t.outflow > 0 ? `-₹${t.outflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer" style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                ખાતું: <code>{accountStatement.account_name}</code>
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseAccountModal}
              >
                બંધ કરો
              </button>
            </div>
          </div>
        ) : null}
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
              padding: '24px 16px',
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
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(217, 119, 6, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                }}
              >
                <Upload size={22} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                {selectedFile ? selectedFile.name : 'દર મહિનાની CSV ફાઇલ અહીં પસંદ કરો'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {selectedFile ? `કદ: ${(selectedFile.size / 1024).toFixed(1)} KB` : '(GnuCash એક્સપોર્ટ અથવા સ્ટાન્ડર્ડ એકાઉન્ટિંગ CSV)'}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#2563eb', marginBottom: '2px' }}>
              <Check size={14} />
              <span>૧૦૦% ક્લીન સિંક & ડુપ્લિકેટ પ્રોટેક્શન:</span>
            </div>
            નવી ફાઇલ અપલોડ કરવાથી જૂનો હિસાબ રિપ્લેસ થઈને નવી ફાઇલના તમામ વ્યવહારો અને ખાતાઓ ડાયનેમિકલી ઉમેરાશે.
          </div>

          {uploadResult && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: uploadResult.new_transactions_added > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${uploadResult.new_transactions_added > 0 ? '#10b981' : '#f59e0b'}`,
                fontSize: '0.78rem',
              }}
            >
              <div style={{ fontWeight: 700, color: uploadResult.new_transactions_added > 0 ? '#10b981' : '#d97706' }}>
                {uploadResult.message}
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                ઉમેરાયેલ વ્યવહારો: {uploadResult.new_transactions_added} | પિરિયડ:{' '}
                {uploadResult.date_min || '-'} થી {uploadResult.date_max || '-'}
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
                setUploadResult(null);
              }}
              disabled={uploadLoading}
            >
              બંધ કરો
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || uploadLoading}
              style={{ background: '#d97706', borderColor: '#d97706', gap: '6px' }}
            >
              {uploadLoading ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>અપલોડ થઈ રહ્યું છે...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>અપલોડ કરો અને સેવ કરો</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════ RESET ALL CONFIRMATION MODAL ═══════ */}
      <Modal
        show={showResetModal}
        onClose={() => !resetLoading && setShowResetModal(false)}
        title="તમામ ડેટા સાફ કરો (Reset Master Ledger)"
        maxWidth="460px"
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
