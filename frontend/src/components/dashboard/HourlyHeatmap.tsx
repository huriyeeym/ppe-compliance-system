import { useMemo } from 'react'

interface HourlyHeatmapProps {
  data: Array<{
    hour: number
    violations: number
  }>
  title?: string
}

export default function HourlyHeatmap({ data, title = 'Hourly Violation Distribution' }: HourlyHeatmapProps) {
  const maxViolations = useMemo(() => {
    return Math.max(...data.map(d => d.violations), 1)
  }, [data])

  const getIntensityColor = (violations: number) => {
    const intensity = violations / maxViolations
    if (intensity === 0) return 'bg-gray-200'
    if (intensity < 0.2) return 'bg-purple-900/30'
    if (intensity < 0.4) return 'bg-purple-700/50'
    if (intensity < 0.6) return 'bg-purple-600/70'
    if (intensity < 0.8) return 'bg-purple-500/80'
    return 'bg-purple-400'
  }

  const getPeakHours = () => {
    const sorted = [...data].sort((a, b) => b.violations - a.violations)
    return sorted.slice(0, 3)
  }

  const peakHours = getPeakHours()

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-section-title">{title}</h3>
        <span className="text-caption text-gray-500">Last 24 Hours</span>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-12 gap-1 mb-4">
        {data.map((item) => (
          <div
            key={item.hour}
            className={`aspect-square rounded flex flex-col items-center justify-center ${getIntensityColor(
              item.violations
            )} transition-all hover:scale-110 cursor-pointer group relative`}
            title={`${item.hour}:00 - ${item.violations} violations`}
          >
            <span className="text-[10px] font-medium text-white">{item.hour}</span>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
              <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
                {item.hour}:00 - {item.violations} violations
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-gray-600 mb-4">
        <span className="text-gray-600">Low</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-800 rounded"></div>
          <div className="w-4 h-4 bg-purple-900/30 rounded"></div>
          <div className="w-4 h-4 bg-purple-700/50 rounded"></div>
          <div className="w-4 h-4 bg-purple-600/70 rounded"></div>
          <div className="w-4 h-4 bg-purple-500/80 rounded"></div>
          <div className="w-4 h-4 bg-purple-400 rounded"></div>
        </div>
        <span className="text-gray-600">High</span>
      </div>

      {/* Peak Hours */}
      <div>
        <h4 className="text-body font-semibold text-gray-900 mb-2">Peak Hours</h4>
        <div className="space-y-2">
          {peakHours.map((item, idx) => (
            <div
              key={item.hour}
              className="flex items-center justify-between p-2 bg-gray-100 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-6 h-6 rounded flex items-center justify-center text-xs font-bold
                  ${idx === 0 ? 'bg-purple-500 text-white' :
                    idx === 1 ? 'bg-purple-600/80 text-white' :
                    'bg-purple-700/60 text-gray-200'}
                `}>
                  {idx + 1}
                </div>
                <span className="text-body text-gray-900 font-medium">{item.hour}:00</span>
              </div>
              <span className="text-body text-purple-400 font-semibold">{item.violations} violations</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
