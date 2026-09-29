import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  History,
  Wallet,
  Download,
  Plus,
  TrendingUp,
  Calendar,
  Receipt,
  ListChecks,
  X,
  CheckSquare,
  Square,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from 'recharts';
import SubscriptionCard from '@/components/SubscriptionCard';
import { useStore } from '@/store/useStore';
import { bills, monthlySpending, categorySpending } from '@/mock/subscriptions';
import type { UserSubscription } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

type TabType = 'active' | 'history' | 'billing';
type BatchActionType = 'renew' | 'cancel';
type BusyAction = BatchActionType | 'download' | null;

interface ConfirmState {
  action: BatchActionType;
  applicable: UserSubscription[];
  skipped: UserSubscription[];
}

interface ToastState {
  type: 'success' | 'warning';
  message: string;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function Subscriptions() {
  const { subscriptions, downloadInvoice, cancelSubscription, renewSubscription } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // 批量管理模式状态
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter(s => s.status === 'active'),
    [subscriptions]
  );
  const inactiveSubscriptions = useMemo(
    () => subscriptions.filter(s => s.status !== 'active'),
    [subscriptions]
  );

  const totalMonthlySpending = activeSubscriptions.reduce((sum, sub) => sum + sub.price, 0);
  const yearlySavings = totalMonthlySpending * 12 * 0.3;

  const tabs = [
    { id: 'active' as TabType, label: '我的订阅', icon: CreditCard, count: activeSubscriptions.length },
    { id: 'history' as TabType, label: '历史记录', icon: History, count: inactiveSubscriptions.length },
    { id: 'billing' as TabType, label: '账单管理', icon: Wallet, count: bills.length },
  ];

  const showToast = useCallback((type: ToastState['type'], message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // 显式退出批量模式：清理全部选择
  const exitBatchMode = useCallback(() => {
    setBatchMode(false);
    setSelectedIds(new Set());
    setBusyAction(null);
    setConfirm(null);
  }, []);

  // 进入批量管理
  const enterBatchMode = () => {
    setBatchMode(true);
    setSelectedIds(new Set());
  };

  // 切换标签：退出批量模式并清理选择
  const switchTab = (tab: TabType) => {
    if (batchMode) exitBatchMode();
    setActiveTab(tab);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // 分组全选：跨“我的订阅 / 历史记录”两组统一选择
  const toggleGroupSelection = (group: UserSubscription[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = group.every(s => next.has(s.id));
      if (allSelected) group.forEach(s => next.delete(s.id));
      else group.forEach(s => next.add(s.id));
      return next;
    });
  };

  const allSubscriptions = useMemo(
    () => [...activeSubscriptions, ...inactiveSubscriptions],
    [activeSubscriptions, inactiveSubscriptions]
  );

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === allSubscriptions.length
        ? new Set()
        : new Set(allSubscriptions.map(s => s.id))
    );
  };

  const selectedSubscriptions = useMemo(
    () => allSubscriptions.filter(s => selectedIds.has(s.id)),
    [allSubscriptions, selectedIds]
  );
  const selectedActiveCount = selectedSubscriptions.filter(s => s.status === 'active').length;
  const selectedInactiveCount = selectedSubscriptions.length - selectedActiveCount;

  // 各批量操作的适用规则，沿用单卡片操作的状态规则
  const renewApplicable = useMemo(
    () => selectedSubscriptions.filter(s => s.status !== 'active'),
    [selectedSubscriptions]
  );
  const cancelApplicable = useMemo(
    () => selectedSubscriptions.filter(s => s.status === 'active'),
    [selectedSubscriptions]
  );

  const skipReason = (sub: UserSubscription, action: BatchActionType): string => {
    if (action === 'renew') {
      return sub.status === 'active' ? '订阅生效中，无需续订' : '';
    }
    if (sub.status === 'cancelled') return '订阅已取消，无法再次取消';
    if (sub.status === 'expired') return '订阅已过期，无法取消';
    return '';
  };

