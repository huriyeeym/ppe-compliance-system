import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Users, Camera, AlertTriangle, Database, Eye } from 'lucide-react'
import { userService } from '../lib/api/services/userService'
import { domainService } from '../lib/api/services/domainService'
import { cameraService } from '../lib/api/services/cameraService'
import { violationService } from '../lib/api/services/violationService'
import { logger } from '../lib/utils/logger'
import { useAuth } from '../context/AuthContext'
import KPICard from '../components/dashboard/KPICard'

/**
 * Organization Settings Page
 * 
 * Manage organization information and overview
 */
export default function OrganizationSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDomains: 0,
    totalCameras: 0,
    totalViolations: 0,
    unacknowledgedViolations: 0,
  })

  // Check if user has admin access
  useEffect(() => {
    if (user) {
      const canAccessAdmin = user.role === 'super_admin' || user.role === 'admin'
      if (!canAccessAdmin) {
        toast.error('You do not have permission to access this page')
        navigate('/')
      }
    }
  }, [user, navigate])

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const [users, domains, cameras, violations] = await Promise.all([
        userService.getAll().catch((err) => {
          logger.warn('Failed to load users in OrganizationSettings', err)
          return []
        }),
        domainService.getAll().catch((err) => {
          logger.warn('Failed to load domains in OrganizationSettings', err)
          return []
        }),
        cameraService.getAll().catch((err) => {
          logger.warn('Failed to load cameras in OrganizationSettings', err)
          return []
        }),
        violationService.getAll({ page: 1, limit: 1 }).catch((err) => {
          logger.warn('Failed to load violations in OrganizationSettings', err)
          return { violations: [], total: 0 }
        }),
      ])

      const unacknowledged = violations.violations?.filter((v: any) => !v.acknowledged) || []

      setStats({
        totalUsers: users.length || 0,
        totalDomains: domains.length || 0,
        totalCameras: cameras.length || 0,
        totalViolations: violations.total || 0,
        unacknowledgedViolations: unacknowledged.length || 0,
      })
    } catch (err) {
      logger.error('Organization stats load error', err)
      toast.error('Failed to load organization statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#405189] mx-auto mb-4"></div>
            <p className="text-body text-gray-500">Loading organization information...</p>
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
              <Building2 className="w-7 h-7 text-[#405189]" />
              Organization Settings
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Manage organization information and overview
            </p>
          </div>
        </div>
      </div>

      {/* Organization Information */}
      <div className="card">
        <h3 className="text-section-title mb-4">Organization Information</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {user?.organization_id ? `Organization #${user.organization_id}` : 'Not available'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Created Date
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Not available'}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <div className="px-3 py-2 bg-[#0AB39C]/10 border border-[#0AB39C]/20 rounded-lg text-sm text-[#0AB39C] inline-block">
              Active
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KPICard
          title="Users"
          value={stats.totalUsers.toString()}
          icon={<Users className="w-6 h-6" />}
          color="info"
        />
        <KPICard
          title="Domains"
          value={stats.totalDomains.toString()}
          icon={<Database className="w-6 h-6" />}
          color="info"
        />
        <KPICard
          title="Cameras"
          value={stats.totalCameras.toString()}
          icon={<Camera className="w-6 h-6" />}
          color="info"
        />
        <KPICard
          title="Total Violations"
          value={stats.totalViolations.toString()}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="warning"
        />
        <KPICard
          title="Open Violations"
          value={stats.unacknowledgedViolations.toString()}
          icon={<Eye className="w-6 h-6" />}
          color="danger"
        />
      </div>

      {/* Additional Information */}
      <div className="card">
        <h3 className="text-section-title mb-4">Overview</h3>
        <div className="space-y-3">
          <p className="text-body text-gray-600">
            This organization manages {stats.totalDomains} domain{stats.totalDomains !== 1 ? 's' : ''} with {stats.totalCameras} camera{stats.totalCameras !== 1 ? 's' : ''} across the system.
          </p>
          <p className="text-body text-gray-600">
            There are {stats.totalUsers} active user{stats.totalUsers !== 1 ? 's' : ''} with access to this organization's data.
          </p>
          {stats.unacknowledgedViolations > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-900">
                <strong>{stats.unacknowledgedViolations}</strong> violation{stats.unacknowledgedViolations !== 1 ? 's' : ''} require{stats.unacknowledgedViolations === 1 ? 's' : ''} attention.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

