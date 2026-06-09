import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { familyApi, expenseApi } from '../api';
import type { FamilyMember, FamilyExpense, User } from '../api';
import { Plus, Trash2, Calendar, FileText, IndianRupee, Sparkles, PieChart as PieIcon, ListFilter } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';

const CATEGORIES = ['Groceries', 'Bills', 'Education', 'Medical', 'Investments', 'Leisure', 'Other'];
const COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#9ca3af'];

export default function HomeExpensesPage() {
  const { user } = useOutletContext<{ user: User }>();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activeMember, setActiveMember] = useState<FamilyMember | null>(null);
  const [expenses, setExpenses] = useState<FamilyExpense[]>([]);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load family members initially
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const list = await familyApi.list();
        setMembers(list);
        if (list.length > 0) {
          setActiveMember(list[0]);
        }
      } catch (err) {
        console.error('Failed to load family members', err);
        setError('Could not retrieve family heads. Ensure backend is running.');
      } finally {
        setLoading(false);
      }
    };
    loadMembers();
  }, []);

  // Load expenses when active member changes
  useEffect(() => {
    if (!activeMember) return;
    const loadExpenses = async () => {
      try {
        const list = await expenseApi.listByMember(activeMember.id);
        setExpenses(list);
      } catch (err) {
        console.error('Failed to load expenses', err);
      }
    };
    loadExpenses();
  }, [activeMember]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;
    setError(null);
    setActionLoading(true);

    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Please enter a valid amount greater than zero.');
      }

      const newExpense = await expenseApi.create({
        family_member_id: activeMember.id,
        amount: parsedAmount,
        category,
        description: description || undefined,
        date,
      });

      setExpenses((prev) => [newExpense, ...prev]);
      
      // Reset form
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to record expense. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await expenseApi.delete(id);
      setExpenses((prev) => prev.filter((exp) => exp.id !== id));
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to delete expense log.');
    }
  };

  // Calculations
  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const avgExpense = expenses.length > 0 ? (totalSpent / expenses.length) : 0;
  
  // Group by category for charts
  const categoryDataMap = expenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.keys(categoryDataMap).map((cat) => ({
    name: cat,
    value: categoryDataMap[cat],
  }));

  // Group by month/date for bar chart (last 5 records or dates)
  const barChartData = expenses
    .slice(0, 8)
    .reverse()
    .map((item) => ({
      date: new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      amount: item.amount,
      category: item.category,
    }));

  if (loading) {
    return (
      <div style={styles.spinnerWrapper}>
        <div className="spinner" style={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Top Welcome Banner */}
      <div className="glass-card" style={styles.welcomeBanner}>
        <div style={styles.bannerText}>
          <Sparkles size={24} color="#8b5cf6" />
          <h2 style={{ fontSize: '1.4rem' }}>Family Share Allocation Ledger</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Monitor allocations, track spending usage, and manage household budgets efficiently.
          </p>
        </div>
      </div>

      {/* Tabs list for family members */}
      <div className="tab-container" style={{ overflowX: 'auto' }}>
        {members.map((m) => (
          <button
            key={m.id}
            className={`tab-btn ${activeMember?.id === m.id ? 'active' : ''}`}
            onClick={() => setActiveMember(m)}
          >
            {m.name}
          </button>
        ))}
        {members.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>No family heads added. Go to Admin Dashboard to register family heads.</p>
        )}
      </div>

      {activeMember && (
        <>
          {/* Key Metrics Row */}
          <div className="layout-grid">
            <div className="glass-card" style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <span style={styles.metricLabel}>Total Spent</span>
                <IndianRupee size={20} color="#10b981" />
              </div>
              <h3 style={styles.metricVal}>₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Accumulated expenses logged
              </p>
            </div>

            <div className="glass-card" style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <span style={styles.metricLabel}>Logs Count</span>
                <ListFilter size={20} color="#06b6d4" />
              </div>
              <h3 style={styles.metricVal}>{expenses.length} Entries</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Total transaction items recorded
              </p>
            </div>

            <div className="glass-card" style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <span style={styles.metricLabel}>Average Expense</span>
                <Sparkles size={20} color="#8b5cf6" />
              </div>
              <h3 style={styles.metricVal}>₹{avgExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Average cost per entry log
              </p>
            </div>
          </div>

          {/* Form and Charts */}
          <div style={styles.mainGrid}>
            {/* Record Expense Form */}
            <div className="glass-card" style={styles.formCard}>
              <h3 style={styles.cardTitle}>Log Family Expense</h3>
              {error && (
                <div style={styles.alertError}>
                  <span>{error}</span>
                </div>
              )}
              <form onSubmit={handleAddExpense} style={styles.form}>
                <div className="form-group">
                  <label className="form-label">Amount (INR)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <IndianRupee size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="e.g. 5000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{ width: '100%', paddingLeft: '36px' }}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="input-field"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Remarks</label>
                  <textarea
                    className="input-field"
                    placeholder="Describe transaction details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                >
                  <Plus size={16} />
                  {actionLoading ? 'Logging...' : 'Add Expense Record'}
                </button>
              </form>
            </div>

            {/* Visual Analytics */}
            <div className="glass-card" style={styles.analyticsCard}>
              <h3 style={styles.cardTitle}>Category Allocation</h3>
              {expenses.length === 0 ? (
                <div style={styles.noData}>
                  <PieIcon size={48} color="var(--border-glass-active)" />
                  <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>No expense data logged to display charts</p>
                </div>
              ) : (
                <div style={styles.chartsWrapper}>
                  {/* Donut Chart */}
                  <div style={styles.chartBox}>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ background: '#121426', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div style={styles.legendGrid}>
                      {pieChartData.map((item, index) => (
                        <div key={item.name} style={styles.legendItem}>
                          <span style={{ ...styles.legendDot, background: COLORS[index % COLORS.length] }}></span>
                          <span style={styles.legendText}>{item.name} (₹{item.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Ledger Table */}
          <div className="glass-card" style={styles.tableCard}>
            <h3 style={styles.cardTitle}>Transaction Ledger - {activeMember.name}</h3>
            {expenses.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No records listed. Add your first expense using the form above.
              </p>
            ) : (
              <div style={styles.tableResponsive}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.th}>Amount</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={14} color="var(--text-muted)" />
                            <span>{new Date(exp.date).toLocaleDateString('en-IN')}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span 
                            className={`badge ${
                              exp.category === 'Groceries' ? 'badge-primary' :
                              exp.category === 'Bills' ? 'badge-secondary' :
                              exp.category === 'Medical' ? 'badge-danger' :
                              exp.category === 'Investments' ? 'badge-success' : 'badge-secondary'
                            }`}
                          >
                            {exp.category}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={14} color="var(--text-muted)" />
                            <span>{exp.description || 'No remarks provided'}</span>
                          </div>
                        </td>
                        <td style={{ ...styles.td, fontWeight: 700, color: 'var(--text-main)' }}>
                          ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={styles.td}>
                          <button
                            className="btn-icon"
                            style={{ color: 'var(--error)' }}
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="Delete Expense Record"
                          >
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
        </>
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
  welcomeBanner: {
    padding: '24px',
    borderLeft: '4px solid var(--primary)',
  },
  bannerText: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  metricCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  metricLabel: {
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  metricVal: {
    fontSize: '1.8rem',
    fontWeight: 800,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  },
  formCard: {
    padding: '30px',
  },
  cardTitle: {
    fontSize: '1.2rem',
    marginBottom: '20px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '10px',
  },
  alertError: {
    padding: '10px 14px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ff8787',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  analyticsCard: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
  },
  noData: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '220px',
  },
  chartsWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartBox: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  legendGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px 16px',
    marginTop: '16px',
    width: '100%',
    maxHeight: '120px',
    overflowY: 'auto',
    padding: '4px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
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
    '&:hover': {
      background: 'rgba(255,255,255,0.02)',
    },
  },
};
