import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CreditCard,
  Download,
  History,
  Info,
  ListChecks,
  Loader2,
  Plus,
  RotateCcw,
  TrendingUp,
  Calendar,
  Receipt,
  Wallet,
  PieChart,
  X,
  XCircle,
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
type BatchActionType = 'renew' | 'cancel' | 'download';

interface BatchNotice {
  type: 'success' | 'warning';
  title: string;
  message: string;
  skippedNames: string[];
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function Subscriptions() {
  const {
    subscriptions,
    cancelSubscription,
    renewSubscription,
    downloadInvoice,
  } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [runningAction, setRunningAction] = useState<BatchActionType | null>(null);
  const [batchNotice, setBatchNotice] = useState<BatchNotice | null>(null);

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const inactiveSubscriptions = subscriptions.filter(s => s.status !== 'active');

  const totalMonthlySpending = activeSubscriptions.reduce((sum, sub) => sum + sub.price, 0);
  const yearlySavings = totalMonthlySpending * 12 * 0.3;

  const selectedSubscriptions = useMemo(
    () => subscriptions.filter(subscription => selectedIds.includes(subscription.id)),
    [subscriptions, selectedIds]
  );
  const selectedActive = selectedSubscriptions.filter(subscription => subscription.status === 'active');
  const selectedInactive = selectedSubscriptions.filter(subscription => subscription.status !== 'active');

  const visibleSubscriptions = activeTab === 'active' ? activeSubscriptions : inactiveSubscriptions;
  const visibleIds = visibleSubscriptions.map(subscription => subscription.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isBatchRunning = runningAction !== null;

  const tabs = [
    { id: 'active' as TabType, label: '我的订阅', icon: CreditCard, count: activeSubscriptions.length },
    { id: 'history' as TabType, label: '历史记录', icon: History, count: inactiveSubscriptions.length },
    { id: 'billing' as TabType, label: '账单管理', icon: Wallet, count: bills.length },
  ];

  const resetSelection = () => {
    setBatchMode(false);
    setSelectedIds([]);
    setBatchNotice(null);
  };

  const handleTabChange = (tab: TabType) => {
    if (isBatchRunning) return;

    if (tab === 'billing') {
      resetSelection();
    }
    setActiveTab(tab);
  };

  const startBatchMode = () => {
    setBatchMode(true);
    setBatchNotice(null);
  };

  const toggleSubscription = (id: string) => {
    if (isBatchRunning) return;

    setBatchNotice(null);
    setSelectedIds(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );
  };

  const selectVisible = () => {
    if (isBatchRunning) return;
    setBatchNotice(null);
    setSelectedIds(current => Array.from(new Set([...current, ...visibleIds])));
  };

  const selectAllSubscriptions = () => {
    if (isBatchRunning) return;
    setBatchNotice(null);
    setSelectedIds(subscriptions.map(subscription => subscription.id));
  };

  const clearVisibleSelection = () => {
    if (isBatchRunning) return;
    setBatchNotice(null);
    setSelectedIds(current => current.filter(id => !visibleIds.includes(id)));
  };

  const clearSelection = () => {
    if (isBatchRunning) return;
    setBatchNotice(null);
    setSelectedIds([]);
  };

  const getActionContext = (action: BatchActionType) => {
    if (action === 'renew') {
      return {
        label: '续订',
        eligible: selectedInactive,
        skipped: selectedActive,
      };
    }

    if (action === 'cancel') {
      return {
        label: '取消',
        eligible: selectedActive,
        skipped: selectedInactive,
      };
    }

    return {
      label: '下载发票',
      eligible: selectedSubscriptions,
      skipped: [] as UserSubscription[],
    };
  };

  const handleBatchAction = async (action: BatchActionType) => {
    const context = getActionContext(action);
    if (isBatchRunning || context.eligible.length === 0) return;

    const eligibleIds = context.eligible.map(subscription => subscription.id);
    const skippedNames = context.skipped.map(subscription => subscription.toolName);

    setRunningAction(action);
    setBatchNotice(null);

    try {
      if (action === 'download') {
        await wait(150);
        for (let index = 0; index < eligibleIds.length; index += 1) {
          downloadInvoice(eligibleIds[index]);
          if (index < eligibleIds.length - 1) {
            await wait(250);
          }
        }
      } else {
        await wait(300);
        eligibleIds.forEach(id => {
          if (action === 'renew') {
            renewSubscription(id);
          } else {
            cancelSubscription(id);
          }
        });
      }

      setSelectedIds(current => current.filter(id => !eligibleIds.includes(id)));
      setBatchNotice({
        type: skippedNames.length > 0 ? 'warning' : 'success',
        title: `${context.label}完成`,
        message: action === 'download'
          ? `已为 ${eligibleIds.length} 个订阅下载发票。`
          : `已${context.label} ${eligibleIds.length} 个订阅，日期与状态已按现有规则更新。`,
        skippedNames,
      });
    } finally {
      setRunningAction(null);
    }
  };

  const actionButtonClass = 'px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const renewContext = getActionContext('renew');
  const cancelContext = getActionContext('cancel');
  const isMixedSelection = selectedActive.length > 0 && selectedInactive.length > 0;
  const selectionGuidance = selectedSubscriptions.length > 0
    ? isMixedSelection
      ? `当前为跨标签选择：我的订阅 ${selectedActive.length} 项、历史记录 ${selectedInactive.length} 项。续订仅处理历史记录，取消仅处理我的订阅，下载发票处理全部项目。`
      : selectedActive.length > 0
        ? `已选 ${selectedActive.length} 项活跃订阅。续订不适用于这些项目，取消和下载发票可处理。`
        : `已选 ${selectedInactive.length} 项历史记录。取消不适用于这些项目，续订和下载发票可处理。`
    : '';

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
                <PieChart className="w-5 h-5 text-primary-400" />
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
                <PieChart className="w-5 h-5 text-secondary-400" />
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-center gap-2 p-1 bg-dark-800/50 rounded-xl w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  disabled={isBatchRunning}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed',
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

            {activeTab !== 'billing' && !batchMode && (
              <button onClick={startBatchMode} className="btn-outline text-sm">
                <ListChecks className="w-4 h-4" />
                批量管理
              </button>
            )}
          </div>
        </motion.div>

        {batchMode && activeTab !== 'billing' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 md:p-5 mb-6 border-primary-500/40 bg-primary-500/5"
          >
            <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-primary-400" />
                    批量管理模式
                  </h3>
                  <span className="text-sm text-primary-300">已选 {selectedSubscriptions.length} 项</span>
                  <button
                    onClick={resetSelection}
                    disabled={isBatchRunning}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4" />
                    退出
                  </button>
                </div>
                <p className="text-sm text-gray-400">
                  可在“我的订阅”和“历史记录”之间跨标签选择；切换标签会保留选择，切换到账单管理或退出时清空。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={allVisibleSelected ? clearVisibleSelection : selectVisible}
                  disabled={isBatchRunning || visibleSubscriptions.length === 0}
                  className="px-3 py-2 rounded-lg text-sm text-gray-300 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allVisibleSelected ? '取消本页选择' : '选择当前标签'}
                </button>
                <button
                  onClick={selectAllSubscriptions}
                  disabled={isBatchRunning}
                  className="px-3 py-2 rounded-lg text-sm text-gray-300 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  全选两个标签
                </button>
                <button
                  onClick={clearSelection}
                  disabled={isBatchRunning || selectedIds.length === 0}
                  className="px-3 py-2 rounded-lg text-sm text-gray-300 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  清空选择
                </button>
              </div>
            </div>

            <div className="h-px bg-white/10 my-4" />

            {selectionGuidance && (
              <div className={cn(
                'rounded-lg p-3 mb-4 text-sm flex items-start gap-2',
                isMixedSelection ? 'bg-amber-500/10 text-amber-200' : 'bg-secondary-500/10 text-cyan-200'
              )}>
                {isMixedSelection ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
                <p>{selectionGuidance}</p>
              </div>
            )}

            {batchNotice && (
              <div className={cn(
                'rounded-lg p-3 mb-4 text-sm',
                batchNotice.type === 'success' ? 'bg-green-500/10 text-green-200' : 'bg-amber-500/10 text-amber-200'
              )}>
                <p className="font-medium mb-1">{batchNotice.title}</p>
                <p>{batchNotice.message}</p>
                {batchNotice.skippedNames.length > 0 && (
                  <p className="mt-1">已跳过不适用项目：{batchNotice.skippedNames.join('、')}</p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={() => handleBatchAction('renew')}
                disabled={isBatchRunning || renewContext.eligible.length === 0}
                title={renewContext.eligible.length === 0
                  ? '所选项目中没有可续订的历史记录'
                  : renewContext.skipped.length > 0
                    ? `将跳过活跃订阅：${renewContext.skipped.map(item => item.toolName).join('、')}`
                    : '续订所选历史记录'}
                className={cn(actionButtonClass, 'bg-primary-500/15 text-primary-300 hover:bg-primary-500/25')}
              >
                {runningAction === 'renew' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {runningAction === 'renew' ? '续订中...' : `续订 (${renewContext.eligible.length})`}
              </button>

              <button
                onClick={() => handleBatchAction('cancel')}
                disabled={isBatchRunning || cancelContext.eligible.length === 0}
                title={cancelContext.eligible.length === 0
                  ? '所选项目中没有可取消的活跃订阅'
                  : cancelContext.skipped.length > 0
                    ? `将跳过历史记录：${cancelContext.skipped.map(item => item.toolName).join('、')}`
                    : '取消所选活跃订阅'}
                className={cn(actionButtonClass, 'bg-red-500/15 text-red-300 hover:bg-red-500/25')}
              >
                {runningAction === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {runningAction === 'cancel' ? '取消中...' : `取消 (${cancelContext.eligible.length})`}
              </button>

              <button
                onClick={() => handleBatchAction('download')}
                disabled={isBatchRunning || selectedSubscriptions.length === 0}
                title="为所选订阅逐一下载发票"
                className={cn(actionButtonClass, 'bg-white/10 text-gray-200 hover:bg-white/15')}
              >
                {runningAction === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {runningAction === 'download' ? '下载中...' : `下载发票 (${selectedSubscriptions.length})`}
              </button>

              <span className="text-xs text-gray-500 sm:ml-auto">单张卡片上的操作仍可单独使用</span>
            </div>
          </motion.div>
        )}

        {activeTab === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {activeSubscriptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {activeSubscriptions.map((sub, index) => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    index={index}
                    selectable={batchMode}
                    selected={selectedIds.includes(sub.id)}
                    onToggleSelect={toggleSubscription}
                    actionsDisabled={isBatchRunning}
                  />
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

        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {inactiveSubscriptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {inactiveSubscriptions.map((sub, index) => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    index={index}
                    selectable={batchMode}
                    selected={selectedIds.includes(sub.id)}
                    onToggleSelect={toggleSubscription}
                    actionsDisabled={isBatchRunning}
                  />
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

        {activeTab === 'billing' && (
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
                    {bills.map((bill) => (
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
                              setDownloadingId(bill.id);
                              downloadInvoice(subscriptions[0]?.id || '');
                              setTimeout(() => setDownloadingId(null), 1000);
                            }}
                            disabled={downloadingId === bill.id}
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
    </div>
  );
}
