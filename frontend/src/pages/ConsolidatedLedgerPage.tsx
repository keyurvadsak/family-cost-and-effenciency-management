import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Upload, Printer, Search, Filter,
  BookOpen, ChevronDown, ChevronUp, ChevronRight,
  FileText, RefreshCw, Trash2, Building, ArrowRight,
  FolderOpen, Folder, CornerDownRight, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { consolidatedApi } from '../api';
import type {
  ConsolidatedTransaction,
  ConsolidatedSummary,
  ConsolidatedUploadResponse,
  AccountTreeNode
} from '../api';
import Modal from '../components/ui/Modal';
import LoadingScreen from '../components/ui/LoadingScreen';
import EmptyState from '../components/ui/EmptyState';

export default function ConsolidatedLedgerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // Dynamic URL state persistence (clickable URL support)
  const initialAccount = searchParams.get('account') || 'all';
  const initialView = (searchParams.get('view') as 'tree' | 'simple' | 'pro') || (searchParams.get('account') ? 'simple' : 'tree');

  // View Mode: 'tree' (Accounts Tree Hierarchy) vs 'simple' (Register) vs 'pro' (Double Entry Splits)
  const [viewMode, setViewMode] = useState<'tree' | 'simple' | 'pro'>(initialView);

  // Data states
  const [transactions, setTransactions] = useState<ConsolidatedTransaction[]>([]);
  const [summary, setSummary] = useState<ConsolidatedSummary | null>(null);
  const [accountsTree, setAccountsTree] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Expanded nodes in tree view (Open/Close state)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'ASSETS': true,
    'EXPENSES': true,
    'EXPENSES:BHEGA': true,
    'INCOME': true,
    'LIABILITIES': true,
  });

  // Selected account for highlighting in tree (GnuCash style blue selection)
  const [selectedTreeAccount, setSelectedTreeAccount] = useState<string>(
    initialAccount !== 'all' ? initialAccount : 'EXPENSES:Insuranse'
  );

  // Filters: FY, Month, Same nu Khatu (સામેનું ખાતું), Flow Type (આવક/ખર્ચ)
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>(initialAccount);
  const [selectedFlow, setSelectedFlow] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(!isMobile);

  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ConsolidatedUploadResponse | null>(null);

  // Reset Confirmation Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Dynamic Color helper for Business Stream badge
  const getStreamBadgeStyle = (stream: string) => {
    if (!stream) return { bg: 'rgba(107, 114, 128, 0.12)', color: 'var(--text-secondary)', border: 'rgba(107, 114, 128, 0.25)' };
    const s = stream.toLowerCase();
    if (s.includes('લૂમ્સ') || s.includes('looms')) {
      return { bg: 'rgba(6, 182, 212, 0.14)', color: '#0891b2', border: 'rgba(6, 182, 212, 0.35)' };
    }
    if (s.includes('પ્રિશા') || s.includes('embro') || s.includes('એમ્બ્રોઈડરી')) {
      return { bg: 'rgba(168, 85, 247, 0.14)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.35)' };
    }
    if (s.includes('કેયુર') || s.includes('હીરા') || s.includes('diamond')) {
      return { bg: 'rgba(245, 158, 11, 0.14)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)' };
    }
    if (s.includes('m.j') || s.includes('j.t')) {
      return { bg: 'rgba(59, 130, 246, 0.14)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.35)' };
    }
    if (s.includes('ઘરખર્ચ') || s.includes('expense')) {
      return { bg: 'rgba(239, 68, 68, 0.14)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.35)' };
    }
    if (s.includes('લોન') || s.includes('ઉછીના') || s.includes('liabilit')) {
      return { bg: 'rgba(249, 115, 22, 0.14)', color: '#ea580c', border: 'rgba(249, 115, 22, 0.35)' };
    }
    if (s.includes('મૂડી') || s.includes('રોકાણ') || s.includes('capital') || s.includes('asset')) {
      return { bg: 'rgba(16, 185, 129, 0.14)', color: '#059669', border: 'rgba(16, 185, 129, 0.35)' };
    }
    // Dynamic color from hash for any other stream
    let hash = 0;
    for (let i = 0; i < stream.length; i++) hash = stream.charCodeAt(i) + ((hash << 5) - hash);
    const hues = [210, 280, 160, 30, 340, 190];
    const hue = hues[Math.abs(hash) % hues.length];
    return {
      bg: `hsla(${hue}, 70%, 50%, 0.14)`,
      color: `hsl(${hue}, 80%, 40%)`,
      border: `hsla(${hue}, 70%, 50%, 0.35)`
    };
  };

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

  // Toggle tree node expansion (CLOSE AND OPEN ONLY — NO NAVIGATION)
  const toggleNode = (nodeFullName: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
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

  // Fetch summary, accounts tree, and transactions
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

      const [txList, sumData, treeData] = await Promise.all([
        consolidatedApi.getTransactions(filterParams),
        consolidatedApi.getSummary(filterParams),
        consolidatedApi.getAccountsTree(),
      ]);

      setTransactions(txList);
      setSummary(sumData);
      setAccountsTree(treeData);
    } catch (err: any) {
      console.error('Failed to fetch consolidated ledger data', err);
      showToast('ડેટા લોડ કરવામાં ક્ષતિ આવી. કૃપા કરીને પુનઃ પ્રયાસ કરો.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load More 15 transactions
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

  // Sync URL search params with state (browser back/forward, direct clickable URLs)
  useEffect(() => {
    const urlAccount = searchParams.get('account') || 'all';
    const urlView = (searchParams.get('view') as 'tree' | 'simple' | 'pro') || (urlAccount !== 'all' ? 'simple' : 'tree');
    if (urlAccount !== selectedAccount) {
      setSelectedAccount(urlAccount);
      setSelectedTreeAccount(urlAccount !== 'all' ? urlAccount : '');
    }
    if (urlView !== viewMode) {
      setViewMode(urlView);
    }
  }, [searchParams]);

  // Explicit action: Open Register for this account (Clickable URL Navigation)
  const handleOpenAccountTransactions = (nodeFullName: string, nodeName: string) => {
    setSelectedTreeAccount(nodeFullName);
    setSelectedAccount(nodeFullName);
    setViewMode('simple');
    setSearchParams({ view: 'simple', account: nodeFullName });
    showToast(`ખાતું પસંદ થયું: ${nodeName}`, 'info');
  };

  // Clear account filter
  const handleClearAccountFilter = () => {
    setSelectedAccount('all');
    setSelectedTreeAccount('');
    setSearchParams({ view: viewMode });
  };

  // Handle CSV file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  // Upload CSV handler (Clean sync/replace)
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

  // Month formatter helper
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

  // 100% Dynamic available accounts from summary
  const availableAccounts = useMemo(() => {
    if (summary?.available_accounts && summary.available_accounts.length > 0) {
      return summary.available_accounts;
    }
    // Fallback purely dynamic from transactions or tree
    const fromTxs = transactions.map((t) => t.primary_account).filter(Boolean);
    const fromTree: string[] = [];
    const collectNames = (nodes: AccountTreeNode[]) => {
      for (const n of nodes) {
        fromTree.push(n.full_name);
        if (n.children) collectNames(n.children);
      }
    };
    collectNames(accountsTree);
    return Array.from(new Set([...fromTxs, ...fromTree])).sort();
  }, [summary?.available_accounts, transactions, accountsTree]);

  // Recursive Tree Node Renderer for GnuCash UI
  const renderTreeNode = (node: AccountTreeNode, depth = 0) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = Boolean(expandedNodes[node.full_name]);
    const isSelected = selectedTreeAccount === node.full_name || selectedAccount === node.full_name;
    const typeStyle = getTypeBadgeStyle(node.type);

    // Row Click Behavior:
    // If has children -> Toggles CLOSE/OPEN (does NOT navigate away!)
    // If leaf node -> Selects row (does NOT navigate away unless explicit button clicked)
    const handleRowClick = () => {
      setSelectedTreeAccount(node.full_name);
      if (hasChildren) {
        toggleNode(node.full_name);
      }
    };

    return (
      <React.Fragment key={node.full_name}>
        <tr
          onClick={handleRowClick}
          onDoubleClick={() => handleOpenAccountTransactions(node.full_name, node.name)}
          style={{
            cursor: 'pointer',
            background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
            borderBottom: '1px solid var(--border-glass)',
            transition: 'background 0.15s ease',
            color: isSelected ? 'var(--primary)' : 'inherit',
          }}
          className={`gnucash-tree-row ${isSelected ? 'row-selected' : ''}`}
        >
          {/* Account Name & Expand Chevron */}
          <td style={{ padding: '8px 12px', paddingLeft: `${depth * 22 + 12}px`, whiteSpace: 'nowrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {/* Dropdown Chevron: Clicking it CLOSES AND OPENS the branch */}
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
                    transition: 'all 0.15s ease',
                  }}
                  title={isExpanded ? 'ડ્રોપડાઉન બંધ કરો (Collapse)' : 'ડ્રોપડાઉન ખોલો (Expand)'}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span style={{ width: '20px', display: 'inline-block', textAlign: 'center' }}>
                  <CornerDownRight size={12} color="var(--text-muted)" />
                </span>
              )}

              {/* Folder or Building Icon */}
              {hasChildren ? (
                isExpanded ? (
                  <FolderOpen size={16} color="#d97706" style={{ flexShrink: 0 }} />
                ) : (
                  <Folder size={16} color="#d97706" style={{ flexShrink: 0 }} />
                )
              ) : (
                <Building size={15} color={isSelected ? 'var(--primary)' : 'var(--text-secondary)'} style={{ flexShrink: 0 }} />
              )}

              <div>
                <span style={{ fontWeight: hasChildren ? 800 : 600, fontSize: '0.84rem' }}>
                  {node.name}
                </span>
                {node.gujarati_name && node.gujarati_name !== node.name && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
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

          {/* Explicit Action: Open Register for this account */}
          <td style={{ padding: '8px 12px', textAlign: 'center', width: '130px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAccountTransactions(node.full_name, node.name);
              }}
              style={{
                padding: '4px 10px',
                fontSize: '0.72rem',
                gap: '5px',
                background: isSelected ? 'var(--primary)' : 'rgba(37, 99, 235, 0.08)',
                color: isSelected ? '#ffffff' : 'var(--primary)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
              }}
              title="માત્ર આ ખાતાના તમામ વ્યવહારો / ખર્ચાઓ જુઓ"
            >
              <span>વ્યવહારો જુઓ</span>
              <ArrowRight size={12} />
            </button>
          </td>
        </tr>

        {/* Recursive Children (Rendered when expanded) */}
        {hasChildren && isExpanded && node.children.map((child) => renderTreeNode(child, depth + 1))}
      </React.Fragment>
    );
  };

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

      {/* ═══════ HIGH-DENSITY EXECUTIVE KPIS ═══════ */}
      <div className="acc-kpi-grid mix-kpi-grid" style={{ marginTop: '12px' }}>
        {/* KPI 1: Net Cash Balance */}
        <div className="glass-card kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="kpi-label">રોકડ સિલક (Cash Balance)</span>
              <h3 className="kpi-value" style={{ color: (summary?.net_cash_balance || 0) < 0 ? 'var(--error)' : '#10b981' }}>
                {(summary?.net_cash_balance || 0) < 0 ? `-₹${Math.abs(summary?.net_cash_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `₹${(summary?.net_cash_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </h3>
              <p className="kpi-meta">હાથ પર રોકડ / કેશબોક્સ</p>
            </div>
            <span className="badge badge-success">CASHBOOK</span>
          </div>
        </div>

        {/* KPI 2: Period Total Inflow */}
        <div className="glass-card kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="kpi-label">કુલ રોકડ આવક (Period Inflow)</span>
              <h3 className="kpi-value" style={{ color: '#3b82f6' }}>
                ₹{(summary?.period_inflow || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="kpi-meta">પસંદ કરેલ ફિલ્ટરમાં કુલ જમા</p>
            </div>
            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>આવક (+)</span>
          </div>
        </div>

        {/* KPI 3: Period Total Outflow */}
        <div className="glass-card kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="kpi-label">કુલ રોકડ ખર્ચ (Period Outflow)</span>
              <h3 className="kpi-value" style={{ color: '#ef4444' }}>
                ₹{(summary?.period_outflow || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="kpi-meta">પસંદ કરેલ ફિલ્ટરમાં કુલ ઉધાર</p>
            </div>
            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>ખર્ચ (-)</span>
          </div>
        </div>

        {/* KPI 4: Net Flow Change */}
        <div className="glass-card kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="kpi-label">ચોખ્ખો પ્રવાહ (Net Flow)</span>
              <h3 className="kpi-value" style={{ color: (summary?.net_change || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                {(summary?.net_change || 0) < 0 ? `-₹${Math.abs(summary?.net_change || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `+₹${(summary?.net_change || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </h3>
              <p className="kpi-meta">આવક - ખર્ચ તફાવત</p>
            </div>
            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>ચોખ્ખી અસર</span>
          </div>
        </div>
      </div>

      {/* ═══════ MULTI-VIEW TOGGLE TABS (TREE vs REGISTER vs CA) ═══════ */}
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
        {/* Navigation Tabs */}
        <div style={{ display: 'inline-flex', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', padding: '3px', border: '1px solid var(--border-glass)' }}>
          <button
            type="button"
            onClick={() => {
              setViewMode('tree');
              setSearchParams({ view: 'tree' });
            }}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
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
            <Building size={14} />
            <span>🏛️ એકાઉન્ટ્સ વૃક્ષ (Chart of Accounts)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('simple');
              setSearchParams({ view: 'simple', ...(selectedAccount !== 'all' ? { account: selectedAccount } : {}) });
            }}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: viewMode === 'simple' ? 800 : 500,
              background: viewMode === 'simple' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'simple' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: '0.15s ease',
            }}
          >
            <FileText size={14} />
            <span>📋 સરળ કેશબુક (Register)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('pro');
              setSearchParams({ view: 'pro' });
            }}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: viewMode === 'pro' ? 800 : 500,
              background: viewMode === 'pro' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'pro' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: '0.15s ease',
            }}
          >
            <BookOpen size={14} />
            <span>⚖️ ખાતાવહી (CA Splits)</span>
          </button>
        </div>

        {/* Selected Account Indicator Banner */}
        {selectedAccount !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>પસંદ કરેલ ખાતું:</span>
            <span className="badge badge-primary" style={{ fontSize: '0.74rem', padding: '4px 10px' }}>
              {selectedAccount}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearAccountFilter}
              style={{ fontSize: '0.7rem', padding: '2px 8px', height: '26px' }}
              title="તમામ ખાતાઓ જુઓ"
            >
              ✕ સાફ કરો
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          VIEW 1: GNUCASH-STYLE CHART OF ACCOUNTS TREE
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' ? (
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

            {/* Quick Expand / Collapse All Controls */}
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
      ) : (
        /* ═══════════════════════════════════════════════════════════
            VIEW 2 & 3: REGISTER (સરળ કેશબુક) / CA SPLITS
            ═══════════════════════════════════════════════════════════ */
        <>
          {/* Breadcrumb banner if filtered by an account */}
          {selectedAccount !== 'all' && (
            <div
              className="glass-card"
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setViewMode('tree');
                    setSearchParams({ view: 'tree' });
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', height: '26px' }}
                >
                  <ArrowLeft size={13} />
                  <span>એકાઉન્ટ્સ વૃક્ષ પર પાછા જાઓ</span>
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  ખાતું: <strong style={{ color: 'var(--primary)' }}>{selectedAccount}</strong>
                </span>
                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                  {summary?.total_count || transactions.length} વ્યવહારો મળ્યા
                </span>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearAccountFilter}
                style={{ fontSize: '0.72rem', padding: '3px 10px', height: '26px' }}
              >
                ✕ તમામ ખાતાઓ
              </button>
            </div>
          )}

          {/* ═══════ SEARCH & COLLAPSIBLE FILTERS ═══════ */}
          <div className="glass-card" style={{ marginTop: '12px', padding: '12px 16px' }}>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

                {/* 3. SAME NU KHATU (સામેનું ખાતું ફિલ્ટર) - 100% Dynamic */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '3px', fontWeight: 700, color: 'var(--primary)' }}>
                    📋 સામેનું ખાતું (Account)
                  </label>
                  <select
                    className="input-field mix-filter-select"
                    value={selectedAccount}
                    onChange={(e) => {
                      setSelectedAccount(e.target.value);
                    }}
                    style={{ fontWeight: selectedAccount !== 'all' ? 700 : 500 }}
                  >
                    <option value="all">તમામ સામેના ખાતાઓ</option>
                    {availableAccounts.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
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
                  {viewMode === 'simple' ? 'સરળ રોકડ ખાતાવહી (Cashbook Entries)' : 'દ્વિ-નોંધી ખાતાવહી (Double Entry Splits)'}
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                  દર્શાવેલ: {transactions.length} / {summary?.total_count || 0}
                </span>
                {selectedAccount !== 'all' && (
                  <span className="badge" style={{ fontSize: '0.65rem', background: '#d97706', color: '#fff' }}>
                    ખાતું: {selectedAccount}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={fetchData}
                  disabled={refreshing}
                  title="ડેટા રીફ્રેશ કરો"
                >
                  <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
                </button>
              </div>
            </div>

            {transactions.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                message="કોઈ વ્યવહાર મળ્યા નથી. પસંદ કરેલ ફિલ્ટરમાં કોઈ ડેટા નથી અથવા હજુ સુધી કોઈ CSV ફાઇલ અપલોડ થયેલ નથી."
              />
            ) : viewMode === 'simple' ? (
              /* ═══════ REGISTER VIEW: SIMPLE CASHBOOK ═══════ */
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-glass)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>તારીખ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>બિઝનેસ પ્રવાહ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>વિગત / નોંધ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>સામેનું ખાતું</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>આવક (+)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>જાવક (-)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const streamStyle = getStreamBadgeStyle(tx.business_stream);
                      const isExpanded = expandedTxId === tx.id;
                      return (
                        <React.Fragment key={tx.id}>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border-glass)',
                              transition: 'background 0.15s ease',
                              cursor: (tx.splits?.length > 2) ? 'pointer' : 'default',
                            }}
                            onClick={() => (tx.splits?.length > 2) && setExpandedTxId(isExpanded ? null : tx.id)}
                          >
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.82rem' }}>
                              {tx.date}
                            </td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  background: streamStyle.bg,
                                  color: streamStyle.color,
                                  border: `1px solid ${streamStyle.border}`,
                                }}
                              >
                                {tx.business_stream || 'સામાન્ય'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{tx.description}</span>
                                {(tx.splits?.length > 2) && (
                                  <span className="badge" style={{ fontSize: '0.62rem', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
                                    {tx.splits?.length} સ્પ્લિટ્સ
                                  </span>
                                )}
                              </div>
                              {tx.notes && tx.notes !== tx.description && (
                                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{tx.notes}</p>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.8rem' }}>
                              <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.76rem', color: 'var(--text-main)' }}>
                                {tx.primary_account}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: '#10b981', whiteSpace: 'nowrap' }}>
                              {tx.inflow > 0 ? `+₹${tx.inflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: '#ef4444', whiteSpace: 'nowrap' }}>
                              {tx.outflow > 0 ? `-₹${tx.outflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {user?.role === 'admin' && (
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
                              )}
                            </td>
                          </tr>

                          {/* Expanded multi-split drilldown */}
                          {isExpanded && tx.splits && (
                            <tr style={{ background: 'var(--bg-surface-elevated)' }}>
                              <td colSpan={7} style={{ padding: '10px 18px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', color: 'var(--primary)' }}>
                                  આ વ્યવહારના તમામ ખાતાઓ (Splits Breakdown):
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                                  {tx.splits.map((s) => (
                                    <div
                                      key={s.id}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-glass)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.74rem' }}>{s.account_name}</div>
                                        {s.memo && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{s.memo}</div>}
                                      </div>
                                      <div style={{ fontWeight: 700, fontSize: '0.8rem', color: s.amount >= 0 ? '#10b981' : '#ef4444' }}>
                                        {s.amount >= 0 ? `+₹${s.amount.toLocaleString('en-IN')}` : `-₹${Math.abs(s.amount).toLocaleString('en-IN')}`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ═══════ CA PRO VIEW: DOUBLE ENTRY SPLITS ═══════ */
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-glass)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>તારીખ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>વિગત / વ્યવહાર ID</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)' }}>ખાતાવહી સ્પ્લિટ્સ (Double Entry Splits)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)', width: '130px' }}>ઉધાર (Debit)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-muted)', width: '130px' }}>જમા (Credit)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-glass)', verticalAlign: 'top' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.82rem' }}>
                          {tx.date}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{tx.description}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ID: {tx.tx_guid || tx.id}
                          </div>
                        </td>
                        <td style={{ padding: '6px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {tx.splits && tx.splits.length > 0 ? (
                              tx.splits.map((s) => (
                                <div
                                  key={s.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    background: 'var(--bg-surface-elevated)',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.account_name}</span>
                                  <span style={{ fontWeight: 700, color: s.amount >= 0 ? '#10b981' : '#ef4444' }}>
                                    {s.amount >= 0 ? `+₹${s.amount.toLocaleString('en-IN')}` : `-₹${Math.abs(s.amount).toLocaleString('en-IN')}`}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {tx.primary_account}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: '#10b981' }}>
                          {tx.inflow > 0 ? `₹${tx.inflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: '#ef4444' }}>
                          {tx.outflow > 0 ? `₹${tx.outflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ═══════ LOAD MORE BUTTON (15 RECORDS PAGINATION) ═══════ */}
            {summary && transactions.length < summary.total_count && (
              <div style={{ padding: '14px', textAlign: 'center', background: 'var(--bg-surface-elevated)', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '8px 24px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    gap: '8px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>વધુ વ્યવહારો લોડ થઈ રહ્યા છે...</span>
                    </>
                  ) : (
                    <>
                      <span>વધુ વ્યવહારો જુઓ (આગળના 15)</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  કુલ {summary.total_count} માંથી {transactions.length} વ્યવહારો દર્શાવેલ છે
                </div>
              </div>
            )}
          </div>
        </>
      )}

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

          {/* Clean Sync Info */}
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

          {/* Upload Result Alert */}
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
