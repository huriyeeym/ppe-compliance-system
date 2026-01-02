import type { ReactNode } from 'react'

interface KPICardProps {
  title: string
  value: string
  icon: ReactNode
  trend?: string
  color?: 'success' | 'warning' | 'danger' | 'info'
}

export default function KPICard({ title, value, icon, trend, color = 'info' }: KPICardProps) {
  const colorConfig = {
    success: { border: 'border-l-[#4CAF50]', iconBg: 'bg-[#4CAF50]/10', iconColor: 'text-[#4CAF50]' },
    warning: { border: 'border-l-[#FFC107]', iconBg: 'bg-[#FFC107]/10', iconColor: 'text-[#FFC107]' },
    danger: { border: 'border-l-[#FF6B35]', iconBg: 'bg-[#FF6B35]/10', iconColor: 'text-[#FF6B35]' },
    info: { border: 'border-l-[#1E3A5F]', iconBg: 'bg-[#1E3A5F]/10', iconColor: 'text-[#1E3A5F]' },
  }

  const config = colorConfig[color]

  return (
    <div className={`
      card border-l-4 ${config.border}
      hover:shadow-md transition-all duration-200
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-caption mb-2 text-gray-600">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{value}</h3>
          {trend && (
            <p className="text-xs font-medium text-[#4CAF50] flex items-center gap-1">
              <span>↗</span> {trend}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 ${config.iconBg} ${config.iconColor} rounded-lg flex items-center justify-center text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
