import { useState, useEffect, useCallback } from 'react'
import { FileDown, FileSpreadsheet, AlertTriangle, Check, Clock, X, FileText } from 'lucide-react'
import { violationService, type Violation, type ViolationFilters } from '../lib/api/services'
import { domainService } from '../lib/api/services'
import { logger } from '../lib/utils/logger'
import { exportViolationsToPDF, exportViolationsToExcel } from '../lib/utils/exportHelpers'
import { showSuccessAlert, showErrorAlert } from '../components/alerts/ViolationAlert'
import CustomSelect from '../components/common/CustomSelect'
import { useAuth } from '../context/AuthContext'
import PermissionGate from '../components/common/PermissionGate'
import ViolationDetailModal from '../components/violations/ViolationDetailModal'

/**
 * Violation Reports Page
 *
 * Real usage for construction site:
 * 1. Violation list (date, camera, missing PPE)
 * 2. Violation details (photo, bounding box, confidence)
 * 3. Violation acknowledgment/rejection
 * 4. Add notes
 * 5. Filtering (date, camera, PPE type, severity)
 * 6. Export (PDF/Excel)
 */
export default function Report() {
  const { user } = useAuth()
  
  // Set default date range to last 30 days (to show recent violations)
  // Use local date to avoid timezone issues
  const getDefaultDateRange = () => {
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    
    // Format as YYYY-MM-DD using local date (not UTC)
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    return {
      from: formatLocalDate(thirtyDaysAgo),
      to: formatLocalDate(today)
    }
  }
  
  const [dateRange, setDateRange] = useState(getDefaultDateRange())
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedPPE, setSelectedPPE] = useState<string>('all')
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null)

  const handleUserReassign = async (violationId: number, userId: number | null) => {
    try {
      await violationService.update(violationId, {
        detected_user_id: userId,
      })
      // Refresh violations
      await loadViolations()
      showSuccessAlert('User reassigned successfully')
    } catch (err) {
      logger.error('Failed to reassign user', err)
      showErrorAlert('Failed to reassign user')
      throw err
    }
  }
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
  const [domains, setDomains] = useState<Array<{ id: number; name: string; type: string }>>([])
  const [pagination, setPagination] = useState({ skip: 0, limit: 50 })
  const [totalViolations, setTotalViolations] = useState(0)

  // Ensure end date is always set to today when component mounts or when it's not set
  useEffect(() => {
    // Format today's date using local time (not UTC)
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayString = `${year}-${month}-${day}`
    
    if (!dateRange.to || dateRange.to !== todayString) {
      setDateRange(prev => ({
        ...prev,
        to: todayString
      }))
    }
  }, []) // Only run once on mount

  // Load organization domains on mount - only show organization's 4 domains
  // Load organization domains on mount - only show organization's 4 domains
  // Wait for user to be loaded before loading domains
  useEffect(() => {
    // Don't load domains if user is not yet loaded
    if (!user) {
      return
    }
    
    const loadDomains = async () => {
      try {
        if (user?.organization_id) {
          // Load organization-specific domains (should return only 4: Construction, Manufacturing, Mining, Warehouse)
          const orgDomains = await domainService.getOrganizationDomains(user.organization_id)
          logger.info(`Loaded ${orgDomains.length} organization domains`, { 
            organization_id: user.organization_id,
            domains: orgDomains.map(d => ({ id: d.id, name: d.name, type: d.type }))
          })
          const mappedDomains = orgDomains.map(d => ({ id: d.id, name: d.name, type: d.type }))
          setDomains(mappedDomains)
        } else {
          // Fallback: if no organization, use active domains
          const activeDomains = await domainService.getActive()
          setDomains(activeDomains.map(d => ({ id: d.id, name: d.name, type: d.type })))
        }
      } catch (err) {
        logger.error('Failed to load domains', err)
        setError('Failed to load domains')
      }
    }
    loadDomains()
  }, [user, user?.organization_id])

  // Load violations from API
  const loadViolations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Build filters
      const filters: ViolationFilters = {
        skip: pagination.skip,
        limit: pagination.limit,
      }

      // Only add domain_id filter if a specific domain is selected (not "All")
      if (selectedDomainId) {
        filters.domain_id = selectedDomainId
      }

      if (selectedSeverity !== 'all') {
        filters.severity = selectedSeverity as 'critical' | 'high' | 'medium' | 'low'
      }

      if (selectedPPE !== 'all') {
        filters.missing_ppe_type = selectedPPE
      }

      if (dateRange.from) {
        filters.start_date = new Date(dateRange.from).toISOString()
      }
      if (dateRange.to) {
        // Set end date to end of day (23:59:59) to include all violations on that day
        const endDate = new Date(dateRange.to)
        endDate.setHours(23, 59, 59, 999)
        filters.end_date = endDate.toISOString()
      }

      logger.debug('Loading violations with filters', filters)
      const response = await violationService.getAll(filters)
      setViolations(response.items)
      setTotalViolations(response.total)
      logger.info(`Loaded ${response.items.length} violations (total: ${response.total})`)
    } catch (err) {
      logger.error('Failed to load violations', err)
      setError('Failed to load violation list')
    } finally {
      setLoading(false)
    }
  }, [dateRange, selectedSeverity, selectedPPE, selectedDomainId])

  useEffect(() => {
    loadViolations()
  }, [loadViolations, pagination.skip, pagination.limit])

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

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const handleAcknowledge = async (violationId: number) => {
    try {
      const acknowledgedBy = user?.email || 'system'
      await violationService.acknowledge(violationId, acknowledgedBy)
      logger.info(`Violation ${violationId} acknowledged by ${acknowledgedBy}`)

      // Refresh violations list with current filters
      await loadViolations()
      showSuccessAlert('Violation acknowledged successfully')
    } catch (err) {
      logger.error('Failed to acknowledge violation', err)
      showErrorAlert('Failed to acknowledge violation')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#405189] mx-auto mb-4"></div>
            <p className="text-body text-gray-500">Loading...</p>
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
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-section-title mb-2">Error</h3>
            <p className="text-body text-gray-500">{error}</p>
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
              <FileText className="w-7 h-7 text-[#405189]" />
              Violation Reports
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Detailed violation records, filtering, and export
            </p>
          </div>
          <PermissionGate roles={['super_admin', 'admin', 'manager']}>
          <div className="flex gap-3">
            <button
              onClick={() => {
                try {
                  const exportData = violations.map(v => ({
                    id: v.id,
                    timestamp: v.timestamp,
                    camera_name: `Camera #${v.camera_id}`,
                    missing_ppe: v.missing_ppe.map(p => getPPEDisplayName(p.type)),
                    severity: v.severity,
                    status: v.status || 'pending',
                    confidence: v.confidence,
                    assigned_to: v.assigned_to || '-',
                    notes: v.notes || '-',
                    corrective_action: v.corrective_action || '-',
                  }))
                  exportViolationsToPDF(exportData, {
                    title: 'PPE Violation Report',
                    dateRange: { start: dateRange.from, end: dateRange.to },
                    companyName: 'PPE Compliance System',
                  })
                  showSuccessAlert('PDF downloaded successfully')
                } catch (err) {
                  logger.error('PDF export failed', err)
                  showErrorAlert('Error creating PDF')
                }
              }}
              className="btn-danger flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Download PDF
            </button>
            <button
              onClick={() => {
                try {
                  const exportData = violations.map(v => ({
                    id: v.id,
                    timestamp: v.timestamp,
                    camera_name: `Camera #${v.camera_id}`,
                    missing_ppe: v.missing_ppe.map(p => getPPEDisplayName(p.type)),
                    severity: v.severity,
                    status: v.status || 'pending',
                    confidence: v.confidence,
                    assigned_to: v.assigned_to || '-',
                    notes: v.notes || '-',
                    corrective_action: v.corrective_action || '-',
                  }))
                  exportViolationsToExcel(exportData, {
                    filename: `violations-${new Date().toISOString().split('T')[0]}.xlsx`,
                    sheetName: 'Violations',
                  })
                  showSuccessAlert('Excel downloaded successfully')
                } catch (err) {
                  logger.error('Excel export failed', err)
                  showErrorAlert('Error creating Excel')
                }
              }}
              className="btn-success flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download Excel
            </button>
          </div>
        </PermissionGate>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <CustomSelect
              value={selectedDomainId?.toString() || 'all'}
              onChange={(val) => {
                try {
                  setSelectedDomainId(val === 'all' || val === '' ? null : Number(val))
                } catch (err) {
                  logger.error('Error changing domain', err)
                  setError('Failed to change domain')
                }
              }}
              options={[
                { value: 'all', label: 'All Domains' },
                ...domains.map(d => ({ value: d.id.toString(), label: d.name }))
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.to}
              max={new Date().toISOString().split('T')[0]} // Prevent selecting future dates
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Missing PPE</label>
            <CustomSelect
              value={selectedPPE}
              onChange={(val) => setSelectedPPE(String(val))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'hard_hat', label: 'Hard Hat' },
                { value: 'safety_vest', label: 'Safety Vest' }
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <CustomSelect
              value={selectedSeverity}
              onChange={(val) => setSelectedSeverity(String(val))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Violations Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Camera</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Missing PPE</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Detected</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {violations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No violations found
                  </td>
                </tr>
              ) : (
                violations.map((violation, index) => (
                  <tr
                    key={violation.id}
                    className={`
                      hover:bg-gray-50 transition-colors
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                    `}
                  >
                    <td className="px-6 py-4 text-body">{formatDateTime(violation.timestamp)}</td>
                    <td className="px-6 py-4 text-body">Camera #{violation.camera_id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {violation.missing_ppe.map((ppe, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-[#F06548]/10 text-[#F06548] rounded-md text-xs font-medium"
                          >
                            {getPPEDisplayName(ppe.type)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {violation.detected_ppe.map((ppe, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-[#0AB39C]/10 text-[#0AB39C] rounded-md text-xs font-medium"
                          >
                            {getPPEDisplayName(ppe.type)} ({(ppe.confidence * 100).toFixed(0)}%)
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F06548]/10 text-[#F06548]">
                        {violation.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {violation.acknowledged ? (
                        <span className="px-2 py-1 bg-[#0AB39C]/10 text-[#0AB39C] rounded-md text-xs font-medium flex items-center gap-1 inline-flex">
                          <Check className="w-3 h-3" />
                          <span>Acknowledged</span>
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-[#F7B84B]/10 text-[#F7B84B] rounded-md text-xs font-medium flex items-center gap-1 inline-flex">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className="px-4 py-1.5 bg-[#405189]/10 text-[#405189] rounded-md text-xs font-medium hover:bg-[#405189]/20 transition-all"
                        onClick={() => setSelectedViolation(violation)}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalViolations > pagination.limit && (
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {pagination.skip + 1} to {Math.min(pagination.skip + pagination.limit, totalViolations)} of {totalViolations}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, skip: Math.max(0, pagination.skip - pagination.limit) })}
                disabled={pagination.skip === 0}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, skip: pagination.skip + pagination.limit })}
                disabled={pagination.skip + pagination.limit >= totalViolations}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Violation Detail Modal */}
      {selectedViolation && (
        <ViolationDetailModal
          violation={selectedViolation}
          onClose={() => setSelectedViolation(null)}
          onUserReassign={handleUserReassign}
        />
      )}
    </div>
  )
}
