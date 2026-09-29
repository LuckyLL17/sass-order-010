import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, RefreshCw, XCircle, CreditCard, Settings, Download, RotateCcw, Check } from 'lucide-react';
import type { UserSubscription } from '@/types';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

interface SubscriptionCardProps {
  subscription: UserSubscription;
  index?: number;
  /** 是否处于批量管理模式 */
  selectable?: boolean;
  /** 批量管理模式下是否被选中 */
  selected?: boolean;
  /** 批量处理进行中（锁定卡片，防止重复点击） */
  disabled?: boolean;
  /** 批量管理模式下点击卡片切换选中 */
  onToggleSelect?: (id: string) => void;
}

export default function SubscriptionCard({
  subscription,
  index = 0,
  selectable = false,
  selected = false,
  disabled = false,
  onToggleSelect,
}: SubscriptionCardProps) {
  const { cancelSubscription, toggleAutoRenew, renewSubscription, downloadInvoice } = useStore();
  const [isRenewing, setIsRenewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const statusConfig = {
    active: { label: '活跃中', className: 'badge-active' },
    expired: { label: '已过期', className: 'badge-expired' },
    cancelled: { label: '已取消', className: 'badge-expired' },
  };

  const status = statusConfig[subscription.status];

  const card = (
    <>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          {selectable && (
            <span
              aria-hidden
              className={cn(
                'shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                selected
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-500 bg-dark-900/60'
              )}
            >
              {selected && <Check className="w-4 h-4" />}
            </span>
          )}
          <div className="w-12 h-12 rounded-xl bg-dark-900 p-1.5 border border-gray-700/50 overflow-hidden">
            <img
              src={subscription.toolLogo}
              alt={subscription.toolName}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">{subscription.toolName}</h3>
            <p className="text-gray-400 text-sm">{subscription.planName} 方案</p>
          </div>
        </div>
        <span className={status.className}>{status.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-dark-900/50 rounded-xl p-3">
          <p className="text-gray-500 text-xs mb-1">月付金额</p>
          <p className="text-xl font-bold text-white">¥{subscription.price}</p>
        </div>
        <div className="bg-dark-900/50 rounded-xl p-3">
          <p className="text-gray-500 text-xs mb-1">自动续费</p>
          <p className={cn(
            'text-lg font-bold',
            subscription.autoRenew ? 'text-green-400' : 'text-gray-500'
          )}>
            {subscription.autoRenew ? '已开启' : '已关闭'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-gray-400 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>到期: {subscription.endDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          <span>按月付费</span>
        </div>
      </div>

      {subscription.status === 'active' && (
        <div className="space-y-3 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleAutoRenew(subscription.id)}
              className={cn(
                'flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all',
                subscription.autoRenew
                  ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              )}
            >
              <RefreshCw className="w-4 h-4" />
              {subscription.autoRenew ? '关闭自动续费' : '开启自动续费'}
            </button>
            <button
              onClick={async () => {
                // 防止重复点击取消
                if (isCancelling) return;
                setIsCancelling(true);
                await new Promise(resolve => setTimeout(resolve, 500));
                cancelSubscription(subscription.id);
                setIsCancelling(false);
              }}
              disabled={isCancelling}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              <XCircle className={cn('w-4 h-4', isCancelling && 'animate-spin')} />
              {isCancelling ? '取消中...' : '取消订阅'}
            </button>
            <button
              type="button"
              aria-label="订阅设置"
              className="p-2.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-default"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => {
              if (isDownloading) return;
              setIsDownloading(true);
              downloadInvoice(subscription.id);
              setTimeout(() => setIsDownloading(false), 1000);
            }}
            disabled={isDownloading}
            className="w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-white/5 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Download className={cn('w-4 h-4', isDownloading && 'animate-spin')} />
            {isDownloading ? '下载中...' : '下载发票'}
          </button>
        </div>
      )}

      {subscription.status !== 'active' && (
        <div className="space-y-3 pt-4 border-t border-gray-800">
          <button
            onClick={async () => {
              if (isRenewing) return;
              setIsRenewing(true);
              await new Promise(resolve => setTimeout(resolve, 500));
              renewSubscription(subscription.id);
              setIsRenewing(false);
            }}
            disabled={isRenewing}
            className="w-full btn-primary text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RotateCcw className={cn('w-4 h-4', isRenewing && 'animate-spin')} />
            {isRenewing ? '续订中...' : subscription.status === 'cancelled' ? '重新订阅' : '续订'}
          </button>
          <button
            onClick={() => {
              if (isDownloading) return;
              setIsDownloading(true);
              downloadInvoice(subscription.id);
              setTimeout(() => setIsDownloading(false), 1000);
            }}
            disabled={isDownloading}
            className="w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-white/5 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Download className={cn('w-4 h-4', isDownloading && 'animate-spin')} />
            {isDownloading ? '下载中...' : '下载发票'}
          </button>
        </div>
      )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: selectable ? 0 : index * 0.1 }}
      onClick={selectable && !disabled ? () => onToggleSelect?.(subscription.id) : undefined}
      aria-pressed={selectable ? selected : undefined}
      className={cn(
        selectable ? 'card cursor-pointer' : 'card-hover',
        selectable && selected && 'border-primary-500 bg-primary-500/10 ring-2 ring-primary-500/40',
        selectable && disabled && 'pointer-events-none opacity-60'
      )}
    >
      {card}
    </motion.div>
  );
}