  // 点击续订 / 取消：存在不适用项目时先弹确认，明确提示
  const requestBatchAction = (action: BatchActionType) => {
    if (busyAction || selectedSubscriptions.length === 0) return;
    const applicable = action === 'renew' ? renewApplicable : cancelApplicable;
    if (applicable.length === 0) return;
    const skipped = selectedSubscriptions.filter(s => !applicable.includes(s));
    setConfirm({ action, applicable, skipped });
  };

  const executeBatchAction = async () => {
    if (!confirm || busyAction) return;
    const { action, applicable, skipped } = confirm;
    setBusyAction(action);
    // 沿用单卡片操作的异步节奏；整批处理期间锁定，防止重复点击
    await wait(500);
    if (action === 'renew') {
      applicable.forEach(s => renewSubscription(s.id));
      showToast(
        skipped.length > 0 ? 'warning' : 'success',
        `已续订 ${applicable.length} 项${skipped.length > 0 ? `，${skipped.length} 项不适用已跳过` : ''}`
      );
    } else {
      applicable.forEach(s => cancelSubscription(s.id));
      showToast(
        skipped.length > 0 ? 'warning' : 'success',
        `已取消 ${applicable.length} 项${skipped.length > 0 ? `，${skipped.length} 项不适用已跳过` : ''}`
      );
    }
    // 日期与状态已由 store 内现有规则更新；项目可能跨组移动，清理选择
    setConfirm(null);
    setBusyAction(null);
    setSelectedIds(new Set());
  };

  // 批量下载发票：发票对所有状态可用
  const handleBatchDownload = async () => {
    if (busyAction || selectedSubscriptions.length === 0) return;
    setBusyAction('download');
    for (const sub of selectedSubscriptions) {
      downloadInvoice(sub.id);
      // 错开下载触发，避免浏览器拦截
      await wait(350);
    }
    setBusyAction(null);
    setSelectedIds(new Set());
    showToast('success', `已开始下载 ${selectedSubscriptions.length} 张发票`);
  };

