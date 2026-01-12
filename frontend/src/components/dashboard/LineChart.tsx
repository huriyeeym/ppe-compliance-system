import { useMemo } from 'react'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

interface LineChartData {
  [key: string]: string | number
}

interface LineChartProps {
  data: LineChartData[]
  title?: string
  lines: Array<{
    dataKey: string
    name: string
    color: string
  }>
  height?: number
  showArea?: boolean
  smooth?: boolean
  xAxisKey?: string
  showGrid?: boolean
  xAxisLabel?: string
  yAxisLabel?: string
}

export default function LineChart({
  data,
  title,
  lines,
  height = 350,
  showArea = false,
  smooth = true,
  xAxisKey = 'date',
  showGrid = true,
  xAxisLabel,
  yAxisLabel,
}: LineChartProps) {
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

  const ChartComponent = showArea ? AreaChart : RechartsLineChart
  const DataComponent = showArea ? Area : Line

  return (
    <div className="card">
      {title && <h3 className="text-section-title text-gray-900 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
          <XAxis
            dataKey={xAxisKey}
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
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '0.875rem', paddingTop: '20px' }}
            iconType="line"
          />
          {lines.map((line, index) => {
            const commonProps = {
              key: line.dataKey,
              type: smooth ? 'monotone' : 'linear',
              dataKey: line.dataKey,
              stroke: line.color,
              strokeWidth: 2,
              name: line.name,
              dot: { r: 4 },
              activeDot: { r: 6 },
            }

            if (showArea) {
              return (
                <Area
                  {...commonProps}
                  fill={line.color}
                  fillOpacity={0.3}
                />
              )
            }

            return <Line {...commonProps} />
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}
