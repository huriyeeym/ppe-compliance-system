interface KPICardProps {
  title: string
  value: string
  icon: string
  trend?: string
  color?: 'success' | 'warning' | 'danger' | 'info'
}

export default function KPICard({ title, value, icon, trend, color = 'info' }: KPICardProps) {
  const colorClasses = {
    success: 'border-green-500/30',
    warning: 'border-yellow-500/30',
    danger: 'border-red-500/30',
    info: 'border-blue-500/30',
  }

  return (
    <div className={`
      card border-2 ${colorClasses[color]}
      hover:scale-[1.02] transition-all duration-200
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-caption mb-3">{title}</p>
          <h3 className="text-4xl font-bold text-slate-50 mb-2">{value}</h3>
          {trend && (
            <p className="text-xs font-medium text-green-400 flex items-center gap-1">
              <span>↗</span> {trend}
            </p>
          )}
        </div>
        <div className="text-5xl opacity-40">{icon}</div>
      </div>
    </div>
  )
}
