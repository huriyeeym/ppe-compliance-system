import { useState, useEffect, useCallback } from 'react'
import { FileDown, FileSpreadsheet, AlertTriangle, Check, Clock, X } from 'lucide-react'
import { violationService, type Violation, type ViolationFilters } from '../lib/api/services'
import { domainService } from '../lib/api/services'
import { logger } from '../lib/utils/logger'
import { exportViolationsToPDF, exportViolationsToExcel } from '../lib/utils/exportHelpers'
import { showSuccessAlert, showErrorAlert } from '../components/alerts/ViolationAlert'
import CustomSelect from '../components/common/CustomSelect'
import { useAuth } from '../context/AuthContext'

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
  const [dateRange, setDateRange] = useState({ from: '2025-11-01', to: '2025-11-10' })
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedPPE, setSelectedPPE] = useState<string>('all')
  const [selectedViolation, setSelectedViolation] = useState<number | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load violations from API
  const loadViolations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Get construction domain
      const domains = await domainService.getActive()
      const constructionDomain = domains.find(d => d.type === 'construction')

      if (!constructionDomain) {
        setError('Construction domain not found')
        return
      }

      // Build filters
      const filters: ViolationFilters = {
        domain_id: constructionDomain.id,
        skip: 0,
        limit: 50,
      }

      if (selectedSeverity !== 'all') {
        filters.severity = selectedSeverity as 'critical' | 'high' | 'medium' | 'low'
      }

      if (dateRange.from) {
        filters.start_date = new Date(dateRange.from).toISOString()
      }
      if (dateRange.to) {
        filters.end_date = new Date(dateRange.to).toISOString()
      }

      logger.debug('Loading violations with filters', filters)
      const response = await violationService.getAll(filters)
      setViolations(response.items)
      logger.info(`Loaded ${response.items.length} violations`)
    } catch (err) {
      logger.error('Failed to load violations', err)
      setError('Failed to load violation list')
    } finally {
      setLoading(false)
    }
  }, [dateRange, selectedSeverity, selectedPPE])

  useEffect(() => {
    loadViolations()
  }, [loadViolations])

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">Violation Reports</h1>
          <p className="text-caption text-gray-500">Detailed violation records and export</p>
        </div>
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
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      hover:bg-gray-50 transition-colors cursor-pointer
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                    `}
                    onClick={() => setSelectedViolation(violation.id)}
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
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedViolation(violation.id)
                        }}
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
      </div>

      {/* Violation Detail Modal */}
      {selectedViolation && violations.find(v => v.id === selectedViolation) && (() => {
        const violation = violations.find(v => v.id === selectedViolation)!
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                <h3 className="text-section-title">Violation Details</h3>
                <button
                  onClick={() => setSelectedViolation(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Frame Snapshot */}
                {violation.frame_snapshot && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Violation Snapshot</h4>
                    <img
                      src={violation.frame_snapshot}
                      alt="Violation snapshot"
                      className="w-full rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {/* Violation Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-caption text-gray-500 mb-1">Time</p>
                    <p className="text-body text-gray-900">{formatDateTime(violation.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-gray-500 mb-1">Camera</p>
                    <p className="text-body text-gray-900">Camera #{violation.camera_id}</p>
                  </div>
                  <div>
                    <p className="text-caption text-gray-500 mb-1">Missing PPE</p>
                    <div className="flex flex-wrap gap-1">
                      {violation.missing_ppe.map((ppe, idx) => (
                        <span key={idx} className="px-2 py-1 bg-[#F06548]/10 text-[#F06548] rounded-md text-xs font-medium">
                          {getPPEDisplayName(ppe.type)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-caption text-gray-500 mb-1">Confidence</p>
                    <p className="text-body text-gray-900">{(violation.confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>

                {/* Actions */}
                {!violation.acknowledged && (
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      className="btn-success flex items-center gap-2"
                      onClick={() => handleAcknowledge(violation.id)}
                    >
                      <Check className="w-4 h-4" />
                      <span>Acknowledge</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
