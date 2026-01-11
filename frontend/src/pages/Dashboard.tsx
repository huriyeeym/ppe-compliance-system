import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Camera as CameraIcon, Wifi, WifiOff, AlertTriangle, CheckCircle2, Construction, ShieldAlert, Building2, Factory, Warehouse, Pickaxe, Cross, UtensilsCrossed, Loader, Activity, Globe, TrendingUp, TrendingDown, BarChart3, Clock, LayoutDashboard } from 'lucide-react'
import KPICard from '../components/dashboard/KPICard'
import { useDomain } from '../context/DomainContext'
import { cameraService, type Camera } from '../lib/api/services'
import { violationService, type ViolationStatistics, type ViolationCreatePayload, type Violation } from '../lib/api/services'
import { logger } from '../lib/utils/logger'

/**
 * Construction Site Dashboard
 *
 * Real usage scenario:
 * 1. Domain and camera list fetched from API
 * 2. Statistics fetched from API
 * 3. Live video stream started
 * 4. Violations saved to API when detected
 */

// Helper function to format relative time
function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)

  if (diffSeconds < 30) return 'Just now'
  if (diffSeconds < 60) return '30s ago'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Helper function to get domain icon by type
function getDomainIcon(domainType: string): React.ReactElement {
  const iconMap: Record<string, React.ReactElement> = {
    construction: <Construction className="w-7 h-7 text-[#405189]" />,
    manufacturing: <Factory className="w-7 h-7 text-[#405189]" />,
    warehouse: <Warehouse className="w-7 h-7 text-[#405189]" />,
    mining: <Pickaxe className="w-7 h-7 text-[#405189]" />,
    healthcare: <Cross className="w-7 h-7 text-[#405189]" />,
    food_production: <UtensilsCrossed className="w-7 h-7 text-[#405189]" />,
  }
  return iconMap[domainType] || <Building2 className="w-7 h-7 text-[#405189]" />
}

