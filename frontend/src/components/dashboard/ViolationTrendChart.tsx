import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ViolationTrendChartProps {
  data: Array<{
    timestamp: string
    total: number
    hard_hat: number
    safety_vest: number
  }>
  type?: 'line' | 'area' | 'bar'
  title?: string
}

export default function ViolationTrendChart({
  data,
  type = 'area',
  title = 'Violation Trends'
}: ViolationTrendChartProps) {
  // Calculate trend
  const trend = useMemo(() => {
    if (data.length < 2) return null
    const recent = data.slice(-7).reduce((sum, d) => sum + d.total, 0)
    const previous = data.slice(-14, -7).reduce((sum, d) => sum + d.total, 0)

    if (previous === 0) return null

    const change = ((recent - previous) / previous) * 100
    return {
      value: Math.abs(change).toFixed(1),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    }
  }, [data])

  // Format data for chart - ensure we have proper date formatting
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    return data.map(d => {
      const date = new Date(d.timestamp)
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: d.timestamp,
        'Total': d.total || 0,
        'Hard Hat': d.hard_hat || 0,
        'Safety Vest': d.safety_vest || 0,
      }
    })
  }, [data])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-semibold">{entry.value}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-section-title text-gray-900">{title}</h3>
        {trend && (
          <div
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
              trend.direction === 'up'
                ? 'bg-red-50 text-red-600 border border-red-200'
                : trend.direction === 'down'
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : trend.direction === 'down' ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center text-gray-500">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Minus className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-body font-medium text-gray-600">No violation data available</p>
          <p className="text-caption text-gray-500 mt-1">Data will appear here once violations are detected</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorHat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorVest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280" 
              style={{ fontSize: '0.75rem' }}
              tick={{ fill: '#6b7280' }}
            />
            <YAxis 
              stroke="#6b7280" 
              style={{ fontSize: '0.75rem' }}
              tick={{ fill: '#6b7280' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '0.875rem', paddingTop: '20px' }}
              iconType="circle"
            />
            <Area
              type="monotone"
              dataKey="Total"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#colorTotal)"
              name="Total"
            />
            <Area
              type="monotone"
              dataKey="Hard Hat"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#colorHat)"
              name="Hard Hat"
            />
            <Area
              type="monotone"
              dataKey="Safety Vest"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#colorVest)"
              name="Safety Vest"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
