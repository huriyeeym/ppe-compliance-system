/**
 * Events / Alerts Page
 * 
 * Incident management interface for PPE violations
 * Features:
 * - Filterable violations table
 * - Status workflow (Open → In Progress → Closed / False Positive)
 * - Violation detail modal with snapshot and notes
 */

import { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  MapPin,
  Eye,
  Edit,
  X,
  AlertCircle,
  FileDown,
  FileSpreadsheet
} from 'lucide-react'
import { violationService, type Violation, type ViolationFilters } from '../lib/api/services/violationService'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { logger } from '../lib/utils/logger'
import { useAuth } from '../context/AuthContext'
import { canPerformAction, type UserRole } from '../lib/utils/permissions'
import CustomSelect from '../components/common/CustomSelect'
import PermissionGate from '../components/common/PermissionGate'
import EventDetailModal from '../components/violations/EventDetailModal'
import { exportViolationsToPDF, exportViolationsToExcel } from '../lib/utils/exportHelpers'
import toast from 'react-hot-toast'

type ViolationStatus = 'open' | 'in_progress' | 'closed' | 'false_positive'
type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low'

export default function Events() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null)

  // Filters
  const [filters, setFilters] = useState<ViolationFilters>({
    skip: 0,
    limit: 50,
  })
  const [total, setTotal] = useState(0)
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })

  const { user } = useAuth()

  // Load domains and cameras
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load organization-specific domains (should return only 4: Construction, Manufacturing, Mining, Warehouse)
        if (user?.organization_id) {
          const [domainList, cameraList] = await Promise.all([
            domainService.getOrganizationDomains(user.organization_id),
            cameraService.getAll(),
          ])
          setDomains(domainList)
          setCameras(cameraList)
        } else {
          // Fallback: if no organization, use active domains
          const [domainList, cameraList] = await Promise.all([
            domainService.getActive(),
            cameraService.getAll(),
          ])
          setDomains(domainList)
          setCameras(cameraList)
        }
      } catch (err) {
        logger.error('Failed to load domains/cameras', err)
      }
    }
    if (user) {
      loadData()
    }
  }, [user, user?.organization_id])

  // Load violations
  useEffect(() => {
    const loadViolations = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await violationService.getAll(filters)
        setViolations(response.items)
        setTotal(response.total)
      } catch (err) {
        logger.error('Failed to load violations', err)
        setError('İhlaller yüklenemedi')
      } finally {
        setLoading(false)
      }
    }
    loadViolations()
  }, [filters])

  // Extract unique locations from cameras
  const uniqueLocations = useMemo(() => {
    const locations = cameras
      .map(c => c.location)
      .filter((loc): loc is string => !!loc && loc.trim() !== '')
    return Array.from(new Set(locations)).sort()
  }, [cameras])

  // Enhanced filtering with search, date range, camera, and location
  const filteredViolations = useMemo(() => {
    let filtered = [...violations]

    // Filter by location (zone)
    if (selectedLocation) {
      const camerasInLocation = cameras
        .filter(c => c.location === selectedLocation)
        .map(c => c.id)
      filtered = filtered.filter(v => camerasInLocation.includes(v.camera_id))
    }

    // Filter by specific camera
    if (selectedCameraId) {
      filtered = filtered.filter(v => v.camera_id === selectedCameraId)
    }

    // Filter by date range
    if (dateRange.start) {
      const startDate = new Date(dateRange.start)
      filtered = filtered.filter(v => new Date(v.timestamp) >= startDate)
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999) // Include the entire end day
      filtered = filtered.filter(v => new Date(v.timestamp) <= endDate)
    }

    // Filter by search query (ID, camera name, PPE type)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(v => {
        const camera = cameras.find(c => c.id === v.camera_id)
        const cameraName = camera?.name.toLowerCase() || ''
        const violationId = v.id.toString()
        const ppeTypes = v.missing_ppe.map(p => p.type.toLowerCase()).join(' ')

        return (
          violationId.includes(query) ||
          cameraName.includes(query) ||
          ppeTypes.includes(query)
        )
      })
    }

    return filtered
  }, [violations, selectedLocation, selectedCameraId, dateRange, searchQuery, cameras])

  const handleUpdateViolation = async (violationId: number, updates: Partial<Violation>) => {
    try {
      await violationService.update(violationId, {
        status: updates.status,
        notes: updates.notes,
        corrective_action: updates.corrective_action,
        assigned_to: updates.assigned_to,
        detected_user_id: updates.detected_user_id,
      })
      // Refresh violations
      const response = await violationService.getAll(filters)
      setViolations(response.items)
      setTotal(response.total)
    } catch (err) {
      logger.error('Failed to update violation', err)
      throw err
    }
  }

  const loadViolations = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await violationService.getAll(filters)
      setViolations(response.items)
      setTotal(response.total)
    } catch (err) {
      logger.error('Failed to load violations', err)
      setError('İhlaller yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: ViolationStatus) => {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4" />
      case 'in_progress': return <Edit className="w-4 h-4" />
      case 'closed': return <CheckCircle2 className="w-4 h-4" />
      case 'false_positive': return <XCircle className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: ViolationStatus) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'closed': return 'bg-green-100 text-green-800'
      case 'false_positive': return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityColor = (severity: ViolationSeverity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              <AlertCircle className="w-7 h-7 text-[#405189]" />
              Events & Alerts
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              View, manage, and track PPE violation incidents
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(searchQuery || selectedLocation || selectedCameraId || dateRange.start || dateRange.end) && (
              <span className="text-sm text-gray-600">
                Showing: <span className="font-medium text-[#405189]">{filteredViolations.length}</span> of{' '}
                <span className="font-medium">{total}</span>
              </span>
            )}
            <PermissionGate roles={['super_admin', 'admin', 'manager']}>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    try {
                      const getPPEDisplayName = (type: string) => {
                        const names: Record<string, string> = {
                          hard_hat: 'Hard Hat',
                          safety_vest: 'Safety Vest',
                          gloves: 'Gloves',
                          safety_boots: 'Safety Boots',
                          safety_glasses: 'Safety Glasses',
                        }
                        return names[type] || type
                      }

                      const exportData = filteredViolations.map(v => {
                        const camera = cameras.find(c => c.id === v.camera_id)
                        return {
                          id: v.id,
                          timestamp: v.timestamp,
                          camera_name: camera?.name || `Camera #${v.camera_id}`,
                          camera_location: camera?.location || '-',
                          missing_ppe: v.missing_ppe.map(p => getPPEDisplayName(p.type)),
                          severity: v.severity,
                          status: v.status || 'pending',
                          confidence: v.confidence,
                          assigned_to: v.assigned_to || '-',
                          notes: v.notes || '-',
                          corrective_action: v.corrective_action || '-',
                        }
                      })
                      
                      const dateRangeForExport = {
                        start: dateRange.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        end: dateRange.end || new Date().toISOString().split('T')[0],
                      }
                      
                      exportViolationsToPDF(exportData, {
                        title: 'PPE Violation Events Report',
                        dateRange: dateRangeForExport,
                        companyName: 'PPE Compliance System',
                      })
                      toast.success('PDF downloaded successfully')
                    } catch (err) {
                      logger.error('PDF export failed', err)
                      toast.error('Error creating PDF')
                    }
                  }}
                  className="px-4 py-2 bg-[#F06548] hover:bg-[#F06548]/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  onClick={() => {
                    try {
                      const getPPEDisplayName = (type: string) => {
                        const names: Record<string, string> = {
                          hard_hat: 'Hard Hat',
                          safety_vest: 'Safety Vest',
                          gloves: 'Gloves',
                          safety_boots: 'Safety Boots',
                          safety_glasses: 'Safety Glasses',
                        }
                        return names[type] || type
                      }

                      const exportData = filteredViolations.map(v => {
                        const camera = cameras.find(c => c.id === v.camera_id)
                        return {
                          id: v.id,
                          timestamp: v.timestamp,
                          camera_name: camera?.name || `Camera #${v.camera_id}`,
                          camera_location: camera?.location || '-',
                          missing_ppe: v.missing_ppe.map(p => getPPEDisplayName(p.type)),
                          severity: v.severity,
                          status: v.status || 'pending',
                          confidence: v.confidence,
                          assigned_to: v.assigned_to || '-',
                          notes: v.notes || '-',
                          corrective_action: v.corrective_action || '-',
                        }
                      })
                      
                      exportViolationsToExcel(exportData, {
                        filename: `events-report-${new Date().toISOString().split('T')[0]}.xlsx`,
                        sheetName: 'Events',
                      })
                      toast.success('Excel file downloaded successfully')
                    } catch (err) {
                      logger.error('Excel export failed', err)
                      toast.error('Error creating Excel file')
                    }
                  }}
                  className="px-4 py-2 bg-[#0AB39C] hover:bg-[#0AB39C]/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                </button>
              </div>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        {/* Row 1: Search and Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, camera, or PPE type..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] transition-all"
            />
          </div>
        </div>

        {/* Row 2: Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <CustomSelect
            label="Domain"
            value={filters.domain_id || ''}
            onChange={(val) => setFilters({ ...filters, domain_id: val ? Number(val) : undefined, skip: 0 })}
            options={[
              { value: '', label: 'All Domains' },
              ...domains.map(d => ({ value: d.id, label: d.name }))
            ]}
            placeholder="All Domains"
          />
          <CustomSelect
            label="Camera"
            value={selectedCameraId || ''}
            onChange={(val) => setSelectedCameraId(val ? Number(val) : null)}
            options={[
              { value: '', label: 'All Cameras' },
              ...cameras.map(c => ({ value: c.id, label: c.name }))
            ]}
            placeholder="All Cameras"
          />
          <CustomSelect
            label="Zone"
            value={selectedLocation}
            onChange={setSelectedLocation}
            options={[
              { value: '', label: 'All Zones' },
              ...uniqueLocations.map(l => ({ value: l, label: l }))
            ]}
            placeholder="All Zones"
          />
          <CustomSelect
            label="Status"
            value={filters.status || ''}
            onChange={(val) => setFilters({ ...filters, status: val as ViolationStatus || undefined, skip: 0 })}
            options={[
              { value: '', label: 'All Status' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'closed', label: 'Closed' },
              { value: 'false_positive', label: 'False Positive' }
            ]}
            placeholder="All Status"
          />
          <CustomSelect
            label="Severity"
            value={filters.severity || ''}
            onChange={(val) => setFilters({ ...filters, severity: val as ViolationSeverity || undefined, skip: 0 })}
            options={[
              { value: '', label: 'All Severities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' }
            ]}
            placeholder="All Severities"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading violations...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : filteredViolations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {selectedLocation ? `No violations found in ${selectedLocation}` : 'No violations found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Camera</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Missing PPE</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredViolations.map((violation) => {
                  const domain = domains.find(d => d.id === violation.domain_id)
                  const camera = cameras.find(c => c.id === violation.camera_id)
                  
                  return (
                    <tr key={violation.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">#{violation.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(violation.timestamp).toLocaleString('tr-TR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{domain?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{camera?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {camera?.location ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                            <MapPin className="w-3 h-3" />
                            {camera.location}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {violation.missing_ppe.slice(0, 2).map((ppe, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                            >
                              {ppe.type === 'hard_hat' ? 'Hard Hat' : 
                               ppe.type === 'safety_vest' ? 'Vest' : 
                               ppe.type}
                            </span>
                          ))}
                          {violation.missing_ppe.length > 2 && (
                            <span className="text-xs text-gray-500">+{violation.missing_ppe.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getSeverityColor(violation.severity)}`}>
                          {violation.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${getStatusColor(violation.status)}`}>
                          {getStatusIcon(violation.status)}
                          {violation.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(violation.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedViolation(violation)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#405189] bg-[#405189]/10 rounded-lg hover:bg-[#405189]/20 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > filters.limit! && (
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filters.skip! + 1} to {Math.min(filters.skip! + filters.limit!, total)} of {total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ ...filters, skip: Math.max(0, filters.skip! - filters.limit!) })}
                disabled={filters.skip === 0}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters({ ...filters, skip: filters.skip! + filters.limit! })}
                disabled={filters.skip! + filters.limit! >= total}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedViolation && (
        <EventDetailModal
          violation={selectedViolation}
          onClose={() => setSelectedViolation(null)}
          onUpdate={async (violationId: number, updates: any) => {
            await handleUpdateViolation(violationId, updates)
            await loadViolations()
          }}
          onUserReassign={async (violationId: number, userId: number | null) => {
            await handleUpdateViolation(violationId, { detected_user_id: userId })
            await loadViolations()
          }}
        />
      )}
    </div>
  )
}

