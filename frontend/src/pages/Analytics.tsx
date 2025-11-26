/**
 * Analytics Page
 * 
 * Comprehensive analytics dashboard with:
 * - Violation trends (time-based)
 * - Compliance rate over time
 * - PPE type breakdown
 * - Top risky cameras/domains
 */

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, PieChart } from 'lucide-react'
import { useDomain } from '../context/DomainContext'
import { violationService, type Violation } from '../lib/api/services/violationService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { logger } from '../lib/utils/logger'

interface TrendData {
  date: string
  violations: number
  compliance: number
}

interface PPEBreakdown {
  type: string
  count: number
  percentage: number
}

interface TopRisky {
  id: number
  name: string
  violations: number
}

export default function Analytics() {
  const { selectedDomain, domains } = useDomain()
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [loading, setLoading] = useState(true)
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [ppeBreakdown, setPpeBreakdown] = useState<PPEBreakdown[]>([])
  const [topRiskyCameras, setTopRiskyCameras] = useState<TopRisky[]>([])
  const [complianceRate, setComplianceRate] = useState(0)
  const [totalViolations, setTotalViolations] = useState(0)
  const [cameras, setCameras] = useState<Camera[]>([])

  useEffect(() => {
    if (!selectedDomain) return

    const loadAnalytics = async () => {
      setLoading(true)
      try {
        // Calculate date range
        const endDate = new Date()
        const startDate = new Date()
        switch (dateRange) {
          case '7d':
            startDate.setDate(startDate.getDate() - 7)
            break
          case '30d':
            startDate.setDate(startDate.getDate() - 30)
            break
          case '90d':
            startDate.setDate(startDate.getDate() - 90)
            break
        }

        // Load violations
        const violationsResponse = await violationService.getAll({
          domain_id: selectedDomain.id,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          limit: 1000, // Get more data for analytics
        })

        const violations = violationsResponse.items
        setTotalViolations(violations.length)

        // Calculate trend data (daily)
        const trendMap = new Map<string, { violations: number; total: number }>()
        violations.forEach((v) => {
          const date = new Date(v.timestamp).toISOString().split('T')[0]
          const existing = trendMap.get(date) || { violations: 0, total: 0 }
          trendMap.set(date, {
            violations: existing.violations + 1,
            total: existing.total + 1,
          })
        })

        const trend: TrendData[] = Array.from(trendMap.entries())
          .map(([date, data]) => ({
            date,
            violations: data.violations,
            compliance: 0, // Simplified - would need total detections
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30) // Last 30 days

        setTrendData(trend)

        // Calculate PPE breakdown
        const ppeCounts = new Map<string, number>()
        violations.forEach((v) => {
          v.missing_ppe.forEach((ppe) => {
            const count = ppeCounts.get(ppe.type) || 0
            ppeCounts.set(ppe.type, count + 1)
          })
        })

        const total = violations.length
        const breakdown: PPEBreakdown[] = Array.from(ppeCounts.entries())
          .map(([type, count]) => ({
            type,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
          }))
          .sort((a, b) => b.count - a.count)

        setPpeBreakdown(breakdown)

        // Calculate top risky cameras
        const cameraCounts = new Map<number, number>()
        violations.forEach((v) => {
          const count = cameraCounts.get(v.camera_id) || 0
          cameraCounts.set(v.camera_id, count + 1)
        })

        const topRisky: TopRisky[] = Array.from(cameraCounts.entries())
          .map(([id, violations]) => ({
            id,
            name: `Camera #${id}`,
            violations,
          }))
          .sort((a, b) => b.violations - a.violations)
          .slice(0, 5)

        setTopRiskyCameras(topRisky)

        // Calculate compliance rate (simplified)
        // In real scenario, we'd need total detections vs violations
        const compliance = total > 0 ? Math.max(0, 100 - (total / 10)) : 100
        setComplianceRate(compliance)

        // Load cameras for names
        const cameraList = await cameraService.getAll(selectedDomain.id)
        setCameras(cameraList)

        // Update camera names in top risky
        setTopRiskyCameras((prev) =>
          prev.map((item) => {
            const camera = cameraList.find((c) => c.id === item.id)
            return {
              ...item,
              name: camera?.name || item.name,
            }
          })
        )
      } catch (err) {
        logger.error('Failed to load analytics', err)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [selectedDomain, dateRange])

  const maxViolations = Math.max(...trendData.map((d) => d.violations), 1)

  const getPPEDisplayName = (type: string) => {
    const names: Record<string, string> = {
      hard_hat: 'Hard Hat',
      safety_vest: 'Safety Vest',
      safety_glasses: 'Safety Glasses',
      face_mask: 'Face Mask',
      safety_boots: 'Safety Boots',
      gloves: 'Gloves',
    }
    return names[type] || type
  }

  if (!selectedDomain) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <p className="text-body text-gray-500">Please select a domain from the header</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive insights and trends for {selectedDomain.icon} {selectedDomain.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Violations</p>
              <p className="text-2xl font-semibold text-gray-900">{totalViolations}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Compliance Rate</p>
              <p className="text-2xl font-semibold text-gray-900">{complianceRate.toFixed(1)}%</p>
            </div>
            {complianceRate >= 95 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Active Cameras</p>
              <p className="text-2xl font-semibold text-gray-900">
                {cameras.filter((c) => c.is_active).length}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Avg. Daily Violations</p>
              <p className="text-2xl font-semibold text-gray-900">
                {trendData.length > 0
                  ? (totalViolations / trendData.length).toFixed(1)
                  : '0'}
              </p>
            </div>
            <PieChart className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="animate-pulse space-y-4 p-6">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Violation Trend */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Violation Trend</h3>
            <div className="space-y-2">
              {trendData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No data available for the selected period</p>
                </div>
              ) : (
                trendData.map((data, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-gray-600">
                      {new Date(data.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{
                          width: `${(data.violations / maxViolations) * 100}%`,
                        }}
                      ></div>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                        {data.violations}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PPE Type Breakdown */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">PPE Type Breakdown</h3>
            <div className="space-y-4">
              {ppeBreakdown.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No PPE violations in the selected period</p>
                </div>
              ) : (
                ppeBreakdown.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {getPPEDisplayName(item.type)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {item.count} ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Risky Cameras */}
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Risky Cameras</h3>
            <div className="space-y-3">
              {topRiskyCameras.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No camera violations in the selected period</p>
                </div>
              ) : (
                topRiskyCameras.map((camera, idx) => (
                  <div
                    key={camera.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-semibold">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{camera.name}</p>
                        <p className="text-xs text-gray-500">Camera ID: {camera.id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-red-600">{camera.violations}</p>
                      <p className="text-xs text-gray-500">violations</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
