import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { businessApi } from '../api';
import type { Business, BusinessRecord, User } from '../api';
import { Plus, Trash2, Calendar, DollarSign, TrendingUp, Sparkles, PlusCircle, LayoutGrid, X } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function BusinessPage() {
  const { user } = useOutletContext<{ user: User }>();
  
  // Businesses list
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [records, setRecords] = useState<BusinessRecord[]>([]);

  // Create Business Form
  const [bizName, setBizName] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [showBizModal, setShowBizModal] = useState(false);

  // Add Monthly Record Form
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [cost, setCost] = useState('');
  const [revenue, setRevenue] = useState('');
  const [expenses, setExpenses] = useState(''); // core operating expense
  
  // Dynamic fields builder state
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load businesses list
  const loadBusinesses = async () => {
    try {
      const list = await businessApi.list();
      setBusinesses(list);
      if (list.length > 0 && !selectedBiz) {
        setSelectedBiz(list[0]);
      }
    } catch (err) {
      console.error(err);
      setError('Could not retrieve business registries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  // Load records when selected business changes
  useEffect(() => {
    if (!selectedBiz) return;
    const loadRecords = async () => {
      try {
        const list = await businessApi.listRecords(selectedBiz.id);
        setRecords(list);
      } catch (err) {
        console.error(err);
      }
    };
    loadRecords();
  }, [selectedBiz]);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim()) return;
    setError(null);
    setActionLoading(true);

    try {
      const newBiz = await businessApi.create(bizName.trim(), bizDesc.trim());
      setBusinesses((prev) => [...prev, newBiz]);
      setSelectedBiz(newBiz);
      setBizName('');
      setBizDesc('');
      setShowBizModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to register business entity.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBusiness = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this business registry? This deletes all associated monthly history logs.')) return;
    try {
      await businessApi.delete(id);
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      if (selectedBiz?.id === id) {
        setSelectedBiz(null);
        setRecords([]);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to remove business record.');
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim() || !newFieldValue.trim()) return;
    setCustomFields((prev) => [
      ...prev,
      { key: newFieldName.trim(), value: newFieldValue.trim() }
    ]);
    setNewFieldName('');
    setNewFieldValue('');
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
    setError(null);
    setActionLoading(true);

    try {
      const revVal = parseFloat(revenue) || 0;
      const costVal = parseFloat(cost) || 0;
      const expVal = parseFloat(expenses) || 0;

      // Pack dynamic custom fields
      const customDataObj: Record<string, any> = {};
      customFields.forEach(field => {
        // Parse numbers if possible, otherwise store as string
        const numVal = parseFloat(field.value);
        customDataObj[field.key] = isNaN(numVal) ? field.value : numVal;
      });

      const updatedRecord = await businessApi.saveRecord({
        business_id: selectedBiz.id,
        month,
        cost: costVal,
        revenue: revVal,
        expenses: expVal,
        custom_data: customDataObj
      });

      // Update local state: insert or replace
      setRecords((prev) => {
        const index = prev.findIndex((r) => r.month === month);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = updatedRecord;
          return updated;
        } else {
          return [updatedRecord, ...prev].sort((a, b) => b.month.localeCompare(a.month));
        }
      });

      // Clear record states
      setCost('');
      setRevenue('');
      setExpenses('');
      setCustomFields([]);
    } catch (err: any) {
      console.error(err);
      setError('Failed to log monthly balance record.');
    } finally {
      setActionLoading(false);
    }
  };

  // Profit/Loss Calculations
  const processedRecords = records.map((rec) => {
    const profit = rec.revenue - (rec.cost + rec.expenses);
    return {
      ...rec,
      profit,
      displayMonth: new Date(rec.month + "-02").toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    };
  });

  const totalRev = processedRecords.reduce((sum, item) => sum + item.revenue, 0);
  const totalCost = processedRecords.reduce((sum, item) => sum + item.cost + item.expenses, 0);
  const netProfit = totalRev - totalCost;

  if (loading) {
    return (
      <div style={styles.spinnerWrapper}>
        <div className="spinner" style={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Top Section / Add Business Card */}
      <div style={styles.topControls}>
        <h2 style={{ fontSize: '1.25rem' }}>Registered Family Businesses</h2>
        <button className="btn btn-primary" onClick={() => setShowBizModal(true)}>
          <Plus size={16} /> Add Business Entity
        </button>
      </div>

      {/* Grid of Business Cards */}
      <div className="layout-grid">
        {businesses.map((biz) => {
          const isSelected = selectedBiz?.id === biz.id;
          return (
            <div
              key={biz.id}
              className={`glass-card-interactive ${isSelected ? 'active-card' : ''}`}
              style={{
                ...styles.bizCard,
                borderColor: isSelected ? 'var(--primary)' : 'var(--border-glass)',
                background: isSelected ? 'var(--bg-glass-hover)' : 'var(--bg-glass-card)',
              }}
              onClick={() => setSelectedBiz(biz)}
            >
              <div style={styles.bizCardHeader}>
                <LayoutGrid size={24} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                {user?.role === 'admin' && (
                  <button
                    className="btn-icon"
                    onClick={(e) => handleDeleteBusiness(biz.id, e)}
                    style={{ marginLeft: 'auto', color: 'var(--error)' }}
                    title="Delete Registry"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <h3 style={{ marginTop: '12px', fontSize: '1.15rem' }}>{biz.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                {biz.description || 'No business description provided.'}
              </p>
            </div>
          );
        })}
        {businesses.length === 0 && (
          <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1' }}>No family businesses registered. Add one to start tracking ledger entries.</p>
        )}
      </div>

      {selectedBiz && (
        <div style={styles.detailsSection}>
          {/* Detail stats bar */}
          <div className="layout-grid">
            <div className="glass-card" style={styles.metricCard}>
              <span style={styles.metricLabel}>Total Revenue</span>
              <h3 style={styles.metricVal}>₹{totalRev.toLocaleString('en-IN')}</h3>
            </div>
            <div className="glass-card" style={styles.metricCard}>
              <span style={styles.metricLabel}>Total Costs & Expenses</span>
              <h3 style={{ ...styles.metricVal, color: '#f87171' }}>₹{totalCost.toLocaleString('en-IN')}</h3>
            </div>
            <div className="glass-card" style={styles.metricCard}>
              <span style={styles.metricLabel}>Net Cash Flow / Profit</span>
              <h3 style={{ ...styles.metricVal, color: netProfit >= 0 ? '#34d399' : '#f87171' }}>
                ₹{netProfit.toLocaleString('en-IN')}
              </h3>
            </div>
          </div>

          <div style={styles.mainGrid}>
            {/* Chart Area */}
            <div className="glass-card" style={styles.chartCard}>
              <h3 style={styles.cardTitle}>Earnings & Net Cashflow Summary</h3>
              {processedRecords.length === 0 ? (
                <div style={styles.noData}>
                  <TrendingUp size={48} color="var(--border-glass-active)" />
                  <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>No records logged yet. Add details to display performance trends.</p>
                </div>
              ) : (
                <div style={{ height: '300px', width: '100%', marginTop: '10px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...processedRecords].reverse()} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="displayMonth" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#121426', border: '1px solid var(--border-glass)', borderRadius: '8px' }} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke="var(--secondary)" fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                      <Area type="monotone" dataKey="profit" stroke="var(--primary)" fillOpacity={1} fill="url(#colorProfit)" name="Net Profit" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Record Form with Dynamic Fields */}
            <div className="glass-card" style={styles.formCard}>
              <h3 style={styles.cardTitle}>Log Monthly Financials</h3>
              <form onSubmit={handleAddRecord} style={styles.form}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Month</label>
                    <input
                      type="month"
                      className="input-field"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Revenue (INR)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="e.g. 100000"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Procurement Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="Material/Asset cost"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Operational Expense</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="Salaries/Utilities"
                      value={expenses}
                      onChange={(e) => setExpenses(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Dynamic Custom Row Fields Builder */}
                <div style={styles.customFieldBuilder}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                    Custom Ledger Fields
                  </label>
                  
                  {customFields.length > 0 && (
                    <div style={styles.customFieldsList}>
                      {customFields.map((f, i) => (
                        <div key={i} style={styles.fieldTag}>
                          <span><strong>{f.key}:</strong> {f.value}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(i)}
                            style={styles.removeFieldBtn}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={styles.builderInputRow}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Label (e.g. Worker Bonus)"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Amount/Value"
                      value={newFieldValue}
                      onChange={(e) => setNewFieldValue(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddCustomField}
                      style={{ padding: '8px 12px' }}
                    >
                      <PlusCircle size={16} />
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={actionLoading}>
                  {actionLoading ? 'Logging...' : 'Save Month Metrics'}
                </button>
              </form>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="glass-card" style={styles.tableCard}>
            <h3 style={styles.cardTitle}>Monthly Business Ledger - {selectedBiz.name}</h3>
            {processedRecords.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No recorded financial months yet.
              </p>
            ) : (
              <div style={styles.tableResponsive}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Month</th>
                      <th style={styles.th}>Revenue</th>
                      <th style={styles.th}>Procurement Cost</th>
                      <th style={styles.th}>Operational Expense</th>
                      <th style={styles.th}>Custom Metrics Details</th>
                      <th style={styles.th}>Net Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedRecords.map((rec) => (
                      <tr key={rec.id} style={styles.tr}>
                        <td style={{ ...styles.td, fontWeight: 700, color: 'var(--text-main)' }}>
                          {rec.month}
                        </td>
                        <td style={{ ...styles.td, color: 'var(--success)' }}>
                          ₹{rec.revenue.toLocaleString('en-IN')}
                        </td>
                        <td style={styles.td}>
                          ₹{rec.cost.toLocaleString('en-IN')}
                        </td>
                        <td style={styles.td}>
                          ₹{rec.expenses.toLocaleString('en-IN')}
                        </td>
                        <td style={styles.td}>
                          {Object.keys(rec.custom_data).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                          ) : (
                            <div style={styles.customGrid}>
                              {Object.entries(rec.custom_data).map(([k, v]) => (
                                <span key={k} style={styles.customFieldBadge}>
                                  <strong>{k}:</strong> {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ ...styles.td, fontWeight: 700, color: rec.profit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                          ₹{rec.profit.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Business Modal Overlay */}
      {showBizModal && (
        <div style={styles.modalBackdrop}>
          <div className="glass-card" style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3>Add Business Entity</h3>
              <button className="btn-icon" onClick={() => setShowBizModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateBusiness} style={styles.form}>
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Vraj Textiles"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="input-field"
                  placeholder="Summarize business niche, market, or assets..."
                  value={bizDesc}
                  onChange={(e) => setBizDesc(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBizModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Register Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  spinnerWrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: '80px 0',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid var(--border-glass)',
    borderTopColor: 'var(--primary)',
    animation: 'spin 1s linear infinite',
  },
  topControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bizCard: {
    padding: '24px',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  bizCardHeader: {
    display: 'flex',
    alignItems: 'center',
  },
  detailsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  metricCard: {
    padding: '20px',
  },
  metricLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  metricVal: {
    fontSize: '1.5rem',
    fontWeight: 800,
    marginTop: '6px',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  },
  chartCard: {
    padding: '30px',
  },
  cardTitle: {
    fontSize: '1.2rem',
    marginBottom: '20px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '10px',
  },
  noData: {
    height: '250px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    padding: '30px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  customFieldBuilder: {
    border: '1px solid var(--border-glass)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    marginBottom: '16px',
    background: 'rgba(255, 255, 255, 0.01)',
  },
  customFieldsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '12px',
  },
  fieldTag: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  removeFieldBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'inline-flex',
    padding: '2px',
  },
  builderInputRow: {
    display: 'flex',
    gap: '8px',
  },
  tableCard: {
    padding: '30px',
  },
  tableResponsive: {
    overflowX: 'auto',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-glass)',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  td: {
    padding: '16px',
    borderBottom: '1px solid var(--border-glass)',
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
  },
  tr: {
    transition: 'var(--transition-smooth)',
  },
  customGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  customFieldBadge: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-glass)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    width: 'fit-content',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '500px',
    padding: '30px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
  },
};
