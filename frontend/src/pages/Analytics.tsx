/**
 * Professional Analytics Page
 * 
 * Comprehensive analytics dashboard with:
 * - Real-time KPI metrics with trends
 * - Advanced violation trend analysis
 * - Compliance rate tracking
 * - PPE type breakdown with visualizations
 * - Camera performance metrics
 * - Zone-based analysis
 * - Export capabilities
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  BarChart3, 
  PieChart as PieChartIcon, 
  MapPin, 
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  HardHat,
  Shield,
  Camera as CameraIcon
} from 'lucide-react'
import { useDomain } from '../context/DomainContext'
import { useAuth } from '../context/AuthContext'
import { canAccessPage, type UserRole } from '../lib/utils/permissions'
import { violationService, type ViolationStatistics, type Violation } from '../lib/api/services'
import { cameraService, type Camera } from '../lib/api/services'
import { domainService, type Domain } from '../lib/api/services'
import { logger } from '../lib/utils/logger'
import ViolationTrendChart from '../components/dashboard/ViolationTrendChart'
import ComplianceGauge from '../components/dashboard/ComplianceGauge'
import HourlyHeatmap from '../components/dashboard/HourlyHeatmap'
import PieChart from '../components/dashboard/PieChart'
import BarChart from '../components/dashboard/BarChart'
import LineChart from '../components/dashboard/LineChart'
import RadarChart from '../components/dashboard/RadarChart'
import CustomSelect from '../components/common/CustomSelect'
import KPICard from '../components/dashboard/KPICard'
import PermissionGate from '../components/common/PermissionGate'
import MultiSelect from '../components/common/MultiSelect'
import { exportToPDF, exportToExcel } from '../lib/utils/export'

interface TrendData {
  date: string
  violations: number
  hard_hat: number
  safety_vest: number
}

interface PPEBreakdown {
  type: string
  count: number
  percentage: number
  trend?: 'up' | 'down' | 'stable'
}

interface CameraPerformance {
  id: number
  name: string
  violations: number
  complianceRate: number
  location?: string
}

export default function Analytics() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { selectedDomain } = useDomain()
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [stats, setStats] = useState<ViolationStatistics | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [allCameras, setAllCameras] = useState<Camera[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [previousPeriodStats, setPreviousPeriodStats] = useState<ViolationStatistics | null>(null)
  
  // Advanced filtering states
  const [selectedDomainIds, setSelectedDomainIds] = useState<number[]>([])
  const [selectedCameraIds, setSelectedCameraIds] = useState<number[]>([])
  const [selectedPPETypes, setSelectedPPETypes] = useState<string[]>([])
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  // Check access on mount
  useEffect(() => {
    if (user && !canAccessPage(user.role as UserRole, 'analytics')) {
      navigate('/')
    }
  }, [user, navigate])

  // Calculate date ranges
  const dateRanges = useMemo(() => {
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)
    
    let startDate = new Date()
    let previousStartDate = new Date()
    let previousEndDate = new Date()
    
    switch (dateRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        previousStartDate.setDate(previousStartDate.getDate() - 14)
        previousEndDate.setDate(previousEndDate.getDate() - 8)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        previousStartDate.setDate(previousStartDate.getDate() - 60)
        previousEndDate.setDate(previousEndDate.getDate() - 31)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        previousStartDate.setDate(previousStartDate.getDate() - 180)
        previousEndDate.setDate(previousEndDate.getDate() - 91)
        break
      default:
        // Custom range - use last 30 days as default
        startDate.setDate(startDate.getDate() - 30)
        previousStartDate.setDate(previousStartDate.getDate() - 60)
        previousEndDate.setDate(previousEndDate.getDate() - 31)
    }
    
    startDate.setHours(0, 0, 0, 0)
    previousStartDate.setHours(0, 0, 0, 0)
    previousEndDate.setHours(23, 59, 59, 999)
    
    return {
      current: { start: startDate, end: endDate },
      previous: { start: previousStartDate, end: previousEndDate }
    }
  }, [dateRange])

  // Load domains and cameras on mount
  useEffect(() => {
    if (!user) return

    const loadInitialData = async () => {
      try {
        // Load all organization domains
        const orgDomains = await domainService.getOrganizationDomains(user.organization_id)
        setDomains(orgDomains)
        
        // If selectedDomain exists, set it as default filter
        if (selectedDomain) {
          setSelectedDomainIds([selectedDomain.id])
        } else if (orgDomains.length > 0) {
          // Default to all domains if no selection
          setSelectedDomainIds(orgDomains.map(d => d.id))
        }

        // Load all cameras from all domains
        const allCams: Camera[] = []
        for (const domain of orgDomains) {
          try {
            const domainCameras = await cameraService.getAll(domain.id)
            allCams.push(...domainCameras)
          } catch (err) {
            logger.error(`Failed to load cameras for domain ${domain.id}`, err)
          }
        }
        setAllCameras(allCams)
      } catch (err) {
        logger.error('Failed to load initial data', err)
      }
    }

    loadInitialData()
  }, [user, selectedDomain])

  // Load analytics data when filters change
  useEffect(() => {
    if (!user || selectedDomainIds.length === 0) return

    const loadAnalytics = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Use first selected domain for stats (or aggregate if needed)
        const domainIdForStats = selectedDomainIds[0]
        
        // Load current period statistics
        const currentStats = await violationService.getStatistics(
          domainIdForStats,
          dateRanges.current.start.toISOString(),
          dateRanges.current.end.toISOString()
        )
        setStats(currentStats)

        // Load previous period statistics for comparison
        const prevStats = await violationService.getStatistics(
          domainIdForStats,
          dateRanges.previous.start.toISOString(),
          dateRanges.previous.end.toISOString()
        )
        setPreviousPeriodStats(prevStats)

        // Build violation filters
        const violationFilters: any = {
          start_date: dateRanges.current.start.toISOString(),
          end_date: dateRanges.current.end.toISOString(),
          limit: 100, // Backend max limit
        }

        // Apply filters
        if (selectedDomainIds.length === 1) {
          violationFilters.domain_id = selectedDomainIds[0]
        }
        if (selectedCameraIds.length > 0 && selectedCameraIds.length === 1) {
          violationFilters.camera_id = selectedCameraIds[0]
        }
        if (selectedPPETypes.length > 0 && selectedPPETypes.length === 1) {
          violationFilters.missing_ppe_type = selectedPPETypes[0]
        }
        if (selectedSeverities.length > 0 && selectedSeverities.length === 1) {
          violationFilters.severity = selectedSeverities[0]
        }
        if (selectedStatuses.length > 0 && selectedStatuses.length === 1) {
          violationFilters.status = selectedStatuses[0]
        }

        // Load violations for detailed analysis
        const violationsResponse = await violationService.getAll(violationFilters)
        let filteredViolations = violationsResponse.items

        // Apply multi-select filters on frontend (backend only supports single values)
        if (selectedDomainIds.length > 1) {
          filteredViolations = filteredViolations.filter(v => selectedDomainIds.includes(v.domain_id))
        }
        if (selectedCameraIds.length > 1) {
          filteredViolations = filteredViolations.filter(v => selectedCameraIds.includes(v.camera_id))
        }
        if (selectedPPETypes.length > 1) {
          filteredViolations = filteredViolations.filter(v => 
            v.missing_ppe.some(ppe => selectedPPETypes.includes(ppe.type))
          )
        }
        if (selectedSeverities.length > 1) {
          filteredViolations = filteredViolations.filter(v => selectedSeverities.includes(v.severity))
        }
        if (selectedStatuses.length > 1) {
          filteredViolations = filteredViolations.filter(v => selectedStatuses.includes(v.status))
        }

        setViolations(filteredViolations)

        // Load cameras for selected domains
        const filteredCameras: Camera[] = []
        for (const domainId of selectedDomainIds) {
          try {
            const domainCameras = await cameraService.getAll(domainId)
            filteredCameras.push(...domainCameras)
          } catch (err) {
            logger.error(`Failed to load cameras for domain ${domainId}`, err)
          }
        }
        setCameras(filteredCameras)
      } catch (err) {
        logger.error('Failed to load analytics', err)
        setError('Failed to load analytics data. Please check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [user, selectedDomainIds, selectedCameraIds, selectedPPETypes, selectedSeverities, selectedStatuses, dateRanges])

  // Calculate trend percentages
  const calculateTrend = (current: number, previous: number): { value: number; direction: 'up' | 'down' | 'stable' } => {
    if (previous === 0) {
      return { value: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'stable' }
    }
    const change = ((current - previous) / previous) * 100
    if (Math.abs(change) < 1) return { value: 0, direction: 'stable' }
    return {
      value: Math.abs(change),
      direction: change > 0 ? 'up' : 'down'
    }
  }

  // Calculate KPI trends
  const kpiTrends = useMemo(() => {
    if (!stats || !previousPeriodStats) return null
    
    return {
      total: calculateTrend(stats.total, previousPeriodStats.total),
      critical: calculateTrend(stats.critical, previousPeriodStats.critical),
      compliance: calculateTrend(stats.compliance_rate, previousPeriodStats.compliance_rate),
    }
  }, [stats, previousPeriodStats])

  // Prepare trend chart data
  const trendChartData = useMemo(() => {
    const trendMap = new Map<string, { total: number; hard_hat: number; safety_vest: number }>()

    violations.forEach(v => {
      const date = new Date(v.timestamp).toISOString().split('T')[0]
      const existing = trendMap.get(date) || { total: 0, hard_hat: 0, safety_vest: 0 }

      const hasHardHat = v.missing_ppe.some(p => p.type === 'hard_hat')
      const hasSafetyVest = v.missing_ppe.some(p => p.type === 'safety_vest')

      trendMap.set(date, {
        total: existing.total + 1,
        hard_hat: existing.hard_hat + (hasHardHat ? 1 : 0),
        safety_vest: existing.safety_vest + (hasSafetyVest ? 1 : 0),
      })
    })

    return Array.from(trendMap.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        ...data
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }, [violations])

  // Prepare hourly heatmap data
  const hourlyData = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      violations: violations.filter(v =>
        new Date(v.timestamp).getHours() === hour
      ).length
    }))
  }, [violations])

  // Helper function for PPE display names (must be defined before useMemo hooks that use it)
  const getPPEDisplayName = (type: string) => {
    const names: Record<string, string> = {
      hard_hat: 'Hard Hat',
      safety_vest: 'Safety Vest',
      safety_glasses: 'Safety Glasses',
      face_mask: 'Face Mask',
      safety_boots: 'Safety Boots',
      gloves: 'Gloves',
    }
    return names[type] || type.replace('_', ' ')
  }

  // Prepare PPE breakdown
  const ppeBreakdown = useMemo(() => {
    const ppeCounts = new Map<string, number>()
    violations.forEach((v) => {
      v.missing_ppe.forEach((ppe) => {
        const count = ppeCounts.get(ppe.type) || 0
        ppeCounts.set(ppe.type, count + 1)
      })
    })

    const total = violations.length
    return Array.from(ppeCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [violations])

  // Prepare PPE breakdown for PieChart
  const ppePieData = useMemo(() => {
    return ppeBreakdown.map(item => ({
      name: getPPEDisplayName(item.type),
      value: item.count,
    }))
  }, [ppeBreakdown])

  // Prepare severity breakdown for PieChart
  const severityPieData = useMemo(() => {
    if (!stats) return []
    const data = []
    if (stats.critical > 0) data.push({ name: 'Critical', value: stats.critical, color: '#ef4444' })
    if (stats.high > 0) data.push({ name: 'High', value: stats.high, color: '#f59e0b' })
    if (stats.medium > 0) data.push({ name: 'Medium', value: stats.medium, color: '#eab308' })
    if (stats.low > 0) data.push({ name: 'Low', value: stats.low, color: '#3b82f6' })
    return data
  }, [stats])

  // Status options (must be defined before useMemo hooks that use it)
  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'closed', label: 'Closed' },
    { value: 'false_positive', label: 'False Positive' },
  ]

  // Prepare violation status breakdown
  const violationStatusData = useMemo(() => {
    const statusCounts = new Map<string, number>()
    violations.forEach(v => {
      const count = statusCounts.get(v.status) || 0
      statusCounts.set(v.status, count + 1)
    })
    return Array.from(statusCounts.entries()).map(([status, count]) => ({
      name: statusOptions.find(opt => opt.value === status)?.label || status,
      value: count,
    }))
  }, [violations])

  // Prepare compliance trend data
  const complianceTrendData = useMemo(() => {
    const trendMap = new Map<string, number>()
    violations.forEach(v => {
      const date = new Date(v.timestamp).toISOString().split('T')[0]
      const existing = trendMap.get(date) || 0
      trendMap.set(date, existing + 1)
    })

    // Calculate compliance rate per day (estimated)
    return Array.from(trendMap.entries())
      .map(([date, violationCount]) => {
        // Estimate: assume 100 detections per violation for compliance calculation
        const estimatedDetections = violationCount * 100
        const complianceRate = estimatedDetections > 0
          ? ((estimatedDetections - violationCount) / estimatedDetections) * 100
          : 100
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          'Compliance Rate': Math.round(complianceRate * 10) / 10,
        }
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [violations])


  // Prepare domain comparison data
  const domainComparisonData = useMemo(() => {
    const domainViolations = new Map<number, number>()
    violations.forEach(v => {
      const count = domainViolations.get(v.domain_id) || 0
      domainViolations.set(v.domain_id, count + 1)
    })

    return selectedDomainIds.map(domainId => {
      const domain = domains.find(d => d.id === domainId)
      return {
        name: domain?.name || `Domain ${domainId}`,
        'Violations': domainViolations.get(domainId) || 0,
      }
    })
  }, [violations, selectedDomainIds, domains])

  // Prepare weekly trend data
  const weeklyTrendData = useMemo(() => {
    const weekMap = new Map<string, { total: number; hard_hat: number; safety_vest: number }>()
    
    violations.forEach(v => {
      const date = new Date(v.timestamp)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const weekKey = weekStart.toISOString().split('T')[0]
      
      const existing = weekMap.get(weekKey) || { total: 0, hard_hat: 0, safety_vest: 0 }
      const hasHardHat = v.missing_ppe.some(p => p.type === 'hard_hat')
      const hasSafetyVest = v.missing_ppe.some(p => p.type === 'safety_vest')

      weekMap.set(weekKey, {
        total: existing.total + 1,
        hard_hat: existing.hard_hat + (hasHardHat ? 1 : 0),
        safety_vest: existing.safety_vest + (hasSafetyVest ? 1 : 0),
      })
    })

    return Array.from(weekMap.entries())
      .map(([weekKey, data]) => ({
        date: new Date(weekKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        'Total': data.total,
        'Hard Hat': data.hard_hat,
        'Safety Vest': data.safety_vest,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [violations])

  // Prepare monthly trend data
  const monthlyTrendData = useMemo(() => {
    const monthMap = new Map<string, { total: number; hard_hat: number; safety_vest: number }>()
    
    violations.forEach(v => {
      const date = new Date(v.timestamp)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const existing = monthMap.get(monthKey) || { total: 0, hard_hat: 0, safety_vest: 0 }
      const hasHardHat = v.missing_ppe.some(p => p.type === 'hard_hat')
      const hasSafetyVest = v.missing_ppe.some(p => p.type === 'safety_vest')

      monthMap.set(monthKey, {
        total: existing.total + 1,
        hard_hat: existing.hard_hat + (hasHardHat ? 1 : 0),
        safety_vest: existing.safety_vest + (hasSafetyVest ? 1 : 0),
      })
    })

    return Array.from(monthMap.entries())
      .map(([monthKey, data]) => ({
        date: new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        'Total': data.total,
        'Hard Hat': data.hard_hat,
        'Safety Vest': data.safety_vest,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [violations])

  // Prepare camera performance data
  const cameraPerformance = useMemo(() => {
    const cameraCounts = new Map<number, number>()
    violations.forEach((v) => {
      const count = cameraCounts.get(v.camera_id) || 0
      cameraCounts.set(v.camera_id, count + 1)
    })

    return cameras
      .map((camera) => {
        const violationsCount = cameraCounts.get(camera.id) || 0
        // Estimate compliance rate (in real scenario, use actual detection count)
        const estimatedDetections = violationsCount * 10
        const complianceRate = estimatedDetections > 0
          ? ((estimatedDetections - violationsCount) / estimatedDetections) * 100
          : 100

        return {
          id: camera.id,
          name: camera.name,
          violations: violationsCount,
          complianceRate,
          location: camera.location,
        }
      })
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 5)
  }, [violations, cameras])

  // Prepare camera performance bar chart data
  const cameraPerformanceBarData = useMemo(() => {
    return cameraPerformance.slice(0, 10).map(camera => ({
      name: camera.name.length > 15 ? camera.name.substring(0, 15) + '...' : camera.name,
      'Violations': camera.violations,
      'Compliance Rate': Math.round(camera.complianceRate),
    }))
  }, [cameraPerformance])

  // Prepare compliance data for gauge
  const complianceData = useMemo(() => {
    if (!stats) {
      return {
        complianceRate: 100,
        totalDetections: 0,
        compliantDetections: 0,
        nonCompliantDetections: 0,
      }
    }

    // Estimate total detections based on violations
    const estimatedTotalDetections = Math.max(stats.total * 10, 100)
    const compliantCount = estimatedTotalDetections - stats.total

    return {
      complianceRate: stats.compliance_rate || 100,
      totalDetections: estimatedTotalDetections,
      compliantDetections: compliantCount,
      nonCompliantDetections: stats.total,
    }
  }, [stats])

  // Calculate average daily violations
  const avgDailyViolations = useMemo(() => {
    const days = Math.max(1, Math.floor((dateRanges.current.end.getTime() - dateRanges.current.start.getTime()) / (1000 * 60 * 60 * 24)))
    return stats ? (stats.total / days).toFixed(1) : '0.0'
  }, [stats, dateRanges])

  const getPPEIcon = (type: string) => {
    switch (type) {
      case 'hard_hat':
        return <HardHat className="w-4 h-4" />
      case 'safety_vest':
        return <Shield className="w-4 h-4" />
      default:
        return null
    }
  }

  // Prepare filter options
  const domainOptions = useMemo(() => {
    return domains.map(d => ({ value: d.id, label: d.name }))
  }, [domains])

  const cameraOptions = useMemo(() => {
    return cameras.map(c => ({ value: c.id, label: c.name }))
  }, [cameras])

  const ppeTypeOptions = useMemo(() => {
    const types = new Set<string>()
    violations.forEach(v => {
      v.missing_ppe.forEach(ppe => types.add(ppe.type))
    })
    return Array.from(types).map(type => ({
      value: type,
      label: getPPEDisplayName(type)
    }))
  }, [violations])

  const severityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]

  if (!user) {
    return null
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-[#405189]" />
              Analytics
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Comprehensive insights, trends, and compliance analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CustomSelect
              value={dateRange}
              onChange={(val) => setDateRange(val as '7d' | '30d' | '90d' | 'custom')}
              options={[
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: '90d', label: 'Last 90 days' },
              ]}
            />
            <PermissionGate roles={['super_admin', 'admin', 'manager']}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    exportToPDF({
                      kpis: stats ? {
                        totalViolations: stats.total,
                        criticalViolations: stats.critical,
                        complianceRate: stats.compliance_rate || 0,
                        avgDailyViolations: parseFloat(avgDailyViolations),
                      } : undefined,
                      violations: violations.slice(0, 100),
                      cameras: cameras,
                      dateRange: {
                        start: dateRanges.current.start,
                        end: dateRanges.current.end,
                      },
                      filters: {
                        domains: selectedDomainIds.map(id => domains.find(d => d.id === id)?.name || '').filter(Boolean),
                        cameras: selectedCameraIds.map(id => cameras.find(c => c.id === id)?.name || '').filter(Boolean),
                        ppeTypes: selectedPPETypes,
                        severities: selectedSeverities,
                        statuses: selectedStatuses,
                      },
                    })
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={() => {
                    exportToExcel({
                      kpis: stats ? {
                        totalViolations: stats.total,
                        criticalViolations: stats.critical,
                        complianceRate: stats.compliance_rate || 0,
                        avgDailyViolations: parseFloat(avgDailyViolations),
                      } : undefined,
                      violations: violations,
                      cameras: cameras,
                      dateRange: {
                        start: dateRanges.current.start,
                        end: dateRanges.current.end,
                      },
                    })
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Excel
                </button>
              </div>
            </PermissionGate>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-section-title text-gray-900">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Domain Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <MultiSelect
                value={selectedDomainIds}
                onChange={(values) => setSelectedDomainIds(values as number[])}
                options={domainOptions}
                placeholder="All Domains"
              />
            </div>

            {/* Camera Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
              <MultiSelect
                value={selectedCameraIds}
                onChange={(values) => setSelectedCameraIds(values as number[])}
                options={cameraOptions}
                placeholder="All Cameras"
                disabled={selectedDomainIds.length === 0}
              />
            </div>

            {/* PPE Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PPE Type</label>
              <MultiSelect
                value={selectedPPETypes}
                onChange={(values) => setSelectedPPETypes(values as string[])}
                options={ppeTypeOptions}
                placeholder="All PPE Types"
              />
            </div>

            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <MultiSelect
                value={selectedSeverities}
                onChange={(values) => setSelectedSeverities(values as string[])}
                options={severityOptions}
                placeholder="All Severities"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <MultiSelect
                value={selectedStatuses}
                onChange={(values) => setSelectedStatuses(values as string[])}
                options={statusOptions}
                placeholder="All Statuses"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards with Trends */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <KPICard
            title="Total Violations"
            value={stats?.total?.toLocaleString() || '0'}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="danger"
            trend={kpiTrends?.total}
          />
          <KPICard
            title="Critical Violations"
            value={stats?.critical?.toLocaleString() || '0'}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="danger"
            trend={kpiTrends?.critical}
          />
          <KPICard
            title="Compliance Rate"
            value={`${stats?.compliance_rate?.toFixed(1) || '100.0'}%`}
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="success"
            trend={kpiTrends?.compliance}
          />
          <KPICard
            title="Avg. Daily Violations"
            value={avgDailyViolations}
            icon={<BarChart3 className="w-6 h-6" />}
            color="info"
          />
        </div>
      )}

      {/* Compliance Overview Section */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ComplianceGauge
            complianceRate={complianceData.complianceRate}
            totalDetections={complianceData.totalDetections}
            compliantDetections={complianceData.compliantDetections}
            nonCompliantDetections={complianceData.nonCompliantDetections}
          />
          {complianceTrendData.length > 0 && (
            <LineChart
              data={complianceTrendData}
              title="Compliance Rate Trend"
              lines={[
                { dataKey: 'Compliance Rate', name: 'Compliance Rate', color: '#10b981' }
              ]}
              xAxisKey="date"
              showArea={true}
            />
          )}
        </div>
      )}

      {/* Violation Analysis Section */}
      {!loading && violations.length > 0 && (
        <>
          {/* Violation Trend Chart - Full Width */}
          <ViolationTrendChart
            data={trendChartData}
            type="area"
            title="Violation Trends Over Time"
          />

          {/* Violation Distribution & Hourly Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {severityPieData.length > 0 && (
              <PieChart
                data={severityPieData}
                title="Violation Distribution by Severity"
                variant="donut"
              />
            )}
            <HourlyHeatmap data={hourlyData} title="Hourly Violation Distribution" />
          </div>
        </>
      )}

      {/* Detailed Breakdown Section */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PPE Type Breakdown - Donut Chart */}
          {ppePieData.length > 0 ? (
            <PieChart
              data={ppePieData}
              title="PPE Type Breakdown"
              variant="donut"
            />
          ) : (
            <div className="card">
              <h3 className="text-section-title text-gray-900 mb-4">PPE Type Breakdown</h3>
              <div className="text-center py-12 text-gray-500">
                <p className="text-body">No PPE violations in the selected period</p>
              </div>
            </div>
          )}

          {/* Violation Status Breakdown */}
          {violationStatusData.length > 0 ? (
            <PieChart
              data={violationStatusData}
              title="Violation Status Breakdown"
              variant="pie"
            />
          ) : (
            <div className="card">
              <h3 className="text-section-title text-gray-900 mb-4">Violation Status Breakdown</h3>
              <div className="text-center py-12 text-gray-500">
                <p className="text-body">No status data available</p>
              </div>
            </div>
          )}

          {/* Top Risky Cameras */}
          <div className="card">
            <h3 className="text-section-title text-gray-900 mb-4">Top Risky Cameras</h3>
            <div className="space-y-3">
              {cameraPerformance.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CameraIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-body">No camera violations in the selected period</p>
                </div>
              ) : (
                cameraPerformance.map((camera, idx) => (
                  <div
                    key={camera.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-red-500 text-white' :
                        idx === 1 ? 'bg-orange-500 text-white' :
                        'bg-yellow-500 text-white'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{camera.name}</p>
                        {camera.location && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {camera.location}
                          </p>
                        )}
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

      {/* Performance Analysis Section */}
      {!loading && violations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Performance Comparison */}
          {cameraPerformanceBarData.length > 0 && (
            <BarChart
              data={cameraPerformanceBarData}
              title="Camera Performance Comparison"
              orientation="horizontal"
              bars={[
                { dataKey: 'Violations', name: 'Violations', color: '#ef4444' }
              ]}
            />
          )}

          {/* Domain Comparison */}
          {domainComparisonData.length > 0 && selectedDomainIds.length > 1 && (
            <BarChart
              data={domainComparisonData}
              title="Domain Comparison"
              orientation="vertical"
              bars={[
                { dataKey: 'Violations', name: 'Violations', color: '#8b5cf6' }
              ]}
            />
          )}
        </div>
      )}

      {/* Trend Analysis Section */}
      {!loading && violations.length > 0 && (
        <div className="space-y-6">
          {/* Weekly Trend */}
          {weeklyTrendData.length > 0 && (
            <LineChart
              data={weeklyTrendData}
              title="Weekly Violation Trends"
              lines={[
                { dataKey: 'Total', name: 'Total', color: '#8b5cf6' },
                { dataKey: 'Hard Hat', name: 'Hard Hat', color: '#ef4444' },
                { dataKey: 'Safety Vest', name: 'Safety Vest', color: '#f59e0b' }
              ]}
              xAxisKey="date"
              showArea={true}
            />
          )}

          {/* Monthly Trend */}
          {monthlyTrendData.length > 0 && (
            <LineChart
              data={monthlyTrendData}
              title="Monthly Violation Trends"
              lines={[
                { dataKey: 'Total', name: 'Total', color: '#8b5cf6' },
                { dataKey: 'Hard Hat', name: 'Hard Hat', color: '#ef4444' },
                { dataKey: 'Safety Vest', name: 'Safety Vest', color: '#f59e0b' }
              ]}
              xAxisKey="date"
              showArea={true}
            />
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && violations.length === 0 && (
        <div className="card">
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
            <h3 className="text-section-title text-gray-900 mb-2">No Violations Found</h3>
            <p className="text-body text-gray-600">
              No violations detected in the selected time period. Great job maintaining compliance!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
