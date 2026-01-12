import { useMemo } from 'react'
import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface RadarChartData {
  [key: string]: string | number
}

interface RadarChartProps {
  data: RadarChartData[]
  title?: string
  radars: Array<{
    dataKey: string
    name: string
    color: string
  }>
  height?: number
  domain?: [number, number]
}

export default function RadarChart({
  data,
  title,
  radars,
  height = 350,
  domain,
}: RadarChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
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

  // Get all keys except the first one (which should be the category/angle key)
  const categoryKey = useMemo(() => {
    if (!data || data.length === 0) return 'name'
    const keys = Object.keys(data[0])
    return keys[0] // First key is the category
  }, [data])

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
        <RechartsRadarChart data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey={categoryKey}
            tick={{ fill: '#6b7280', fontSize: '0.75rem' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={domain || [0, 'auto']}
            tick={{ fill: '#6b7280', fontSize: '0.75rem' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '0.875rem', paddingTop: '20px' }}
            iconType="circle"
          />
          {radars.map((radar) => (
            <Radar
              key={radar.dataKey}
              name={radar.name}
              dataKey={radar.dataKey}
              stroke={radar.color}
              fill={radar.color}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          ))}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