export default function Dashboard() {
  const { selectedDomain, domains, setSelectedDomain } = useDomain()
  const [cameras, setCameras] = useState<Camera[]>([])
  const [stats, setStats] = useState<ViolationStatistics>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    by_ppe_type: {},
    compliance_rate: 0,
  })
  const [recentCriticalViolations, setRecentCriticalViolations] = useState<Violation[]>([])
  const [todayViolations, setTodayViolations] = useState<Violation[]>([])
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  // Kamera listesini yükle (domain seçildiğinde)
  useEffect(() => {
    if (!selectedDomain) return

    const loadCameras = async () => {
      try {
        logger.info('Loading cameras for domain', { domainId: selectedDomain.id })
        const cameraList = await cameraService.getAll(selectedDomain.id)
        setCameras(cameraList)
      } catch (err) {
        logger.error('Camera loading error', err)
        setError('Failed to load camera list')
      }
    }
    loadCameras()
  }, [selectedDomain])

  // Load statistics and recent critical violations
  useEffect(() => {
    if (!selectedDomain) return

    const loadData = async () => {
      try {
        setLoading(true)
        logger.debug('Loading violation statistics', { domainId: selectedDomain.id })
        
        // İstatistikler
        const statsData = await violationService.getStatistics(selectedDomain.id)
        setStats(statsData)
        
        // Bugünkü ihlaller
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayViolationsResponse = await violationService.getAll({
          domain_id: selectedDomain.id,
          start_date: todayStart.toISOString(),
          limit: 100,
        })
        setTodayViolations(todayViolationsResponse.items)
        
        // Unacknowledged violations count
        const unacknowledgedResponse = await violationService.getAll({
          domain_id: selectedDomain.id,
          status: 'open',
          limit: 100,
        })
        setUnacknowledgedCount(unacknowledgedResponse.total)
        
        // Son kritik ihlaller (son 24 saat)
        const yesterday = new Date()
        yesterday.setHours(yesterday.getHours() - 24)
        const violationsResponse = await violationService.getAll({
          domain_id: selectedDomain.id,
          severity: 'critical',
          start_date: yesterday.toISOString(),
          limit: 5,
        })
        setRecentCriticalViolations(violationsResponse.items)
        
        logger.debug('Statistics and violations loaded', statsData)
      } catch (err) {
        logger.error('Statistics loading error', err)
        setError('Failed to load statistics')
      } finally {
        setLoading(false)
        setLastUpdated(new Date())
      }
    }
    loadData()

    // Refresh every minute
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [selectedDomain])

  // Update current time every 30 seconds for relative time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)
    return () => clearInterval(timer)
  }, [])


  if (error) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-section-title mb-2 text-gray-900">Error Loading Dashboard</h3>
          <p className="text-body text-gray-700 mb-2">{error}</p>
          <p className="text-caption text-gray-500 mb-6">
            Check if Backend API is running: http://localhost:8000/docs
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!selectedDomain) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Loader className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-body text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Domain-specific view
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              <LayoutDashboard className="w-7 h-7 text-[#405189]" />
              Dashboard
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Real-time monitoring and statistics for selected domain
            </p>
          </div>
        </div>
        {/* Domain Selector */}
        <div className="mt-4">
          <div className="flex items-center gap-2">
            {getDomainIcon(selectedDomain.type)}
            <span className="text-body font-medium text-gray-900">{selectedDomain.name}</span>
          </div>
        </div>
      </div>

      {/* Last Updated Indicator */}
      {lastUpdated && !loading && (
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">
              Last updated: <span className="font-medium text-gray-900">{formatRelativeTime(lastUpdated, currentTime)}</span>
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards - API'den gelen veriler */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <KPICard
            title="Hard Hat Violations"
            value={(stats.by_ppe_type?.hard_hat ?? 0).toLocaleString()}
            icon={<Construction className="w-6 h-6" />}
            color="danger"
          />
          <KPICard
            title="Safety Vest Violations"
            value={(stats.by_ppe_type?.safety_vest ?? 0).toLocaleString()}
            icon={<ShieldAlert className="w-6 h-6" />}
            color="danger"
          />
          <KPICard
            title="Compliance Rate"
            value={`${(stats.compliance_rate ?? 0).toFixed(0)}%`}
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="success"
          />
          <KPICard
            title="Total Violations"
            value={(stats.total ?? 0).toLocaleString()}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="warning"
          />
          <KPICard
            title="Active Cameras"
            value={`${cameras.filter(c => c.is_active).length}/${cameras.length}`}
            icon={<CameraIcon className="w-6 h-6" />}
            color="info"
          />
        </div>
      )}

      {/* Camera Status & Recent Critical Violations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Camera Status */}
        <div className="lg:col-span-1 card">
          <h3 className="text-section-title mb-4 flex items-center gap-2">
            <CameraIcon className="w-5 h-5" />
            Camera Status
          </h3>
          <div className="space-y-3">
            {cameras.length === 0 ? (
              <p className="text-body text-gray-500 text-center py-4">No cameras configured</p>
            ) : (
              cameras.map((camera) => (
                <div
                  key={camera.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    {camera.is_active ? (
                      <Wifi className="w-5 h-5 text-green-600" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="text-body font-medium text-gray-900">{camera.name}</p>
                      {camera.location && (
                        <p className="text-caption text-gray-500">{camera.location}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      camera.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {camera.is_active ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Critical Violations */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-section-title flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#405189]" />
              Recent Critical Violations (Last 24h)
            </h3>
            <Link
              to="/events"
              className="text-sm text-[#405189] hover:text-[#364574] font-medium transition-colors"
            >
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {recentCriticalViolations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                <p className="text-body">No critical violations in the last 24 hours</p>
              </div>
            ) : (
              recentCriticalViolations.map((violation) => {
                const missingPPE = violation.missing_ppe.map(ppe => 
                  ppe.type === 'hard_hat' ? 'Hard Hat' : 
                  ppe.type === 'safety_vest' ? 'Safety Vest' : 
                  ppe.type
                ).join(', ')
                
                const severity = violation.severity || 'medium'
                const iconColor = severity === 'critical' ? 'text-red-600' : 
                                 severity === 'high' ? 'text-orange-600' : 
                                 'text-yellow-600'
                
                return (
                  <div
                    key={violation.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body text-gray-900">
                        Violation detected: Missing {missingPPE}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-caption text-gray-500">Camera #{violation.camera_id}</span>
                        <span className="text-caption text-gray-400">•</span>
                        <span className="text-caption text-gray-500">
                          {formatRelativeTime(new Date(violation.timestamp), currentTime)}
                        </span>
                      </div>
                    </div>
                    <Link
                      to="/events"
                      className="text-sm text-[#405189] hover:text-[#364574] font-medium flex-shrink-0"
                    >
                      View →
                    </Link>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Today's Summary - Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Today's Activity */}
        <div className="card">
          <h3 className="text-section-title mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Today's Activity
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-body text-gray-700">Today's Violations</span>
              <span className="text-2xl font-bold text-gray-900">{todayViolations.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
              <span className="text-body text-gray-700">Critical (Today)</span>
              <span className="text-2xl font-bold text-red-600">
                {todayViolations.filter(v => v.severity === 'critical').length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
              <span className="text-body text-gray-700">Unacknowledged</span>
              <span className="text-2xl font-bold text-orange-600">{unacknowledgedCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-body text-gray-700">Compliance Rate</span>
              <span className="text-2xl font-bold text-green-600">{(stats.compliance_rate ?? 0).toFixed(0)}%</span>
            </div>
            <Link
              to="/analytics"
              className="block w-full text-center btn-secondary mt-2"
            >
              View Analytics →
            </Link>
          </div>
        </div>

        {/* System Health */}
        <div className="card">
          <h3 className="text-section-title mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            System Health
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-body text-gray-700">Active Cameras</span>
              </div>
              <span className="text-body font-semibold text-gray-900">
                {cameras.filter(c => c.is_active).length}/{cameras.length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-body text-gray-700">Monitoring Status</span>
              </div>
              <span className="text-body font-semibold text-green-600">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-body text-gray-700">Last Detection</span>
              </div>
              <span className="text-caption text-gray-600">
                {lastUpdated ? formatRelativeTime(lastUpdated, currentTime) : 'Never'}
              </span>
            </div>
            <Link
              to="/live-camera"
              className="block w-full mt-4 text-center btn-primary"
            >
              View Live Camera
            </Link>
          </div>
        </div>

        {/* Action Items */}
        <div className="card">
          <h3 className="text-section-title mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Action Required
          </h3>
          <div className="space-y-2">
            {recentCriticalViolations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                <p className="text-body">No action items</p>
                <p className="text-caption text-gray-400 mt-1">All clear!</p>
              </div>
            ) : (
              <>
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
                  <p className="text-body font-medium text-gray-900">
                    {recentCriticalViolations.length} Unacknowledged Critical Violation{recentCriticalViolations.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-caption text-gray-600 mt-1">
                    Requires immediate attention
                  </p>
                </div>
                <Link
                  to="/events"
                  className="block w-full text-center btn-secondary mt-4"
                >
                  Review Violations →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
