import { useState, useEffect } from 'react'
import { violationService, type Violation, type ViolationFilters } from '../lib/api/services'
import { domainService } from '../lib/api/services'
import { logger } from '../lib/utils/logger'

/**
 * İhlal Raporları Sayfası
 * 
 * İnşaat Alanı için Gerçek Kullanım:
 * 1. İhlal listesi (tarih, kamera, eksik PPE)
 * 2. İhlal detayı (fotoğraf, bounding box, confidence)
 * 3. İhlal onaylama/reddetme
 * 4. Not ekleme
 * 5. Filtreleme (tarih, kamera, PPE türü, severity)
 * 6. Export (PDF/Excel)
 */
export default function Report() {
  const [dateRange, setDateRange] = useState({ from: '2025-11-01', to: '2025-11-10' })
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedPPE, setSelectedPPE] = useState<string>('all')
  const [selectedViolation, setSelectedViolation] = useState<number | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load violations from API
  useEffect(() => {
    const loadViolations = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get construction domain
        const domains = await domainService.getActive()
        const constructionDomain = domains.find(d => d.type === 'construction')
        
        if (!constructionDomain) {
          setError('İnşaat alanı bulunamadı')
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
        logger.error('İhlal yükleme hatası', err)
        setError('İhlal listesi yüklenemedi')
      } finally {
        setLoading(false)
      }
    }

    loadViolations()
  }, [dateRange, selectedSeverity, selectedPPE])

  const getPPEDisplayName = (type: string) => {
    const names: Record<string, string> = {
      hard_hat: 'Baret',
      safety_vest: 'Yelek',
      safety_glasses: 'Gözlük',
      face_mask: 'Maske',
      safety_boots: 'Bot',
      gloves: 'Eldiven',
    }
    return names[type] || type
  }

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('tr-TR', { 
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
      await violationService.acknowledge(violationId, 'current_user') // TODO: Get from auth
      logger.info(`Violation ${violationId} acknowledged`)
      // Reload violations
      window.location.reload() // TODO: Better state management
    } catch (err) {
      logger.error('İhlal onaylama hatası', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="text-4xl mb-4 opacity-30 animate-spin">⏳</div>
            <p className="text-body text-slate-500">Yükleniyor...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="text-4xl mb-4 opacity-30">⚠️</div>
            <h3 className="text-section-title mb-2">Hata</h3>
            <p className="text-body text-slate-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title mb-1">İhlal Raporları</h1>
          <p className="text-caption text-slate-500">İnşaat alanı - Detaylı ihlal kayıtları</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          📥 Export (PDF/Excel)
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-caption text-slate-400 mb-1">Başlangıç</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-caption text-slate-400 mb-1">Bitiş</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-caption text-slate-400 mb-1">Eksik PPE</label>
            <select 
              value={selectedPPE}
              onChange={(e) => setSelectedPPE(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all"
            >
              <option value="all">Tümü</option>
              <option value="hard_hat">Baret</option>
              <option value="safety_vest">Yelek</option>
            </select>
          </div>
          <div>
            <label className="block text-caption text-slate-400 mb-1">Önem</label>
            <select 
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all"
            >
              <option value="all">Tümü</option>
              <option value="critical">Kritik</option>
              <option value="high">Yüksek</option>
            </select>
          </div>
        </div>
      </div>

      {/* Violations Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Zaman</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Kamera</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Eksik PPE</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tespit Edilen</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Önem</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {violations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    İhlal bulunamadı
                  </td>
                </tr>
              ) : (
                violations.map((violation, index) => (
                  <tr 
                    key={violation.id} 
                    className={`
                      hover:bg-slate-700/30 transition-colors cursor-pointer
                      ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'}
                    `}
                    onClick={() => setSelectedViolation(violation.id)}
                  >
                    <td className="px-6 py-4 text-body">{formatDateTime(violation.timestamp)}</td>
                    <td className="px-6 py-4 text-body">Kamera #{violation.camera_id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {violation.missing_ppe.map((ppe, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-medium"
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
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded-md text-xs font-medium"
                          >
                            {getPPEDisplayName(ppe.type)} ({(ppe.confidence * 100).toFixed(0)}%)
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-400">
                        {violation.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {violation.acknowledged ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-md text-xs font-medium">
                          ✓ Onaylandı
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-md text-xs font-medium">
                          Beklemede
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        className="px-4 py-1.5 bg-purple-500/20 text-purple-400 rounded-md text-xs font-medium hover:bg-purple-500/30 transition-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedViolation(violation.id)
                        }}
                      >
                        Detay
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-section-title">İhlal Detayı</h3>
                <button
                  onClick={() => setSelectedViolation(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Frame Snapshot */}
                {violation.frame_snapshot && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-2">İhlal Anı Fotoğrafı</h4>
                    <img 
                      src={violation.frame_snapshot} 
                      alt="Violation snapshot"
                      className="w-full rounded-lg border border-slate-700"
                    />
                  </div>
                )}

                {/* Violation Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-caption text-slate-400 mb-1">Zaman</p>
                    <p className="text-body">{formatDateTime(violation.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-slate-400 mb-1">Kamera</p>
                    <p className="text-body">Kamera #{violation.camera_id}</p>
                  </div>
                  <div>
                    <p className="text-caption text-slate-400 mb-1">Eksik PPE</p>
                    <div className="flex flex-wrap gap-1">
                      {violation.missing_ppe.map((ppe, idx) => (
                        <span key={idx} className="px-2 py-1 bg-red-500/20 text-red-400 rounded-md text-xs">
                          {getPPEDisplayName(ppe.type)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-caption text-slate-400 mb-1">Confidence</p>
                    <p className="text-body">{(violation.confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-700">
                  {!violation.acknowledged && (
                    <button 
                      className="btn-primary"
                      onClick={() => handleAcknowledge(violation.id)}
                    >
                      ✓ Onayla
                    </button>
                  )}
                  <button className="btn-secondary">
                    Not Ekle
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
