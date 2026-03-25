'use client'

import { cn, getDelayBgColor } from '@/lib/utils'

interface DelayBadgeProps {
  offsetMinutes: number
  reason?: string
  showReason?: boolean
  size?: 'sm' | 'md'
}

export default function DelayBadge({ offsetMinutes, reason, showReason = false, size = 'sm' }: DelayBadgeProps) {
  const colorClass = getDelayBgColor(offsetMinutes)

  if (offsetMinutes <= 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        'bg-green-500/20 text-green-400 border-green-500/30',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
      )}>
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        On Time
      </span>
    )
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-medium',
      colorClass,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        offsetMinutes <= 15 ? 'bg-yellow-400' : 'bg-red-400',
      )} />
      +{offsetMinutes}min
      {showReason && reason && <span className="opacity-75">({reason.toLowerCase()})</span>}
    </span>
  )
}
