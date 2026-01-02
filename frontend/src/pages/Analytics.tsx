/**
 * Analytics Page
 * 
 * Comprehensive analytics dashboard with:
 * - Violation trends (time-based)
 * - Compliance rate over time
 * - PPE type breakdown
 * - Top risky cameras/domains
 */

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, PieChart, MapPin } from 'lucide-react'
import { useDomain } from '../context/DomainContext'
import { violationService, type Violation } from '../lib/api/services/violationService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { logger } from '../lib/utils/logger'
import ViolationTrendChart from '../components/dashboard/ViolationTrendChart'
import ComplianceGauge from '../components/dashboard/ComplianceGauge'
import HourlyHeatmap from '../components/dashboard/HourlyHeatmap'
import CustomSelect from '../components/common/CustomSelect'

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

interface ZoneBreakdown {
  location: string
  violations: number
  percentage: number
}

export default function Analytics() {
  const { selectedDomain, domains } = useDomain()
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [ppeBreakdown, setPpeBreakdown] = useState<PPEBreakdown[]>([])
  const [topRiskyCameras, setTopRiskyCameras] = useState<TopRisky[]>([])
  const [complianceRate, setComplianceRate] = useState(0)
  const [totalViolations, setTotalViolations] = useState(0)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [zoneBreakdown, setZoneBreakdown] = useState<ZoneBreakdown[]>([])

  useEffect(() => {
    if (!selectedDomain) return

    const loadAnalytics = async () => {
      setLoading(true)
      setError(null) // Clear previous errors
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

        // Load violations with full datetime format
        // Set start date to beginning of day (00:00:00)
        const startDateTime = new Date(startDate)
        startDateTime.setHours(0, 0, 0, 0)

        // Set end date to end of day (23:59:59)
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)

        const params = {
          domain_id: selectedDomain.id,
          start_date: startDateTime.toISOString(), // Full ISO timestamp
          end_date: endDateTime.toISOString(), // Full ISO timestamp
          limit: 100, // Backend max limit is 100
        }

        // Debug: Log params being sent
        console.log('[Analytics] Fetching violations with params:', params)

        const violationsResponse = await violationService.getAll(params)

        const violations = violationsResponse.items
        setViolations(violations) // Store for chart data preparation
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

        // Calculate zone breakdown
        const zoneCounts = new Map<string, number>()
        violations.forEach((v) => {
          const camera = cameraList.find((c) => c.id === v.camera_id)
          if (camera?.location) {
            const count = zoneCounts.get(camera.location) || 0
            zoneCounts.set(camera.location, count + 1)
          }
        })

        const totalZoneViolations = Array.from(zoneCounts.values()).reduce((sum, count) => sum + count, 0)
        const zoneData: ZoneBreakdown[] = Array.from(zoneCounts.entries())
          .map(([location, violations]) => ({
            location,
            violations,
            percentage: totalZoneViolations > 0 ? (violations / totalZoneViolations) * 100 : 0,
          }))
          .sort((a, b) => b.violations - a.violations)

        setZoneBreakdown(zoneData)
      } catch (err) {
        logger.error('Failed to load analytics', err)
        setError('Failed to load analytics data. Please check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [selectedDomain, dateRange])

  // Prepare chart data
  const hourlyData = useMemo(() => {
    // Aggregate violations by hour (0-23)
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      violations: violations.filter(v =>
        new Date(v.timestamp).getHours() === hour
      ).length
    }))
  }, [violations])

  const trendChartData = useMemo(() => {
    // Format trend data for ViolationTrendChart
    const trendMap = new Map<string, { total: number; hard_hat: number; safety_vest: number }>()

    violations.forEach(v => {
      const date = new Date(v.timestamp).toISOString().split('T')[0]
      const existing = trendMap.get(date) || { total: 0, hard_hat: 0, safety_vest: 0 }

      trendMap.set(date, {
        total: existing.total + 1,
        hard_hat: existing.hard_hat + (v.missing_ppe.some(p => p.type === 'hard_hat') ? 1 : 0),
        safety_vest: existing.safety_vest + (v.missing_ppe.some(p => p.type === 'safety_vest') ? 1 : 0),
      })
    })

    return Array.from(trendMap.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        ...data
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }, [violations])

  const complianceData = useMemo(() => {
    // Calculate compliance statistics
    // In real scenario: total detections vs violations
    // For now: estimate based on violation count
    const violationCount = violations.length
    const estimatedTotalDetections = Math.max(violationCount * 10, 100) // Rough estimate
    const compliantCount = estimatedTotalDetections - violationCount
    const rate = estimatedTotalDetections > 0
      ? (compliantCount / estimatedTotalDetections) * 100
      : 100

    return {
      complianceRate: rate,
      totalDetections: estimatedTotalDetections,
      compliantDetections: compliantCount,
      nonCompliantDetections: violationCount,
    }
  }, [violations])

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

  if (error) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-section-title text-gray-900 mb-2">Error Loading Analytics</h3>
            <p className="text-body text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Retry
            </button>
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
          <h1 className="text-page-title">Analytics</h1>
          <p className="text-caption text-gray-500 mt-1">
            Comprehensive insights and trends for {selectedDomain.icon} {selectedDomain.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomSelect
            value={dateRange}
            onChange={(val) => setDateRange(val as '7d' | '30d' | '90d')}
            options={[
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' }
            ]}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-gray-600 mb-1">Total Violations</p>
              <p className="text-3xl font-bold text-gray-900">{totalViolations}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-gray-600 mb-1">Compliance Rate</p>
              <p className="text-3xl font-bold text-gray-900">{complianceRate.toFixed(1)}%</p>
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
              <p className="text-caption text-gray-600 mb-1">Active Cameras</p>
              <p className="text-3xl font-bold text-gray-900">
                {cameras.filter((c) => c.is_active).length}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-[#405189]" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-gray-600 mb-1">Avg. Daily Violations</p>
              <p className="text-3xl font-bold text-gray-900">
                {trendData.length > 0
                  ? (totalViolations / trendData.length).toFixed(1)
                  : '0'}
              </p>
            </div>
            <PieChart className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {!loading && violations.length > 0 && (
        <>
          {/* Compliance Gauge & Hourly Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ComplianceGauge
              complianceRate={complianceData.complianceRate}
              totalDetections={complianceData.totalDetections}
              compliantDetections={complianceData.compliantDetections}
              nonCompliantDetections={complianceData.nonCompliantDetections}
            />
            <HourlyHeatmap data={hourlyData} title="Hourly Violation Distribution" />
          </div>

          {/* Violation Trend Chart - Full Width */}
          <ViolationTrendChart
            data={trendChartData}
            type="area"
            title="Violation Trends Over Time"
          />
        </>
      )}

      {loading ? (
        <div className="space-y-6">
          {/* Loading skeleton for charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
          <div className="card animate-pulse">
            <div className="h-80 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        className="bg-[#405189] h-full rounded-full transition-all"
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
                        className="bg-[#F06548] h-2 rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Violations by Zone */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Violations by Zone</h3>
            <div className="space-y-4">
              {zoneBreakdown.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No zone data available</p>
                  <p className="text-xs mt-1">Configure camera locations in settings</p>
                </div>
              ) : (
                zoneBreakdown.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#405189]" />
                        {item.location}
                      </span>
                      <span className="text-sm text-gray-600">
                        {item.violations} ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-[#405189] h-2 rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Risky Cameras */}
          <div className="card lg:col-span-3">
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
                      <div className="w-10 h-10 bg-[#F06548]/10 rounded-full flex items-center justify-center text-[#F06548] font-semibold">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{camera.name}</p>
                        <p className="text-xs text-gray-500">Camera ID: {camera.id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-[#F06548]">{camera.violations}</p>
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
