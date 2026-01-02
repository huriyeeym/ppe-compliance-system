import { useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
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

  // Format data for chart
  const chartData = useMemo(() => {
    return data.map(d => ({
      date: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      'Total': d.total,
      'Hard Hat': d.hard_hat,
      'Safety Vest': d.safety_vest,
    }))
  }, [data])

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    }

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '0.75rem' }} />
            <YAxis stroke="#94a3b8" style={{ fontSize: '0.75rem' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#f1f5f9',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
            <Line
              type="monotone"
              dataKey="Total"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Hard Hat"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: '#ef4444', r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Safety Vest"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 3 }}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '0.75rem' }} />
            <YAxis stroke="#94a3b8" style={{ fontSize: '0.75rem' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#f1f5f9',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
            <Area
              type="monotone"
              dataKey="Total"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#colorTotal)"
            />
            <Area
              type="monotone"
              dataKey="Hard Hat"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#colorHat)"
            />
            <Area
              type="monotone"
              dataKey="Safety Vest"
              stroke="#f59e0b"
              strokeWidth={1.5}
              fill="url(#colorVest)"
            />
          </AreaChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '0.75rem' }} />
            <YAxis stroke="#94a3b8" style={{ fontSize: '0.75rem' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#f1f5f9',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
            <Bar dataKey="Hard Hat" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Safety Vest" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        )
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-section-title text-slate-50">{title}</h3>
        {trend && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-caption font-medium ${
              trend.direction === 'up'
                ? 'bg-red-500/10 text-red-400'
                : trend.direction === 'down'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : trend.direction === 'down' ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500">
          <p className="text-caption">No data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {renderChart()}
        </ResponsiveContainer>
      )}
    </div>
  )
}
