import { CheckCircle2, XCircle, TrendingUp } from 'lucide-react'

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
  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return { 
      primary: '#10b981', 
      light: '#d1fae5', 
      text: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      badge: 'bg-green-100 text-green-700 border-green-300'
    }
    if (rate >= 70) return { 
      primary: '#eab308', 
      light: '#fef9c3', 
      text: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-700 border-yellow-300'
    }
    return { 
      primary: '#ef4444', 
      light: '#fee2e2', 
      text: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      badge: 'bg-red-100 text-red-700 border-red-300'
    }
  }

  const getComplianceStatus = (rate: number) => {
    if (rate >= 90) return { label: 'Excellent', icon: TrendingUp }
    if (rate >= 70) return { label: 'Good', icon: TrendingUp }
    if (rate >= 50) return { label: 'Medium', icon: TrendingUp }
    return { label: 'Needs Improvement', icon: TrendingUp }
  }

  const colors = getComplianceColor(complianceRate)
  const status = getComplianceStatus(complianceRate)
  const StatusIcon = status.icon
  
  // Calculate circumference for circular progress
  const radius = 65
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (complianceRate / 100) * circumference
  const size = 160

  return (
    <div className="card bg-white border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Compliance Rate</h3>
          <p className="text-sm text-gray-500 mt-0.5">Overall safety compliance</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${colors.badge}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{status.label}</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Circular Progress - Clean Separation */}
        <div className="flex flex-col items-center justify-center py-6">
          {/* Circular Progress Ring */}
          <div className="relative mb-6" style={{ width: size, height: size }}>
            <svg 
              className="transform -rotate-90" 
              width={size} 
              height={size}
            >
              {/* Background Circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#f3f4f6"
                strokeWidth="10"
                fill="none"
              />
              {/* Progress Circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors.primary}
                strokeWidth="10"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            {/* Center Percentage - Large and Clear */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-5xl font-bold ${colors.text} leading-none`}>
                  {complianceRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
          
          {/* Label Below Circle - Separated */}
          <div className="text-center">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Compliance Rate
            </div>
          </div>
        </div>

        {/* Stats Grid - Premium Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-green-50 to-green-50/50 border border-green-200/60 rounded-xl hover:shadow-md transition-all duration-200">
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-100/30 rounded-full -mr-10 -mt-10"></div>
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-green-200/50">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">Compliant</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {compliantDetections.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                {totalDetections > 0 ? ((compliantDetections / totalDetections) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-red-50 to-red-50/50 border border-red-200/60 rounded-xl hover:shadow-md transition-all duration-200">
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-100/30 rounded-full -mr-10 -mt-10"></div>
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-red-200/50">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">Violations</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {nonCompliantDetections.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                {totalDetections > 0 ? ((nonCompliantDetections / totalDetections) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
          </div>
        </div>

        {/* Total Detections - Minimal Footer */}
        <div className="pt-5 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Total Detections</span>
            <span className="text-lg font-bold text-gray-900">{totalDetections.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
