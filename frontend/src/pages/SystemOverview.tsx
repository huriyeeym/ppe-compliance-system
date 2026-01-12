import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Globe, 
  Building2, 
  Loader, 
  AlertTriangle, 
  CheckCircle2, 
  BarChart3, 
  Activity,
  Construction,
  Factory,
  Warehouse,
  Pickaxe,
  TrendingUp,
  TrendingDown,
  Clock,
  Eye,
  ArrowRight,
  Circle
} from 'lucide-react'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { violationService, type ViolationStatistics, type Violation } from '../lib/api/services/violationService'
import { cameraService, type Camera } from '../lib/api/services'
import { useAuth } from '../context/AuthContext'
import { useDomain } from '../context/DomainContext'
import { logger } from '../lib/utils/logger'

interface DomainStats extends Domain {
  stats: ViolationStatistics
  cameraCount: number
  activeCameras: number
  todayViolations: number
  complianceRate: number
  criticalToday: number
  healthStatus: 'healthy' | 'warning' | 'critical'
  complianceTrend: number // Percentage change from previous period
}

export default function SystemOverview() {
  const { user } = useAuth()
  const { setSelectedDomain } = useDomain()
  const navigate = useNavigate()
  const [domainStats, setDomainStats] = useState<DomainStats[]>([])
  const [systemStats, setSystemStats] = useState({
    totalDomains: 0,
    activeCameras: 0,
    totalCameras: 0,
    totalViolations: 0,
    avgComplianceRate: 0,
    criticalViolations: 0,
    unacknowledgedViolations: 0,
  })
  const [recentCriticalViolations, setRecentCriticalViolations] = useState<Violation[]>([])
  const [recentActivity, setRecentActivity] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)

  // Helper function to get domain icon - ALL from lucide-react for consistency
  const getDomainIcon = (domainType: string, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-5 h-5',
      md: 'w-8 h-8',
      lg: 'w-12 h-12'
    }
    const sizeClass = sizeClasses[size]
    
    switch (domainType) {
      case 'mining':
        return <Pickaxe className={`${sizeClass} text-[#405189]`} />
      case 'warehouse':
        return <Warehouse className={`${sizeClass} text-[#405189]`} />
      case 'construction':
        return <Construction className={`${sizeClass} text-[#405189]`} />
      case 'manufacturing':
        return <Factory className={`${sizeClass} text-[#405189]`} />
      default:
        return <Building2 className={`${sizeClass} text-[#405189]`} />
    }
  }

  // Calculate domain health status
  const calculateHealthStatus = (complianceRate: number, criticalToday: number): 'healthy' | 'warning' | 'critical' => {
    if (complianceRate >= 95 && criticalToday === 0) return 'healthy'
    if (complianceRate >= 80 && criticalToday <= 2) return 'warning'
    return 'critical'
  }

  // Get health status color and icon
  const getHealthIndicator = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return {
          color: 'text-green-600',
          bg: 'bg-green-100',
          border: 'border-green-200',
          icon: CheckCircle2,
          label: 'Healthy'
        }
      case 'warning':
        return {
          color: 'text-yellow-600',
          bg: 'bg-yellow-100',
          border: 'border-yellow-200',
          icon: AlertTriangle,
          label: 'Warning'
        }
      case 'critical':
        return {
          color: 'text-red-600',
          bg: 'bg-red-100',
          border: 'border-red-200',
          icon: AlertTriangle,
          label: 'Critical'
        }
    }
  }

  useEffect(() => {
    if (user) {
      loadData()
      const interval = setInterval(loadData, 60000) // Refresh every minute
      return () => clearInterval(interval)
    } else {
      setLoading(false)
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load all organization domains (not user-selected)
      let domains: Domain[] = []
      if (user?.organization_id) {
        domains = await domainService.getOrganizationDomains(user.organization_id)
        logger.info(`SystemOverview: Loaded ${domains.length} organization domains`, {
          organization_id: user.organization_id,
          domains: domains.map(d => ({ id: d.id, name: d.name, type: d.type }))
        })
      } else {
        // Fallback: Load active domains
        const activeDomains = await domainService.getActive()
        const allowedDomainTypes = ['construction', 'manufacturing', 'mining', 'warehouse']
        domains = activeDomains.filter(d => allowedDomainTypes.includes(d.type))
      }

      // Load statistics for each domain
      const statsPromises = domains.map(async (domain) => {
        try {
          const [stats, cameras] = await Promise.all([
            violationService.getStatistics(domain.id),
            cameraService.getAll(domain.id),
          ])

          // Get today's violations count
          const todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)
          const todayResponse = await violationService.getAll({
            domain_id: domain.id,
            start_date: todayStart.toISOString(),
            limit: 100,
          })

          // Get critical violations today
          const criticalToday = todayResponse.items.filter(v => v.severity === 'critical').length

          // Calculate compliance trend (last 7 days vs previous 7 days)
          const now = new Date()
          const last7DaysStart = new Date(now)
          last7DaysStart.setDate(now.getDate() - 7)
          const previous7DaysStart = new Date(now)
          previous7DaysStart.setDate(now.getDate() - 14)
          const previous7DaysEnd = new Date(now)
          previous7DaysEnd.setDate(now.getDate() - 7)

          const [last7DaysStats, previous7DaysStats] = await Promise.all([
            violationService.getStatistics(domain.id, last7DaysStart.toISOString(), now.toISOString()),
            violationService.getStatistics(domain.id, previous7DaysStart.toISOString(), previous7DaysEnd.toISOString()),
          ])

          const complianceTrend = previous7DaysStats.compliance_rate > 0
            ? ((last7DaysStats.compliance_rate - previous7DaysStats.compliance_rate) / previous7DaysStats.compliance_rate) * 100
            : 0

          const complianceRate = stats.compliance_rate || 0
          const healthStatus = calculateHealthStatus(complianceRate, criticalToday)

          return {
            ...domain,
            stats,
            cameraCount: cameras.length,
            activeCameras: cameras.filter(c => c.is_active).length,
            todayViolations: todayResponse.total,
            criticalToday,
            complianceRate,
            healthStatus,
            complianceTrend,
          } as DomainStats
        } catch (err) {
          logger.error(`Error loading stats for domain ${domain.id}`, err)
          return {
            ...domain,
            stats: {
              total: 0,
              critical: 0,
              high: 0,
              medium: 0,
              low: 0,
              by_ppe_type: {},
              compliance_rate: 0,
            },
            cameraCount: 0,
            activeCameras: 0,
            todayViolations: 0,
            criticalToday: 0,
            complianceRate: 0,
            healthStatus: 'critical' as const,
            complianceTrend: 0,
          } as DomainStats
        }
      })

      const stats = await Promise.all(statsPromises)
      setDomainStats(stats)

      // Calculate system-wide statistics
      const totalViolations = stats.reduce((sum, d) => sum + (d.stats?.total ?? 0), 0)
      const totalCameras = stats.reduce((sum, d) => sum + d.cameraCount, 0)
      const activeCameras = stats.reduce((sum, d) => sum + d.activeCameras, 0)
      const criticalViolations = stats.reduce((sum, d) => sum + (d.stats?.critical ?? 0), 0)
      const avgComplianceRate = stats.length > 0
        ? stats.reduce((sum, d) => sum + d.complianceRate, 0) / stats.length
        : 0

      // Load recent critical violations (last 24 hours across all domains)
      const last24Hours = new Date()
      last24Hours.setHours(last24Hours.getHours() - 24)
      const recentCriticalResponse = await violationService.getAll({
        severity: 'critical',
        start_date: last24Hours.toISOString(),
        limit: 10,
      })
      setRecentCriticalViolations(recentCriticalResponse.items)

      // Load recent activity (last 10 violations across all domains)
      const recentActivityResponse = await violationService.getAll({
        limit: 10,
      })
      setRecentActivity(recentActivityResponse.items)

      // Count unacknowledged violations
      const unacknowledgedResponse = await violationService.getAll({
        status: 'open',
        limit: 1,
      })

      setSystemStats({
        totalDomains: domains.length,
        activeCameras: activeCameras,
        totalCameras,
        totalViolations,
        avgComplianceRate,
        criticalViolations,
        unacknowledgedViolations: unacknowledgedResponse.total,
      })
    } catch (err) {
      logger.error('Error loading system overview', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDomainSelect = (domain: Domain) => {
    setSelectedDomain(domain)
    navigate('/')
  }

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Sort domains by violations (top violators first)
  const topViolators = [...domainStats].sort((a, b) => (b.stats?.total ?? 0) - (a.stats?.total ?? 0)).slice(0, 5)

  if (loading) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <Loader className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
            <p className="text-body text-gray-600">Loading system overview...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              <Globe className="w-7 h-7 text-[#405189]" />
              System Overview
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Multi-domain PPE compliance monitoring across all sites
            </p>
          </div>
          <Link
            to="/"
            className="btn-secondary flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            Domain View
          </Link>
        </div>
      </div>

      {/* System-Wide Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-gray-600 mb-1">Total Domains</p>
              <p className="text-3xl font-bold text-gray-900">{systemStats.totalDomains}</p>
            </div>
            <Building2 className="w-8 h-8 text-[#405189]" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-gray-600 mb-1">Active Cameras</p>
              <p className="text-3xl font-bold text-gray-900">
                {systemStats.activeCameras}/{systemStats.totalCameras}
              </p>
            </div>
            <Activity className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-gray-600 mb-1">Total Violations</p>
              <p className="text-3xl font-bold text-gray-900">{systemStats.totalViolations.toLocaleString()}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption text-gray-600 mb-1">Avg. Compliance</p>
              <p className="text-3xl font-bold text-gray-900">{systemStats.avgComplianceRate.toFixed(0)}%</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Alert Summary Card */}
      <div className="card bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-section-title text-gray-900 mb-1">Alert Summary</h3>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-caption text-gray-600">Unacknowledged: </span>
                  <span className="text-body font-semibold text-red-600">
                    {systemStats.unacknowledgedViolations}
                  </span>
                </div>
                <div>
                  <span className="text-caption text-gray-600">Critical: </span>
                  <span className="text-body font-semibold text-red-600">
                    {systemStats.criticalViolations}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/events"
              className="btn-primary flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View Events
            </Link>
            <Link
              to="/report"
              className="btn-secondary flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              View Reports
            </Link>
          </div>
        </div>
      </div>

      {/* Domain Overview Grid - 2x2 Layout */}
      <div>
        <h2 className="text-section-title mb-4">Domain Overview</h2>
        {domainStats.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {domainStats.map((domain) => {
              const healthInfo = getHealthIndicator(domain.healthStatus)
              const HealthIcon = healthInfo.icon
              return (
                <div
                  key={domain.id}
                  className="card hover:shadow-lg transition-all cursor-pointer border-2 hover:border-[#405189]/20"
                  onClick={() => handleDomainSelect(domain)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-[#405189]/10 rounded-xl flex items-center justify-center">
                        {getDomainIcon(domain.type, 'lg')}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{domain.name}</h3>
                        <p className="text-caption text-gray-500 capitalize">{domain.type}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded ${
                          domain.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {domain.status}
                      </span>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${healthInfo.bg} ${healthInfo.border}`}>
                        <HealthIcon className={`w-3.5 h-3.5 ${healthInfo.color}`} />
                        <span className={`text-xs font-medium ${healthInfo.color}`}>
                          {healthInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-caption text-gray-600">Compliance Rate</span>
                      <div className="flex items-center gap-2">
                        {domain.complianceTrend !== 0 && (
                          <div className={`flex items-center gap-0.5 ${domain.complianceTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {domain.complianceTrend > 0 ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                            <span className="text-xs font-medium">
                              {Math.abs(domain.complianceTrend).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        <span className={`text-body font-semibold ${
                          domain.complianceRate >= 95 ? 'text-green-600' :
                          domain.complianceRate >= 80 ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          {domain.complianceRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <p className="text-caption text-gray-600 mb-1">Total Violations</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {(domain.stats?.total ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 bg-red-50 rounded-lg">
                        <p className="text-caption text-gray-600 mb-1">Critical</p>
                        <p className="text-lg font-semibold text-red-600">
                          {domain.stats?.critical ?? 0}
                        </p>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <p className="text-caption text-gray-600 mb-1">Cameras</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {domain.activeCameras}/{domain.cameraCount}
                        </p>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <p className="text-caption text-gray-600 mb-1">Today</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {domain.todayViolations}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-[#405189] hover:text-[#364574] font-medium">
                      View Details
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#405189]" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card">
            <p className="text-body text-gray-600 text-center py-8">
              No domains available
            </p>
          </div>
        )}
      </div>

      {/* Recent Critical Violations */}
      {recentCriticalViolations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section-title flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Recent Critical Violations
            </h2>
            <Link
              to="/events"
              className="text-sm text-[#405189] hover:text-[#364574] font-medium flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="card">
            <div className="space-y-2">
              {recentCriticalViolations.slice(0, 5).map((violation) => (
                <div
                  key={violation.id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer border border-red-200"
                  onClick={() => navigate('/events')}
                >
                  <div className="flex items-center gap-3">
                    <Circle className="w-2 h-2 fill-red-600 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {violation.missing_ppe.map(p => p.type).join(', ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(violation.timestamp)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded">
                    CRITICAL
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Domain Comparison Table - Only show if 2+ domains */}
      {domainStats.length >= 2 ? (
        <div>
          <h2 className="text-section-title mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#405189]" />
            Domain Comparison
          </h2>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Domain</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Compliance</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Violations</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Critical</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Cameras</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Today</th>
                  </tr>
                </thead>
                <tbody>
                  {domainStats.map((domain) => (
                    <tr
                      key={domain.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleDomainSelect(domain)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 flex items-center justify-center">
                            {getDomainIcon(domain.type, 'md')}
                          </div>
                          <span className="text-body font-medium text-gray-900">{domain.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {domain.complianceTrend !== 0 && (
                            <div className={`flex items-center ${domain.complianceTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {domain.complianceTrend > 0 ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5" />
                              )}
                            </div>
                          )}
                          <span className={`text-body font-semibold ${
                            domain.complianceRate >= 95 ? 'text-green-600' :
                            domain.complianceRate >= 80 ? 'text-orange-600' :
                            'text-red-600'
                          }`}>
                            {domain.complianceRate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="text-body text-gray-900">{(domain.stats?.total ?? 0).toLocaleString()}</span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="text-body text-red-600">{domain.stats?.critical ?? 0}</span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="text-body text-gray-900">
                          {domain.activeCameras}/{domain.cameraCount}
                        </span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="text-body text-gray-900">{domain.todayViolations}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card bg-gray-50">
          <p className="text-sm text-gray-600 text-center py-4">
            Add more domains to enable comparison view
          </p>
        </div>
      )}

      {/* Top Violators */}
      {topViolators.length > 0 && (
        <div>
          <h2 className="text-section-title mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Top Domains by Violations
          </h2>
          <div className="card">
            <div className="space-y-3">
              {topViolators.map((domain, index) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => handleDomainSelect(domain)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-red-500 text-white' :
                      index === 1 ? 'bg-orange-500 text-white' :
                      index === 2 ? 'bg-yellow-500 text-white' :
                      'bg-gray-300 text-gray-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center">
                        {getDomainIcon(domain.type, 'sm')}
                      </div>
                      <div>
                        <p className="text-body font-medium text-gray-900">{domain.name}</p>
                        <p className="text-caption text-gray-500 capitalize">{domain.type}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-semibold text-red-600">{(domain.stats?.total ?? 0).toLocaleString()}</p>
                    <p className="text-caption text-gray-500">violations</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Feed */}
      {recentActivity.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section-title flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#405189]" />
              Recent Activity
            </h2>
            <Link
              to="/events"
              className="text-sm text-[#405189] hover:text-[#364574] font-medium flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="card">
            <div className="space-y-2">
              {recentActivity.slice(0, 8).map((violation) => {
                const domain = domainStats.find(d => d.id === violation.domain_id)
                return (
                  <div
                    key={violation.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                    onClick={() => navigate('/events')}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 flex items-center justify-center">
                        {domain ? getDomainIcon(domain.type, 'sm') : <Building2 className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {violation.missing_ppe.map(p => p.type).join(', ')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {domain?.name || 'Unknown Domain'}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(violation.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        violation.severity === 'critical' ? 'bg-red-100 text-red-600' :
                        violation.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                        violation.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {violation.severity.toUpperCase()}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
