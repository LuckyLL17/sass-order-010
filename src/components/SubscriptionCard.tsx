import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, RefreshCw, XCircle, CreditCard, Settings, Download, RotateCcw, Check } from 'lucide-react';
import type { UserSubscription } from '@/types';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

interface SubscriptionCardProps {
  subscription: UserSubscription;
  index?: number;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  actionsDisabled?: boolean;
}

export default function SubscriptionCard({
  subscription,
  index = 0,
  selectable = false,
  selected = false,
  onToggleSelect,
  actionsDisabled = false,
}: SubscriptionCardProps) {
  const { cancelSubscription, toggleAutoRenew, renewSubscription, downloadInvoice } = useStore();
  const [isRenewing, setIsRenewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const statusConfig = {
    active: { label: '活跃中', className: 'badge-active' },
    expired: { label: '已过期', className: 'badge-expired' },
    cancelled: { label: '已取消', className: 'badge-expired' },
  };

  const status = statusConfig[subscription.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.2) }}
      className={cn(
        'card-hover',
        selectable && 'cursor-pointer ring-offset-2 ring-offset-dark-950',
        selected && 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/40'
      )}
      onClick={selectable ? () => onToggleSelect?.(subscription.id) : undefined}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
          {selectable && (
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label={`选择 ${subscription.toolName}`}
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelect?.(subscription.id);
              }}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleSelect?.(subscription.id);
                }
              }}
              className={cn(
                'w-6 h-6 rounded-md border flex items-center justify-center transition-all',
                selected
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-600 bg-dark-900 text-transparent hover:border-primary-400'
              )}
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <span className={status.className}>{status.label}</span>
        </div>
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
        <div
          className="space-y-3 pt-4 border-t border-gray-800"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleAutoRenew(subscription.id)}
              disabled={actionsDisabled}
              className={cn(
                'flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                subscription.autoRenew
                  ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              )}
            >
              <RefreshCw className="w-4 h-4" />
              {subscription.autoRenew ? '关闭自动续费' : '开启自动续费'}
            </button>
            <button
              onClick={() => cancelSubscription(subscription.id)}
              disabled={actionsDisabled}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="w-4 h-4" />
              取消订阅
            </button>
            <button
              disabled={actionsDisabled}
              className="p-2.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => {
              setIsDownloading(true);
              downloadInvoice(subscription.id);
              setTimeout(() => setIsDownloading(false), 1000);
            }}
            disabled={isDownloading || actionsDisabled}
            className="w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-white/5 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? '下载中...' : '下载发票'}
          </button>
        </div>
      )}

      {subscription.status !== 'active' && (
        <div
          className="space-y-3 pt-4 border-t border-gray-800"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={async () => {
              setIsRenewing(true);
              await new Promise(resolve => setTimeout(resolve, 500));
              renewSubscription(subscription.id);
              setIsRenewing(false);
            }}
            disabled={isRenewing || actionsDisabled}
            className="w-full btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <RotateCcw className={cn('w-4 h-4', isRenewing && 'animate-spin')} />
            {isRenewing ? '续订中...' : '重新订阅'}
          </button>
          <button
            onClick={() => {
              setIsDownloading(true);
              downloadInvoice(subscription.id);
              setTimeout(() => setIsDownloading(false), 1000);
            }}
            disabled={isDownloading || actionsDisabled}
            className="w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-white/5 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? '下载中...' : '下载发票'}
          </button>
        </div>
      )}
    </motion.div>
  );
}
