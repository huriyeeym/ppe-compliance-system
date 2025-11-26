import { useState, useEffect } from 'react'
import { violationService, type Violation } from '../../lib/api/services'
import { domainService } from '../../lib/api/services'
import { logger } from '../../lib/utils/logger'

interface ViolationsAlertProps {
  domainId?: string
}

/**
 * İnşaat Alanı İhlal Uyarıları
 * 
 * Gerçek kullanım:
 * - API'den son 10 ihlali çeker
 * - Real-time güncelleme (her 30 saniyede bir)
 * - Domain ID'ye göre filtreleme
 */
export default function ViolationsAlert({ domainId }: ViolationsAlertProps) {
  const [alerts, setAlerts] = useState<Violation[]>([])
  const [logs, setLogs] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!domainId) return

    const loadViolations = async () => {
      try {
        setLoading(true)
        // Domain ID'yi bul (type'dan ID'ye çevir)
        const domains = await domainService.getActive()
        const domain = domains.find(d => d.type === domainId)
        if (!domain) {
          logger.warn('Domain not found', { domainType: domainId })
          return
        }

        logger.debug('Loading violations', { domainId: domain.id })

        // Son 10 ihlali çek (onaylanmamış, kritik)
        const response = await violationService.getAll({
          domain_id: domain.id,
          acknowledged: false,
          severity: 'critical',
          limit: 10,
        })

        setAlerts(response.items)
        logger.debug('Alerts loaded', { count: response.items.length })

        // İhlal geçmişi (tüm ihlaller, son 20)
        const logsResponse = await violationService.getAll({
          domain_id: domain.id,
          limit: 20,
        })
        setLogs(logsResponse.items)
        logger.debug('Violation logs loaded', { count: logsResponse.items.length })
      } catch (err) {
        logger.error('İhlal yükleme hatası', err)
      } finally {
        setLoading(false)
      }
    }

    loadViolations()

    // Her 30 saniyede bir yenile
    const interval = setInterval(loadViolations, 30000)
    return () => clearInterval(interval)
  }, [domainId])

  const getPPEIcon = (type: string) => {
    const icons: Record<string, string> = {
      hard_hat: '🔨',
      safety_vest: '🦺',
      safety_glasses: '🥽',
      face_mask: '😷',
      safety_boots: '👢',
      gloves: '🧤',
    }
    return icons[type] || '⚠️'
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
            <div className="text-center py-8 text-slate-500">
              <div className="text-3xl mb-2 opacity-30">✅</div>
              <p className="text-body">No violations in the last 24 hours</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors border-l-4 border-red-500"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {alert.missing_ppe.map((ppe, idx) => (
                      <span key={idx} className="text-lg">
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
                  <p className="text-caption text-slate-500">
                    Camera #{alert.camera_id} • {formatTime(alert.timestamp)}
                  </p>
                </div>
                <button className="btn-ghost text-xs px-3 py-1 ml-2">
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
            <div className="text-center py-8 text-slate-500">
              <p className="text-body">No violation history</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2 hover:bg-slate-900/50 rounded transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="text-lg">
                    {log.missing_ppe[0] && getPPEIcon(log.missing_ppe[0].type)}
                  </div>
                  <div>
                    <p className="text-body">
                      {log.missing_ppe[0] && getPPEDisplayName(log.missing_ppe[0].type)}
                    </p>
                    <p className="text-caption text-slate-500">Camera #{log.camera_id}</p>
                  </div>
                </div>
                <p className="text-caption text-slate-500">{formatTime(log.timestamp)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
