import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, IndianRupee, ChevronRight,
  Calendar, FileText, PieChart as PieIcon, User as UserIcon
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { familyApi, expenseApi } from '../api';
import type { FamilyMember, FamilyExpense } from '../api';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';

const CATEGORIES = ['કરિયાણું', 'બિલ (લાઈટ/ફોન)', 'શિક્ષણ', 'તબીબી / દવાઓ', 'રોકાણ', 'મનોરંજન / જમવું', 'અન્ય ખર્ચ'];
const COLORS = ['#d4a853', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#64748b'];

export default function ExpensesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const memberId = searchParams.get('member');
  const selectedMember = memberId ? members.find(m => m.id === parseInt(memberId, 10)) || null : null;
  const [expenses, setExpenses] = useState<FamilyExpense[]>([]);

  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const list = await familyApi.list();
        setMembers(list);
      } catch (err) {
        console.error('Failed to load members', err);
      } finally {
        setLoading(false);
      }
    };
    loadMembers();
  }, []);

  useEffect(() => {
    if (!selectedMember) {
      setExpenses([]);
      return;
    }
    const fetchExpenses = async () => {
      try {
        const list = await expenseApi.listByMember(selectedMember.id);
        setExpenses(list);
      } catch (err) {
        console.error('Failed to load expenses', err);
      }
    };
    fetchExpenses();
  }, [selectedMember]);

  const selectMember = (m: FamilyMember) => setSearchParams({ member: m.id.toString() });
  const clearMember = () => setSearchParams({});

  // Calculations
  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const avgExpense = expenses.length > 0 ? (totalSpent / expenses.length) : 0;

  const categoryDataMap = expenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.keys(categoryDataMap).map((cat) => ({
    name: cat,
    value: categoryDataMap[cat],
  }));

  const canAddExpense = user?.role === 'admin' || (selectedMember?.allowed_user_ids || []).includes(user?.id as number);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setActionLoading(true);

    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('કૃપા કરીને શૂન્ય કરતાં વધુ સાચી રકમ દાખલ કરો.');
      }

      const newExpense = await expenseApi.create({
        family_member_id: selectedMember.id,
        amount: parsedAmount,
        category,
        description: description || undefined,
        date: expenseDate,
      });

      setExpenses(prev => [newExpense, ...prev]);
      setAmount('');
      setDescription('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setShowExpenseModal(false);
      showToast('નવો ખર્ચ સફળતાપૂર્વક નોંધવામાં આવ્યો છે!');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'ખર્ચ નોંધવામાં ભૂલ આવી છે.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('શું તમે ખરેખર આ ખર્ચ કાઢી નાખવા માંગો છો?')) return;
    try {
      await expenseApi.delete(id);
      setExpenses(prev => prev.filter(exp => exp.id !== id));
      showToast('ખર્ચ એન્ટ્રી કાઢી નાખવામાં આવી છે.');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'ખર્ચ કાઢી નાખવામાં નિષ્ફળતા મળી.', 'error');
    }
  };

  // ═══════ LOADING ═══════
  if (loading) return <LoadingScreen />;

  // ═══════ MEMBER SELECTION ═══════
  if (!selectedMember) {
    return (
      <div className="animate-slide-up">
        <button className="back-navigation-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          <span>મુખ્ય પોર્ટલ</span>
        </button>

        <h2 className="section-title">પારિવારિક સભ્યો</h2>
        <p className="section-subtitle">ખર્ચની વિગતો જોવા સભ્ય પસંદ કરો.</p>

        <div className="layout-grid stagger-children" style={{ marginTop: '20px' }}>
          {members.map(m => (
            <div
              key={m.id}
              className="glass-card-interactive selection-avatar-card"
              onClick={() => selectMember(m)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && selectMember(m)}
            >
              <div className="selection-avatar-badge">
                {m.name.charAt(0).toUpperCase()}
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{m.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '12px' }}>પરિવારના સભ્ય</p>
              <button className="btn btn-secondary btn-sm">
                પત્રક જુઓ <ChevronRight size={14} />
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <div className="glass-card" style={{ gridColumn: '1/-1' }}>
              <EmptyState icon={UserIcon} message="કોઈ સભ્ય નોંધાયેલ નથી. એડમિન સેટિંગ્સમાં સભ્યોના નામ ઉમેરો." />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════ EXPENSE DETAIL ═══════
  return (
    <div className="animate-slide-up">
      <button className="back-navigation-btn" onClick={clearMember}>
        <ArrowLeft size={16} />
        <span>સભ્યોની યાદી</span>
      </button>

      {/* Entity Banner */}
      <div className="glass-card entity-banner" style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', padding: isMobile ? '14px' : '16px 20px' }}>
        <div className="selection-avatar-badge" style={{ margin: 0, width: '44px', height: '44px', fontSize: '1.1rem' }}>
          {selectedMember.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem' }}>{selectedMember.name}નું ખર્ચ પત્રક</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>માસિક ફાળવણી અને વિવિધ શ્રેણીઓના ખર્ચ.</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '14px', marginTop: '16px' }}>
        <div className="glass-card metric-card">
          <span className="text-overline">કુલ ખર્ચ</span>
          <h3 className="text-metric text-primary">₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</h3>
        </div>
        <div className="glass-card metric-card">
          <span className="text-overline">કુલ એન્ટ્રીઓ</span>
          <h3 className="text-metric">{expenses.length}</h3>
        </div>
        {!isMobile && (
          <div className="glass-card metric-card">
            <span className="text-overline">સરેરાશ</span>
            <h3 className="text-metric">₹{avgExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
          </div>
        )}
      </div>

      {/* Add button */}
      {canAddExpense && (
        isMobile ? (
          <button className="fab" onClick={() => setShowExpenseModal(true)} aria-label="નવો ખર્ચ ઉમેરો">
            <Plus size={24} />
          </button>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
              <Plus size={16} /> નવો ખર્ચ ઉમેરો
            </button>
          </div>
        )
      )}

      {/* Pie Chart */}
      <div className="glass-card" style={{ padding: isMobile ? '16px' : '20px', marginTop: '16px' }}>
        <h3 className="card-title">કેટેગરી મુજબ ખર્ચ</h3>
        {expenses.length === 0 ? (
          <EmptyState icon={PieIcon} message="ગ્રાફ પ્રદર્શિત કરવા ડેટા નથી." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '8px', fontSize: '0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="legend-grid">
              {pieChartData.map((item, index) => (
                <div key={item.name} className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                  <span className="legend-text">{item.name}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', marginLeft: 'auto' }}>₹{item.value.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expense List */}
      <div className="glass-card" style={{ padding: isMobile ? '14px' : '20px', marginTop: '16px' }}>
        <h3 className="card-title">ખર્ચ પત્રક</h3>
        {expenses.length === 0 ? (
          <EmptyState icon={FileText} message="હજુ સુધી કોઈ ખર્ચ નોંધાયેલ નથી." />
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {expenses.map(exp => (
              <div key={exp.id} className="expense-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{exp.category}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {exp.description || 'કોઈ નોંધ નથી'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <Calendar size={11} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(exp.date).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>
                      ₹{exp.amount.toLocaleString('en-IN')}
                    </span>
                    {(user?.role === 'admin' || exp.added_by === user?.id) && (
                      <button className="btn-icon" style={{ color: 'var(--error)', width: '28px', height: '28px' }} onClick={() => handleDeleteExpense(exp.id)}>
                        <Trash2 size={14} />
                      </button>
                    )}
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
                  <th>કેટેગરી</th>
                  <th>વિગત / નોંધ</th>
                  <th>રકમ</th>
                  <th>કાર્ય</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                    <td><span className="badge badge-primary">{exp.category}</span></td>
                    <td>{exp.description || 'કોઈ નોંધ નથી'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{exp.amount.toLocaleString('en-IN')}</td>
                    <td>
                      {(user?.role === 'admin' || exp.added_by === user?.id) && (
                        <button className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleDeleteExpense(exp.id)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal show={showExpenseModal} onClose={() => setShowExpenseModal(false)} title={`નવો ખર્ચ (${selectedMember.name})`} maxWidth="550px">
        <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">ખર્ચની રકમ (₹)</label>
            <div className="input-wrapper">
              <IndianRupee size={16} className="input-icon" />
              <input type="number" step="0.01" className="input-field input-with-icon" placeholder="રકમ" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">કેટેગરી</label>
              <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">તારીખ</label>
              <input type="date" className="input-field" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">વિગત / નોંધ</label>
            <textarea className="input-field" placeholder="ખર્ચ કઈ બાબતમાં..." value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: '60px' }} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>રદ</button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>સાચવો</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