  // Esc：优先关闭确认弹窗，其次退出批量模式
  useEffect(() => {
    if (!batchMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirm) setConfirm(null);
      else if (!busyAction) exitBatchMode();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [batchMode, confirm, busyAction, exitBatchMode]);

  const actionLabels: Record<BatchActionType, string> = {
    renew: '批量续订',
    cancel: '批量取消',
  };

  return (
    <div className="min-h-screen bg-dark-950 pt-24">
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            订阅<span className="gradient-text">管理</span>
          </h1>
          <p className="text-xl text-gray-400">
            管理您的所有订阅，查看账单和支出分析
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
                <CreditCard className="w-7 h-7 text-primary-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">活跃订阅</p>
                <p className="text-3xl font-bold text-white">{activeSubscriptions.length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary-500/20 to-cyan-500/20 flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-secondary-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">月支出</p>
                <p className="text-3xl font-bold text-white">¥{totalMonthlySpending}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <Wallet className="w-7 h-7 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">预计年节省</p>
                <p className="text-3xl font-bold text-green-400">¥{Math.round(yearlySavings)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        >
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-400" />
                支出趋势
              </h3>
              <span className="text-sm text-gray-400">近6个月</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySpending}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: number) => [`¥${value}`, '支出']}
                  />
                  <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-secondary-400" />
                分类占比
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={categorySpending}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categorySpending.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: number) => [`¥${value}`, '支出']}
                  />
                  <Legend
                    formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* 标签栏 / 批量管理工具栏 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          {!batchMode ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 p-1 bg-dark-800/50 rounded-xl w-fit">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => switchTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all',
                      activeTab === tab.id
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs',
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-dark-900 text-gray-500'
                    )}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* 仅“我的订阅 / 历史记录”可主动开启批量管理 */}
              {(activeTab === 'active' || activeTab === 'history') && allSubscriptions.length > 0 && (
                <button
                  onClick={enterBatchMode}
                  className="btn-outline text-sm"
                >
                  <ListChecks className="w-4 h-4" />
                  批量管理
                </button>
              )}
            </div>
          ) : (
            <div className="card flex flex-wrap items-center justify-between gap-4 border-primary-500/40">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center">
                  <ListChecks className="w-5 h-5 text-primary-400" />
                </span>
                <div>
                  <p className="text-white font-semibold">批量管理模式</p>
                  <p className="text-gray-400 text-sm">
                    已选 <span className="text-primary-400 font-medium">{selectedIds.size}</span> 项
                    （我的订阅 {selectedActiveCount} · 历史记录 {selectedInactiveCount}）
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  disabled={busyAction !== null}
                  className="btn-ghost text-sm disabled:opacity-50"
                >
                  {selectedIds.size === allSubscriptions.length && allSubscriptions.length > 0
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />}
                  {selectedIds.size === allSubscriptions.length && allSubscriptions.length > 0
                    ? '取消全选'
                    : '全选'}
                </button>
                <button
                  onClick={clearSelection}
                  disabled={selectedIds.size === 0 || busyAction !== null}
                  className="btn-ghost text-sm disabled:opacity-50"
                >
                  清空选择
                </button>
                <button
                  onClick={exitBatchMode}
                  disabled={busyAction !== null}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  退出批量管理
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* ==================== 普通模式：我的订阅 ==================== */}
        {!batchMode && activeTab === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {activeSubscriptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {activeSubscriptions.map((sub, index) => (
                  <SubscriptionCard key={sub.id} subscription={sub} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-dark-800 flex items-center justify-center">
                  <CreditCard className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">暂无活跃订阅</h3>
                <p className="text-gray-400 mb-6">浏览工具市场，发现适合您的工具</p>
                <Link to="/market" className="btn-primary">
                  <Plus className="w-4 h-4" />
                  添加订阅
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* ==================== 普通模式：历史记录 ==================== */}
        {!batchMode && activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {inactiveSubscriptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {inactiveSubscriptions.map((sub, index) => (
                  <SubscriptionCard key={sub.id} subscription={sub} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-dark-800 flex items-center justify-center">
                  <History className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">暂无历史记录</h3>
                <p className="text-gray-400">您的订阅历史记录将显示在这里</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ==================== 批量管理模式：跨两组统一选择 ==================== */}
        {batchMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-10 pb-28"
          >
            {/* 我的订阅分组 */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary-400" />
                  <h3 className="text-lg font-semibold text-white">我的订阅</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-dark-900 text-gray-500">
                    {activeSubscriptions.length}
                  </span>
                </div>
                {activeSubscriptions.length > 0 && (
                  <button
                    onClick={() => toggleGroupSelection(activeSubscriptions)}
                    disabled={busyAction !== null}
                    className="text-sm text-gray-400 hover:text-primary-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {activeSubscriptions.every(s => selectedIds.has(s.id))
                      ? <CheckSquare className="w-4 h-4" />
                      : <Square className="w-4 h-4" />}
                    {activeSubscriptions.every(s => selectedIds.has(s.id)) ? '取消本组全选' : '选择本组'}
                  </button>
                )}
              </div>
              {activeSubscriptions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {activeSubscriptions.map(sub => (
                    <SubscriptionCard
                      key={sub.id}
                      subscription={sub}
                      selectable
                      selected={selectedIds.has(sub.id)}
                      disabled={busyAction !== null}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-6 text-center card">暂无活跃订阅</p>
              )}
            </section>

            {/* 历史记录分组 */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-white">历史记录</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-dark-900 text-gray-500">
                    {inactiveSubscriptions.length}
                  </span>
                </div>
                {inactiveSubscriptions.length > 0 && (
                  <button
                    onClick={() => toggleGroupSelection(inactiveSubscriptions)}
                    disabled={busyAction !== null}
                    className="text-sm text-gray-400 hover:text-primary-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {inactiveSubscriptions.every(s => selectedIds.has(s.id))
                      ? <CheckSquare className="w-4 h-4" />
                      : <Square className="w-4 h-4" />}
                    {inactiveSubscriptions.every(s => selectedIds.has(s.id)) ? '取消本组全选' : '选择本组'}
                  </button>
                )}
              </div>
              {inactiveSubscriptions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {inactiveSubscriptions.map(sub => (
                    <SubscriptionCard
                      key={sub.id}
                      subscription={sub}
                      selectable
                      selected={selectedIds.has(sub.id)}
                      disabled={busyAction !== null}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-6 text-center card">暂无历史记录</p>
              )}
            </section>
          </motion.div>
        )}

        {/* ==================== 普通模式：账单管理 ==================== */}
        {!batchMode && activeTab === 'billing' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary-400" />
                  支付方式
                </h3>
                <button className="btn-outline text-sm">
                  <Plus className="w-4 h-4" />
                  添加支付方式
                </button>
              </div>
              <div className="bg-dark-900/50 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 rounded bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">VISA</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">•••• •••• •••• 4242</p>
                    <p className="text-gray-500 text-sm">到期 12/2027</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-active">默认</span>
                  <button className="text-gray-400 hover:text-white text-sm">编辑</button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-400" />
                  账单历史
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-4 px-4 text-gray-400 font-medium text-sm">日期</th>
                      <th className="text-left py-4 px-4 text-gray-400 font-medium text-sm">描述</th>
                      <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">金额</th>
                      <th className="text-center py-4 px-4 text-gray-400 font-medium text-sm">状态</th>
                      <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill, billIndex) => (
                      <tr key={bill.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4 text-gray-300">{bill.date}</td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-white">{bill.items.map(i => i.name).join(', ')}</p>
                            <p className="text-gray-500 text-sm">{bill.items.length} 个项目</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-white font-semibold">¥{bill.amount}</td>
                        <td className="py-4 px-4 text-center">
                          {bill.status === 'paid' && <span className="badge-active">已支付</span>}
                          {bill.status === 'pending' && <span className="badge-pending">待支付</span>}
                          {bill.status === 'failed' && <span className="badge-expired">支付失败</span>}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => {
                              if (downloadingId) return;
                              setDownloadingId(bill.id);
                              downloadInvoice(subscriptions[Math.min(billIndex, subscriptions.length - 1)]?.id || '');
                              setTimeout(() => setDownloadingId(null), 1000);
                            }}
                            disabled={downloadingId !== null}
                            className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1 ml-auto disabled:opacity-50"
                          >
                            <Download className={cn('w-4 h-4', downloadingId === bill.id && 'animate-spin')} />
                            {downloadingId === bill.id ? '下载中' : '发票'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* 批量操作底栏 */}
      <AnimatePresence>
        {batchMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 inset-x-0 z-40"
          >
            <div className="container mx-auto px-4 pb-6">
              <div className="glass rounded-2xl shadow-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-primary-500/30">
                <div className="text-sm text-gray-300">
                  {selectedIds.size === 0 ? (
                    <span className="text-gray-500">请选择需要操作的订阅（可跨“我的订阅 / 历史记录”选择）</span>
                  ) : (
                    <span>
                      共 <span className="text-primary-400 font-semibold">{selectedIds.size}</span> 项已选
                      {renewApplicable.length > 0 && <span className="text-gray-400"> · 可续订 {renewApplicable.length}</span>}
                      {cancelApplicable.length > 0 && <span className="text-gray-400"> · 可取消 {cancelApplicable.length}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => requestBatchAction('renew')}
                    disabled={busyAction !== null || renewApplicable.length === 0}
                    title={
                      selectedIds.size > 0 && renewApplicable.length === 0
                        ? '所选项目均为活跃订阅，无需续订'
                        : '仅历史记录中的项目可续订'
                    }
                    className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busyAction === 'renew'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <RotateCcw className="w-4 h-4" />}
                    批量续订{renewApplicable.length > 0 ? ` (${renewApplicable.length})` : ''}
                  </button>
                  <button
                    onClick={() => requestBatchAction('cancel')}
                    disabled={busyAction !== null || cancelApplicable.length === 0}
                    title={
                      selectedIds.size > 0 && cancelApplicable.length === 0
                        ? '所选项目均非活跃订阅，无法取消'
                        : '仅活跃订阅可取消'
                    }
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busyAction === 'cancel'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <XCircle className="w-4 h-4" />}
                    批量取消{cancelApplicable.length > 0 ? ` (${cancelApplicable.length})` : ''}
                  </button>
                  <button
                    onClick={handleBatchDownload}
                    disabled={busyAction !== null || selectedIds.size === 0}
                    title="下载所选项目的发票（所有状态均可）"
                    className="btn-outline text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busyAction === 'download'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                    {busyAction === 'download'
                      ? `下载中 (${selectedIds.size})...`
                      : `下载发票 (${selectedIds.size})`}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 混合选择确认弹窗：识别并明确提示不适用项目 */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => busyAction === null && setConfirm(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-lg w-full card max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start gap-3 mb-4">
                <span className={cn(
                  'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center',
                  confirm.skipped.length > 0 ? 'bg-amber-500/15' : 'bg-primary-500/15'
                )}>
                  {confirm.skipped.length > 0
                    ? <AlertTriangle className="w-5 h-5 text-amber-400" />
                    : <ListChecks className="w-5 h-5 text-primary-400" />}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {actionLabels[confirm.action]}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    将对 <span className="text-white font-medium">{confirm.applicable.length}</span> 个适用项目执行
                    {confirm.action === 'renew' ? '续订' : '取消'}操作，
                    续订后到期日期按现有规则顺延 30 天。
                  </p>
                </div>
              </div>

              {confirm.skipped.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
                  <p className="text-amber-400 text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {confirm.skipped.length} 个项目不适用本次操作，将自动跳过
                  </p>
                  <ul className="space-y-1.5">
                    {confirm.skipped.map(sub => (
                      <li key={sub.id} className="flex items-center justify-between text-sm gap-3">
                        <span className="text-gray-300 truncate">{sub.toolName}</span>
                        <span className="text-amber-400/90 text-xs shrink-0">
                          {skipReason(sub, confirm.action)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl bg-dark-900/50 p-4 mb-5 max-h-40 overflow-y-auto">
                <p className="text-gray-400 text-xs mb-2">适用项目（{confirm.applicable.length}）</p>
                <ul className="space-y-1.5">
                  {confirm.applicable.map(sub => (
                    <li key={sub.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-200 truncate">{sub.toolName} · {sub.planName}</span>
                      <span className="text-gray-500 text-xs shrink-0 ml-3">¥{sub.price}/月</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirm(null)}
                  disabled={busyAction !== null}
                  className="btn-ghost text-sm disabled:opacity-50"
                >
                  再想想
                </button>
                <button
                  onClick={executeBatchAction}
                  disabled={busyAction !== null}
                  className={cn(
                    'text-sm text-white disabled:opacity-50 flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all',
                    confirm.action === 'cancel'
                      ? 'bg-red-500 hover:bg-red-400'
                      : 'bg-gradient-to-r from-secondary-500 to-secondary-400 hover:from-secondary-400 hover:to-secondary-300'
                  )}
                >
                  {busyAction === confirm.action
                    ? <><Loader2 className="w-4 h-4 animate-spin" />处理中...</>
                    : <>确认{confirm.action === 'renew' ? '续订' : '取消'}（{confirm.applicable.length}）</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 操作结果提示 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[60]"
          >
            <div className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-xl glass border text-sm font-medium shadow-2xl',
              toast.type === 'warning' ? 'border-amber-500/40 text-amber-300' : 'border-green-500/40 text-green-300'
            )}>
              {toast.type === 'warning'
                ? <AlertTriangle className="w-4 h-4" />
                : <CheckCircle2 className="w-4 h-4" />}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
