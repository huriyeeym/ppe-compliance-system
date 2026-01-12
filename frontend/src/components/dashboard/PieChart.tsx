import { useMemo } from 'react'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

interface PieChartData {
  name: string
  value: number
  color?: string
}

interface PieChartProps {
  data: PieChartData[]
  title?: string
  variant?: 'pie' | 'donut'
  showLegend?: boolean
  showLabels?: boolean
  innerRadius?: number
  outerRadius?: number
  height?: number
}

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f59e0b', // orange
  '#eab308', // yellow
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // green
  '#06b6d4', // cyan
  '#f97316', // orange-500
  '#ec4899', // pink
  '#6366f1', // indigo
]

export default function PieChart({
  data,
  title,
  variant = 'pie',
  showLegend = true,
  showLabels = false,
  innerRadius,
  outerRadius,
  height = 350,
}: PieChartProps) {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }))
  }, [data])

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0)
  }, [data])

  const defaultInnerRadius = variant === 'donut' ? 60 : 0
  const defaultOuterRadius = variant === 'donut' ? 100 : 120

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0'
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-gray-900 mb-1">{data.name}</p>
          <p className="text-sm text-gray-600">
            Value: <span className="font-semibold">{data.value.toLocaleString()}</span>
          </p>
          <p className="text-sm text-gray-600">
            Percentage: <span className="font-semibold">{percentage}%</span>
          </p>
        </div>
      )
    }
    return null
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (!showLabels || percent < 0.05) return null
    
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="card">
        {title && <h3 className="text-section-title text-gray-900 mb-4">{title}</h3>}
        <div className="h-80 flex flex-col items-center justify-center text-gray-500">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-body font-medium text-gray-600">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      {title && <h3 className="text-section-title text-gray-900 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={showLabels ? CustomLabel : false}
            outerRadius={outerRadius || defaultOuterRadius}
            innerRadius={innerRadius !== undefined ? innerRadius : defaultInnerRadius}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '0.875rem', paddingTop: '20px' }}
              iconType="circle"
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
      {variant === 'donut' && (
        <div className="text-center mt-4">
          <div className="text-2xl font-bold text-gray-900">{total.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
      )}
    </div>
  )
}
