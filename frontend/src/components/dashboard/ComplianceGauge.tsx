import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ComplianceGaugeProps {
  complianceRate: number // 0-100
  totalDetections: number
  compliantDetections: number
  nonCompliantDetections: number
}

export default function ComplianceGauge({
  complianceRate,
  totalDetections,
  compliantDetections,
  nonCompliantDetections
}: ComplianceGaugeProps) {
  const data = useMemo(() => [
    { name: 'Compliant', value: compliantDetections, color: '#10b981' },
    { name: 'Violations', value: nonCompliantDetections, color: '#ef4444' },
  ], [compliantDetections, nonCompliantDetections])

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400'
    if (rate >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getComplianceStatus = (rate: number) => {
    if (rate >= 90) return { label: 'Excellent', color: 'bg-green-500/10 border-green-500/20' }
    if (rate >= 70) return { label: 'Good', color: 'bg-yellow-500/10 border-yellow-500/20' }
    if (rate >= 50) return { label: 'Medium', color: 'bg-orange-500/10 border-orange-500/20' }
    return { label: 'Low', color: 'bg-red-500/10 border-red-500/20' }
  }

  const status = getComplianceStatus(complianceRate)

  return (
    <div className="card">
      <h3 className="text-section-title text-slate-50 mb-4">Compliance Rate</h3>

      <div className="flex flex-col items-center">
        {/* Gauge Chart */}
        <div className="relative w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center Text */}
          <div className="absolute inset-0 flex items-center justify-center pb-8">
            <div className="text-center">
              <div className={`text-4xl font-bold ${getComplianceColor(complianceRate)}`}>
                {complianceRate.toFixed(1)}%
              </div>
              <div className="text-caption text-slate-400 mt-1">Compliance</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 w-full mt-6">
          <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-caption text-slate-400">Compliant</span>
            </div>
            <div className="text-xl font-bold text-green-400">{compliantDetections}</div>
          </div>

          <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-caption text-slate-400">Violations</span>
            </div>
            <div className="text-xl font-bold text-red-400">{nonCompliantDetections}</div>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`mt-4 px-4 py-2 rounded-lg border ${status.color}`}>
          <span className="text-body font-medium text-slate-50">{status.label}</span>
        </div>

        {/* Total */}
        <div className="mt-4 text-center">
          <span className="text-caption text-slate-400">Total Detections: </span>
          <span className="text-body font-semibold text-slate-50">{totalDetections}</span>
        </div>
      </div>
    </div>
  )
}
