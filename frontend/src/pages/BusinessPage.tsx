import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Briefcase, ChevronRight,
  LayoutGrid, TrendingUp, FileText,
  DollarSign, ArrowUpRight, ArrowDownRight, X
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { businessApi, authApi } from '../api';
import type { Business, BusinessRecord, User } from '../api';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';

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
  const [investments, setInvestments] = useState<any[]>([]);

  // Modal states
  const [showBizModal, setShowBizModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Business form
  const [bizName, setBizName] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [bizManagerId, setBizManagerId] = useState('');

  // Record form
  const [bizDate, setBizDate] = useState(new Date().toISOString().split('T')[0]);
  const [bizCost, setBizCost] = useState('');
  const [bizRevenue, setBizRevenue] = useState('');
  const [bizExpenses, setBizExpenses] = useState('');
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [globalCustomValues, setGlobalCustomValues] = useState<Record<string, string>>({});
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [newGlobalColumnName, setNewGlobalColumnName] = useState('');

  // Investment form
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
      try {
        const [list, invList] = await Promise.all([
          businessApi.getRecords(selectedBiz.id),
          businessApi.getInvestments(selectedBiz.id),
        ]);
        setRecords(list);
        setInvestments(invList);
      } catch (err) {
        console.error('Failed to load records', err);
      }
    };
    fetchRecords();
  }, [selectedBiz]);

  const selectBiz = (b: Business) => setSearchParams({ biz: b.id.toString() });
  const clearBiz = () => setSearchParams({});

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
      showToast('નવી કોલમ ઉમેરવામાં આવી!');
    } catch (err) {
      console.error(err);
      showToast('કોલમ ઉમેરવામાં ભૂલ આવી.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddBusinessRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
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
        custom_data: customDataObj,
      });

      setRecords(prev => {
        const index = prev.findIndex(r => r.date === bizDate);
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
      showToast('માસિક હિસાબ સફળતાપૂર્વક સંગ્રહિત થયો!');
    } catch (err: any) {
      console.error(err);
      showToast('માસિક પત્રક સાચવવામાં નિષ્ફળતા મળી.', 'error');
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
        person_name: invPersonName,
        date: invDate,
        amount: amtVal,
        type: invType,
      });

      setInvestments(prev => [newInv, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      setInvPersonName('');
      setInvAmount('');
      setShowInvModal(false);
      showToast('નોંધ સફળતાપૂર્વક ઉમેરવામાં આવી!');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'માહિતી સાચવવામાં નિષ્ફળતા મળી.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInvestment = async (id: number) => {
    if (!window.confirm('શું તમે ખરેખર આ નોંધ કાઢી નાખવા માંગો છો?')) return;
    try {
      await businessApi.deleteInvestment(id);
      setInvestments(investments.filter(i => i.id !== id));
      showToast('નોંધ કાઢી નાખવામાં આવી છે.');
    } catch (err) {
      console.error(err);
      showToast('નોંધ કાઢી નાખવામાં ભૂલ આવી છે.', 'error');
    }
  };

  // Calculations
  const processedRecords = records.map(rec => {
    const profit = rec.revenue - (rec.cost + rec.expenses);
    return {
      ...rec,
      profit,
      displayMonth: new Date(rec.date).toLocaleDateString('gu-IN', { day: 'numeric', month: 'short', year: '2-digit' }),
    };
  });

  const totalRev = processedRecords.reduce((sum, item) => sum + item.revenue, 0);
  const totalCost = processedRecords.reduce((sum, item) => sum + item.cost + item.expenses, 0);
  const netProfit = totalRev - totalCost;
  const totalInvested = investments.filter(i => i.type === 'INVESTMENT').reduce((sum: number, i: any) => sum + i.amount, 0);
  const totalWithdrawn = investments.filter(i => i.type === 'WITHDRAWAL').reduce((sum: number, i: any) => sum + i.amount, 0);

  const canManage = user?.role === 'admin' || selectedBiz?.manager_id === user?.id;

  // Use the latest selectedBiz from businesses array (for updated custom_columns)
  const currentBiz = selectedBiz ? businesses.find(b => b.id === selectedBiz.id) || selectedBiz : null;

  // ═══════ BUSINESS SELECTION ═══════
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
              <Plus size={16} /> નવો ધંધો
            </button>
          )}
        </div>

        <h2 className="section-title">નોંધાયેલા ધંધાઓ</h2>
        <p className="section-subtitle">હિસાબ જોવા ધંધાનું નામ પસંદ કરો.</p>

        {user?.role === 'admin' && isMobile && (
          <button className="fab" onClick={() => setShowBizModal(true)} aria-label="નવો ધંધો">
            <Plus size={24} />
          </button>
        )}

        <div className="layout-grid stagger-children" style={{ marginTop: '20px' }}>
          {businesses.map(biz => (
            <div
              key={biz.id}
              className="glass-card-interactive"
              style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '160px' }}
              onClick={() => selectBiz(biz)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && selectBiz(biz)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(96, 165, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LayoutGrid size={20} color="var(--secondary)" />
                  </div>
                  {(user?.role === 'admin' || biz.manager_id === user?.id) && (
                    <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={(e) => handleDeleteBusiness(biz.id, e)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <h3 style={{ fontSize: '1.1rem', marginTop: '12px' }}>{biz.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{biz.description || 'કોઈ વિગત નથી.'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>પત્રક ખોલો</span>
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
          {businesses.length === 0 && (
            <div className="glass-card" style={{ gridColumn: '1/-1' }}>
              <EmptyState icon={Briefcase} message="કોઈ ધંધો નોંધાયેલ નથી. નવો ધંધો ઉમેરો." />
            </div>
          )}
        </div>

        {/* Create Business Modal */}
        <Modal show={showBizModal} onClose={() => setShowBizModal(false)} title="નવો ધંધો રજીસ્ટર કરો" maxWidth="450px">
          <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="form-group">
              <label className="form-label">ધંધાનું નામ</label>
              <input type="text" className="input-field" placeholder="દા.ત. વ્રજ કાપડ ઉદ્યોગ" value={bizName} onChange={e => setBizName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">વિગત / વર્ણન</label>
              <textarea className="input-field" placeholder="ધંધો કયા પ્રકારનો છે..." value={bizDesc} onChange={e => setBizDesc(e.target.value)} style={{ minHeight: '70px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">સંચાલક</label>
              <select className="input-field" value={bizManagerId} onChange={e => setBizManagerId(e.target.value)}>
                <option value="">-- સંચાલક પસંદ કરો --</option>
                {allUsers.map(u => (<option key={u.id} value={u.id}>{u.username} ({u.role === 'admin' ? 'એડમિન' : 'સભ્ય'})</option>))}
              </select>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBizModal(false)}>રદ</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>રજીસ્ટર કરો</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ═══════ BUSINESS DETAIL ═══════
  return (
    <div className="animate-slide-up">
      <button className="back-navigation-btn" onClick={clearBiz}>
        <ArrowLeft size={16} />
        <span>ધંધાઓની યાદી</span>
      </button>

      {/* Entity Banner */}
      <div className="glass-card entity-banner" style={{ marginTop: '12px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', padding: isMobile ? '14px' : '16px 20px' }}>
        <div className="selection-avatar-badge" style={{ margin: 0, width: '44px', height: '44px', fontSize: '1.1rem', background: 'linear-gradient(135deg, var(--secondary), var(--accent))' }}>
          <Briefcase size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem' }}>{currentBiz.name} ખાતાવહી</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{currentBiz.description || 'ધંધાકીય હિસાબ સંચાલન'}</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '14px', marginTop: '16px' }}>
        <div className="glass-card metric-card">
          <span className="text-overline">કુલ આવક</span>
          <h3 className="text-metric text-success">₹{totalRev.toLocaleString('en-IN')}</h3>
        </div>
        <div className="glass-card metric-card">
          <span className="text-overline">કુલ ખર્ચ</span>
          <h3 className="text-metric text-error">₹{totalCost.toLocaleString('en-IN')}</h3>
        </div>
        <div className="glass-card metric-card" style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
          <span className="text-overline">ચોખ્ખો નફો</span>
          <h3 className={`text-metric ${netProfit >= 0 ? 'text-success' : 'text-error'}`}>₹{netProfit.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      {/* Investment Summary */}
      <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
        <h3 className="card-title" style={{ marginBottom: '12px' }}>રોકાણ અને ઉપાડ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
          <div className="invest-stat-card">
            <ArrowUpRight size={16} color="var(--success)" />
            <div>
              <span className="text-overline" style={{ fontSize: '0.7rem' }}>કુલ રોકાણ</span>
              <h4 className="text-metric-sm text-success">₹{totalInvested.toLocaleString('en-IN')}</h4>
            </div>
          </div>
          <div className="invest-stat-card">
            <ArrowDownRight size={16} color="var(--error)" />
            <div>
              <span className="text-overline" style={{ fontSize: '0.7rem' }}>કુલ ઉપાડ</span>
              <h4 className="text-metric-sm text-error">₹{totalWithdrawn.toLocaleString('en-IN')}</h4>
            </div>
          </div>
          <div className="invest-stat-card">
            <DollarSign size={16} color="var(--secondary)" />
            <div>
              <span className="text-overline" style={{ fontSize: '0.7rem' }}>બાકી</span>
              <h4 className="text-metric-sm text-secondary-color">₹{(totalInvested - totalWithdrawn).toLocaleString('en-IN')}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {canManage && (
        isMobile ? (
          <button className="fab" onClick={() => setShowRecordModal(true)} aria-label="માસિક વિગતો">
            <Plus size={24} />
          </button>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', gap: '10px' }}>
            <button className="btn btn-primary" onClick={() => setShowRecordModal(true)}>
              <Plus size={16} /> માસિક વિગતો
            </button>
          </div>
        )
      )}

      {/* Business Ledger Table */}
      <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="card-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>માસિક પત્રક</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddColumnModal(true)}>
            <Plus size={14} /> કોલમ
          </button>
        </div>
        {processedRecords.length === 0 ? (
          <EmptyState icon={FileText} message="કોઈ માસિક એન્ટ્રી નથી." />
        ) : (
          <div className="table-responsive">
            <table style={{ minWidth: isMobile ? '700px' : '100%' }}>
              <thead>
                <tr>
                  <th>તારીખ</th>
                  <th>વેચાણ આવક</th>
                  <th>માલ ખરીદી</th>
                  <th>સંચાલન ખર્ચ</th>
                  {currentBiz.custom_columns?.map((col: string) => (<th key={col}>{col}</th>))}
                  <th>અન્ય વિશિષ્ટ</th>
                  <th>નફો / નુકસાન</th>
                </tr>
              </thead>
              <tbody>
                {processedRecords.map(rec => (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {new Date(rec.date).toString() === 'Invalid Date' ? rec.date : new Date(rec.date).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ color: 'var(--success)' }}>₹{rec.revenue.toLocaleString('en-IN')}</td>
                    <td>₹{rec.cost.toLocaleString('en-IN')}</td>
                    <td>₹{rec.expenses.toLocaleString('en-IN')}</td>
                    {currentBiz.custom_columns?.map((col: string) => (
                      <td key={col}>
                        {rec.custom_data && rec.custom_data[col] !== undefined
                          ? (typeof rec.custom_data[col] === 'number' ? `₹${rec.custom_data[col].toLocaleString('en-IN')}` : rec.custom_data[col])
                          : '-'}
                      </td>
                    ))}
                    <td>
                      {(() => {
                        const otherData = { ...(rec.custom_data || {}) };
                        currentBiz.custom_columns?.forEach((col: string) => delete otherData[col]);
                        const keys = Object.keys(otherData);
                        if (keys.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {keys.map(k => (
                              <span key={k} className="custom-data-tag">
                                <strong>{k}:</strong> {otherData[k]}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ fontWeight: 700, color: rec.profit >= 0 ? 'var(--success)' : 'var(--error)' }}>
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
      <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 className="card-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>રોકાણ / ઉપાડ</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowInvModal(true)}>
            <Plus size={14} /> ઉમેરો
          </button>
        </div>
        {investments.length === 0 ? (
          <EmptyState icon={TrendingUp} message="કોઈ નોંધ નથી." />
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {investments.map((inv: any) => (
              <div key={inv.id} className="expense-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{inv.person_name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      {inv.type === 'INVESTMENT' ? (
                        <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>રોકાણ</span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>ઉપાડ</span>
                      )}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(inv.date).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: inv.type === 'INVESTMENT' ? 'var(--success)' : 'var(--error)', fontFamily: 'var(--font-heading)' }}>
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </span>
                    <button className="btn-icon" style={{ color: 'var(--error)', width: '28px', height: '28px' }} onClick={() => handleDeleteInvestment(inv.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>તારીખ</th>
                  <th>વ્યક્તિ</th>
                  <th>પ્રકાર</th>
                  <th>રકમ</th>
                  <th>કાર્ય</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv: any) => (
                  <tr key={inv.id}>
                    <td style={{ color: 'var(--text-main)' }}>{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{inv.person_name}</td>
                    <td>
                      {inv.type === 'INVESTMENT' ? (
                        <span className="badge badge-success">રોકાણ</span>
                      ) : (
                        <span className="badge badge-danger">ઉપાડ</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: inv.type === 'INVESTMENT' ? 'var(--success)' : 'var(--error)' }}>
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleDeleteInvestment(inv.id)}>
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

      {/* Performance Chart */}
      <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '14px' }}>
        <h3 className="card-title">આવક અને નફાકારકતા</h3>
        {processedRecords.length === 0 ? (
          <EmptyState icon={TrendingUp} message="પૂરતો ડેટા નથી." />
        ) : (
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[...processedRecords].reverse()} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfitBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
                <XAxis dataKey="displayMonth" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '8px', fontSize: '0.8rem' }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--success)" fillOpacity={1} fill="url(#colorRevBiz)" name="આવક" />
                <Area type="monotone" dataKey="profit" stroke="var(--primary)" fillOpacity={1} fill="url(#colorProfitBiz)" name="નફો" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ═══ MODALS ═══ */}
      
      {/* Add Record Modal */}
      <Modal show={showRecordModal && !!currentBiz} onClose={() => setShowRecordModal(false)} title={`માસિક વિગતો (${currentBiz.name})`} maxWidth="700px">
        <form onSubmit={handleAddBusinessRecord} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label className="form-label">તારીખ</label><input type="date" className="input-field" value={bizDate} onChange={e => setBizDate(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">કુલ આવક</label><input type="number" step="0.01" className="input-field" placeholder="આવક" value={bizRevenue} onChange={e => setBizRevenue(e.target.value)} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label className="form-label">માલ ખરીદી ખર્ચ</label><input type="number" step="0.01" className="input-field" placeholder="ખરીદી" value={bizCost} onChange={e => setBizCost(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">સંચાલન ખર્ચ</label><input type="number" step="0.01" className="input-field" placeholder="સંચાલન" value={bizExpenses} onChange={e => setBizExpenses(e.target.value)} required /></div>
          </div>
          {currentBiz.custom_columns && currentBiz.custom_columns.length > 0 && (
            <>
              <h4 style={{ margin: '12px 0 8px', fontSize: '0.85rem' }}>કોલમની વિગતો</h4>
              <div className="form-grid">
                {currentBiz.custom_columns.map((col: string) => (
                  <div className="form-group" key={col}>
                    <label className="form-label">{col}</label>
                    <input type="number" step="0.01" className="input-field" placeholder="રકમ" value={globalCustomValues[col] || ''} onChange={e => setGlobalCustomValues({ ...globalCustomValues, [col]: e.target.value })} />
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Custom Fields Builder */}
          <div style={{ border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '12px', marginTop: '8px', background: 'var(--bg-input)' }}>
            <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>વધારાની વિગતો</label>
            {customFields.length > 0 && (
              <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {customFields.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                    <span><strong>{f.key}:</strong> {f.value}</span>
                    <button type="button" onClick={() => handleRemoveCustomField(i)} className="btn-icon" style={{ color: 'var(--error)', width: '24px', height: '24px' }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="text" className="input-field" placeholder="નામ" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: '0.8rem' }} />
              <input type="number" step="0.01" className="input-field" placeholder="રકમ" value={newFieldValue} onChange={e => setNewFieldValue(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: '0.8rem' }} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCustomField}><Plus size={14} /></button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowRecordModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>સાચવો</button>
          </div>
        </form>
      </Modal>

      {/* Add Investment Modal */}
      <Modal show={showInvModal && !!currentBiz} onClose={() => setShowInvModal(false)} title="રોકાણ / ઉપાડ" maxWidth="480px">
        <form onSubmit={handleAddInvestment} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">વ્યક્તિનું નામ</label>
            <input type="text" className="input-field" placeholder="નામ" value={invPersonName} onChange={e => setInvPersonName(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">પ્રકાર</label>
              <select className="input-field" value={invType} onChange={e => setInvType(e.target.value as "INVESTMENT" | "WITHDRAWAL")} required>
                <option value="INVESTMENT">રોકાણ (Invested)</option>
                <option value="WITHDRAWAL">ઉપાડ (Get back)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">તારીખ</label>
              <input type="date" className="input-field" value={invDate} onChange={e => setInvDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">રકમ</label>
            <input type="number" step="0.01" className="input-field" placeholder="રકમ" value={invAmount} onChange={e => setInvAmount(e.target.value)} required />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowInvModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>સાચવો</button>
          </div>
        </form>
      </Modal>

      {/* Add Column Modal */}
      <Modal show={showAddColumnModal && !!currentBiz} onClose={() => setShowAddColumnModal(false)} title="નવી કોલમ" maxWidth="400px">
        <form onSubmit={handleAddGlobalColumn} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">કોલમનું નામ</label>
            <input type="text" className="input-field" placeholder="દા.ત. Diamond Duty" value={newGlobalColumnName} onChange={e => setNewGlobalColumnName(e.target.value)} required />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddColumnModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>ઉમેરો</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
