import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { HardHat, Shield, Glasses, User, Footprints, Hand, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { violationService, type Violation } from '../../lib/api/services'
import { domainService } from '../../lib/api/services'
import { logger } from '../../lib/utils/logger'
import ViolationDetailModal from '../violations/ViolationDetailModal'
import { useWebSocket } from '../../lib/websocket/useWebSocket'

interface ViolationsAlertProps {
  domainId?: string
}

/**
 * Construction Site Violation Alerts
 *
 * Real usage:
 * - Fetches last 10 violations from API
 * - Real-time updates (every 30 seconds)
 * - Filtering by Domain ID
 */
export default function ViolationsAlert({ domainId }: ViolationsAlertProps) {
  const [alerts, setAlerts] = useState<Violation[]>([])
  const [logs, setLogs] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null)
  const [domainIdNumber, setDomainIdNumber] = useState<number | null>(null)
  const wsConnectedRef = useRef(false) // Track wsConnected state

  // Find domain ID from domain type
  useEffect(() => {
    if (!domainId) return

    const findDomain = async () => {
      try {
        const domains = await domainService.getActive()
        const domain = domains.find(d => d.type === domainId)
        if (domain) {
          setDomainIdNumber(domain.id)
        } else {
          logger.warn('Domain not found', { domainType: domainId })
        }
      } catch (err) {
        logger.error('Failed to find domain', err)
      }
    }

    findDomain()
  }, [domainId])

  // ✅ WebSocket for real-time violation notifications
  // Use useCallback to stabilize the onViolation callback
  const handleViolation = useCallback((violation: any) => {
    // Add new violation to alerts if it's critical and unacknowledged
    if (violation.severity === 'critical') {
      setAlerts(prev => {
        // Avoid duplicates
        if (prev.some(a => a.id === violation.id)) {
          return prev
        }
        // Add to beginning and keep only last 10
        return [{ ...violation, acknowledged: false } as Violation, ...prev].slice(0, 10)
      })
    }
    
    // Add to logs (all violations)
    setLogs(prev => {
      // Avoid duplicates
      if (prev.some(l => l.id === violation.id)) {
        return prev
      }
      // Add to beginning and keep only last 20
      return [{ ...violation } as Violation, ...prev].slice(0, 20)
    })
  }, [])

  // Stabilize domainIds array to prevent unnecessary reconnections
  const domainIds = useMemo(() => {
    return domainIdNumber ? [domainIdNumber] : []
  }, [domainIdNumber])

  const { isConnected: wsConnected } = useWebSocket({
    domainIds,
    onViolation: handleViolation,
  })

  // Update ref when wsConnected changes
  useEffect(() => {
    wsConnectedRef.current = wsConnected
  }, [wsConnected])

  useEffect(() => {
    if (!domainIdNumber) return

    const loadViolations = async () => {
      try {
        setLoading(true)
        logger.debug('Loading violations', { domainId: domainIdNumber })

        // Fetch last 10 violations (unacknowledged, critical)
        const response = await violationService.getAll({
          domain_id: domainIdNumber,
          acknowledged: false,
          severity: 'critical',
          limit: 10,
        })

        setAlerts(response.items)
        logger.debug('Alerts loaded', { count: response.items.length })

        // Violation history (all violations, last 20)
        const logsResponse = await violationService.getAll({
          domain_id: domainIdNumber,
          limit: 20,
        })
        setLogs(logsResponse.items)
        logger.debug('Violation logs loaded', { count: logsResponse.items.length })
      } catch (err) {
        logger.error('Violation loading error', err)
      } finally {
        setLoading(false)
      }
    }

    // Initial load
    loadViolations()

    // Fallback polling (every 60 seconds) if WebSocket is not connected
    // Use ref to track wsConnected to avoid recreating interval
    const interval = setInterval(() => {
      if (!wsConnectedRef.current) {
        loadViolations()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [domainIdNumber]) // Remove wsConnected from dependencies

  const getPPEIcon = (type: string): ReactNode => {
    const icons: Record<string, ReactNode> = {
      hard_hat: <HardHat className="w-4 h-4" />,
      safety_vest: <Shield className="w-4 h-4" />,
      safety_glasses: <Glasses className="w-4 h-4" />,
      face_mask: <User className="w-4 h-4" />,
      safety_boots: <Footprints className="w-4 h-4" />,
      gloves: <Hand className="w-4 h-4" />,
    }
    return icons[type] || <AlertTriangle className="w-4 h-4" />
  }

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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Recent Violations - Real-time */}
      <div className="card">
        <h3 className="text-section-title mb-4">Recent Violations</h3>
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-30" />
              <p className="text-body">No violations in the last 24 hours</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors border-l-4 border-red-500 shadow-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {alert.missing_ppe.map((ppe, idx) => (
                      <span key={idx} className="text-red-400">
                        {getPPEIcon(ppe.type)}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                      {alert.severity === 'critical' ? 'Critical' : alert.severity === 'high' ? 'High' : 'Medium'}
                    </span>
                  </div>
                  <p className="text-body font-medium">
                    Missing: {alert.missing_ppe.map(ppe => getPPEDisplayName(ppe.type)).join(', ')}
                  </p>
                  <p className="text-caption text-gray-600">
                    Camera #{alert.camera_id} • {formatTime(alert.timestamp)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedViolation(alert)}
                  className="btn-ghost text-xs px-3 py-1 ml-2"
                >
                  Details
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Violation History */}
      <div className="card">
        <h3 className="text-section-title mb-4">Violation History</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-body">No violation history</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors bg-white border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <div className="text-gray-400">
                    {log.missing_ppe[0] && getPPEIcon(log.missing_ppe[0].type)}
                  </div>
                  <div>
                    <p className="text-body">
                      {log.missing_ppe[0] && getPPEDisplayName(log.missing_ppe[0].type)}
                    </p>
                    <p className="text-caption text-gray-600">Camera #{log.camera_id}</p>
                  </div>
                </div>
                <p className="text-caption text-gray-600">{formatTime(log.timestamp)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Violation Detail Modal */}
      {selectedViolation && (
        <ViolationDetailModal
          violation={selectedViolation}
          onClose={() => setSelectedViolation(null)}
        />
      )}
    </div>
  )
}
