import { useMemo } from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface BarChartData {
  name: string
  [key: string]: string | number
}

interface BarChartProps {
  data: BarChartData[]
  title?: string
  orientation?: 'horizontal' | 'vertical'
  variant?: 'grouped' | 'stacked'
  bars: Array<{
    dataKey: string
    name: string
    color: string
  }>
  height?: number
  showGrid?: boolean
  xAxisLabel?: string
  yAxisLabel?: string
}

export default function BarChart({
  data,
  title,
  orientation = 'vertical',
  variant = 'grouped',
  bars,
  height = 350,
  showGrid = true,
  xAxisLabel,
  yAxisLabel,
}: BarChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-semibold">{entry.value.toLocaleString()}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
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
        <RechartsBarChart
          data={data}
          layout={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
          {orientation === 'vertical' ? (
            <>
              <XAxis
                dataKey="name"
                stroke="#6b7280"
                style={{ fontSize: '0.75rem' }}
                tick={{ fill: '#6b7280' }}
                label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5, style: { fontSize: '0.75rem', fill: '#6b7280' } } : undefined}
              />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: '0.75rem' }}
                tick={{ fill: '#6b7280' }}
                label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: '0.75rem', fill: '#6b7280' } } : undefined}
              />
            </>
          ) : (
            <>
              <XAxis
                type="number"
                stroke="#6b7280"
                style={{ fontSize: '0.75rem' }}
                tick={{ fill: '#6b7280' }}
                label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5, style: { fontSize: '0.75rem', fill: '#6b7280' } } : undefined}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                style={{ fontSize: '0.75rem' }}
                tick={{ fill: '#6b7280' }}
                width={100}
                label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: '0.75rem', fill: '#6b7280' } } : undefined}
              />
            </>
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '0.875rem', paddingTop: '20px' }}
            iconType="square"
          />
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.color}
              stackId={variant === 'stacked' ? 'stack' : undefined}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
