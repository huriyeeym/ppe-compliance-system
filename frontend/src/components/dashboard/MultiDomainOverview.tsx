/**
 * Multi-Domain Overview Component
 * 
 * Displays system-wide statistics across all domains
 * Shows domain comparison, top violators, and overall health
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, BarChart3, MapPin, Activity } from 'lucide-react'
import { domainService, type Domain } from '../../lib/api/services/domainService'
import { violationService, type ViolationStatistics } from '../../lib/api/services/violationService'
import { cameraService, type Camera } from '../../lib/api/services'
import { useDomain } from '../../context/DomainContext'
import { logger } from '../../lib/utils/logger'

interface DomainStats extends Domain {
  stats: ViolationStatistics
  cameraCount: number
  activeCameras: number
  todayViolations: number
  complianceRate: number
}

interface MultiDomainOverviewProps {
  onDomainSelect?: (domain: Domain) => void
}

export default function MultiDomainOverview({ onDomainSelect }: MultiDomainOverviewProps) {
  // Use domains from DomainContext (user's selected domains)
  const { domains: userDomains } = useDomain()
  const [domainStats, setDomainStats] = useState<DomainStats[]>([])
  const [systemStats, setSystemStats] = useState({
    totalDomains: 0,
    activeDomeras: 0,
    totalCameras: 0,
    totalViolations: 0,
    avgComplianceRate: 0,
    criticalViolations: 0,
  })
  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'overview' | 'comparison'>('overview')

  useEffect(() => {
    if (userDomains.length > 0) {
      loadData()
      const interval = setInterval(loadData, 60000) // Refresh every minute
      return () => clearInterval(interval)
    } else {
      // If no domains, set loading to false
      setLoading(false)
    }
  }, [userDomains])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Use user's selected domains from DomainContext
      // These are already filtered to only show the 4 integrated domains that the user selected
      const domains = userDomains

      // Load statistics for each domain (use user's selected domains)
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
            limit: 1,
          })

          return {
            ...domain,
            stats,
            cameraCount: cameras.length,
            activeCameras: cameras.filter(c => c.is_active).length,
            todayViolations: todayResponse.total,
            complianceRate: stats.compliance_rate || 0,
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
            complianceRate: 0,
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

      setSystemStats({
        totalDomains: domains.length,
        activeCameras: activeCameras,
        totalCameras,
        totalViolations,
        avgComplianceRate,
        criticalViolations,
      })
    } catch (err) {
      logger.error('Error loading multi-domain overview', err)
    } finally {
      setLoading(false)
    }
  }

  // Sort domains by violations (top violators first)
  const topViolators = [...domainStats].sort((a, b) => (b.stats?.total ?? 0) - (a.stats?.total ?? 0)).slice(0, 5)

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* System-Wide Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedView('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedView === 'overview'
              ? 'bg-[#405189] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setSelectedView('comparison')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedView === 'comparison'
              ? 'bg-[#405189] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Comparison
        </button>
      </div>

      {/* Domain Overview Grid */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {domainStats.map((domain) => (
            <div
              key={domain.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onDomainSelect?.(domain)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#405189]/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-[#405189]" />
                  </div>
                  <div>
                    <h3 className="text-body font-semibold text-gray-900">{domain.name}</h3>
                    <p className="text-caption text-gray-500">{domain.type}</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    domain.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {domain.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-caption text-gray-600">Compliance Rate</span>
                  <span className={`text-body font-semibold ${
                    domain.complianceRate >= 95 ? 'text-green-600' :
                    domain.complianceRate >= 80 ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {domain.complianceRate.toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption text-gray-600">Total Violations</span>
                  <span className="text-body font-semibold text-gray-900">
                    {(domain.stats?.total ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption text-gray-600">Critical</span>
                  <span className="text-body font-semibold text-red-600">
                    {domain.stats?.critical ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption text-gray-600">Cameras</span>
                  <span className="text-body font-semibold text-gray-900">
                    {domain.activeCameras}/{domain.cameraCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption text-gray-600">Today</span>
                  <span className="text-body font-semibold text-gray-900">
                    {domain.todayViolations}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  to={`/dashboard`}
                  onClick={() => onDomainSelect?.(domain)}
                  className="text-sm text-[#405189] hover:text-[#364574] font-medium"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Domain Comparison Table */}
      {selectedView === 'comparison' && (
        <div className="card">
          <h3 className="text-section-title mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Domain Comparison
          </h3>
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
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => onDomainSelect?.(domain)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#405189]" />
                        <span className="text-body font-medium text-gray-900">{domain.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`text-body font-semibold ${
                        domain.complianceRate >= 95 ? 'text-green-600' :
                        domain.complianceRate >= 80 ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {domain.complianceRate.toFixed(0)}%
                      </span>
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
      )}

      {/* Top Violators */}
      {topViolators.length > 0 && (
        <div className="card">
          <h3 className="text-section-title mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Top Domains by Violations
          </h3>
          <div className="space-y-3">
            {topViolators.map((domain, index) => (
              <div
                key={domain.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => onDomainSelect?.(domain)}
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
                  <div>
                    <p className="text-body font-medium text-gray-900">{domain.name}</p>
                    <p className="text-caption text-gray-500">{domain.type}</p>
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
      )}
    </div>
  )
}

