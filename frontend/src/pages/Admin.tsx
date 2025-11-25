import { useState, useEffect } from 'react'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { violationService, type Violation } from '../lib/api/services/violationService'
import { logger } from '../lib/utils/logger'

/**
 * Admin Panel
 * 
 * Yönetici işlemleri:
 * - Kullanıcı yönetimi (CRUD)
 * - Sistem ayarları (email, notification thresholds)
 * - Model yönetimi (domain-model mapping)
 * - İhlal yönetimi (bulk operations, export)
 * - Sistem logları
 * - Genel istatistikler
 */
export default function Admin() {
  const [activeTab, setActiveTab] = useState('users')
  const [domains, setDomains] = useState<Domain[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [violations, setViolations] = useState<Violation[]>([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDomains: 0,
    totalCameras: 0,
    totalViolations: 0,
    unacknowledgedViolations: 0,
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [domainList, cameraList, violationList] = await Promise.all([
        domainService.getAll(),
        cameraService.getAll(),
        violationService.getAll({ limit: 1000 }),
      ])
      setDomains(domainList)
      setCameras(cameraList)
      setViolations(violationList.items)

      const unacknowledged = violationList.items.filter(v => !v.acknowledged).length

      setStats({
        totalUsers: 0, // TODO: User service eklendiğinde
        totalDomains: domainList.length,
        totalCameras: cameraList.length,
        totalViolations: violationList.items.length,
        unacknowledgedViolations: unacknowledged,
      })
    } catch (err) {
      logger.error('Admin stats load error', err)
    }
  }

  const tabs = [
    { id: 'users', label: 'Kullanıcı Yönetimi', icon: '👥' },
    { id: 'settings', label: 'Sistem Ayarları', icon: '⚙️' },
    { id: 'models', label: 'Model Yönetimi', icon: '🤖' },
    { id: 'violations', label: 'İhlal Yönetimi', icon: '⚠️' },
    { id: 'logs', label: 'Sistem Logları', icon: '📋' },
    { id: 'stats', label: 'Genel İstatistikler', icon: '📊' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-page-title mb-1">Yönetici Paneli</h1>
        <p className="text-caption text-slate-500">Sistem yönetimi ve konfigürasyon</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card">
          <div className="text-2xl font-bold text-slate-50 mb-1">{stats.totalUsers}</div>
          <div className="text-caption text-slate-500">Kullanıcı</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-slate-50 mb-1">{stats.totalDomains}</div>
          <div className="text-caption text-slate-500">Domain</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-slate-50 mb-1">{stats.totalCameras}</div>
          <div className="text-caption text-slate-500">Kamera</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-slate-50 mb-1">{stats.totalViolations}</div>
          <div className="text-caption text-slate-500">Toplam İhlal</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-red-400 mb-1">{stats.unacknowledgedViolations}</div>
          <div className="text-caption text-slate-500">Onaylanmamış</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-3 text-sm font-medium transition-all relative
              ${activeTab === tab.id
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-slate-400 hover:text-slate-200'
              }
            `}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">Kullanıcı Yönetimi</h3>
              <button className="btn-primary">+ Kullanıcı Ekle</button>
            </div>
            <div className="p-8 bg-slate-900/30 rounded-lg border border-slate-700 text-center">
              <div className="text-4xl mb-3 opacity-30">👥</div>
              <p className="text-body text-slate-500">Kullanıcı yönetimi yakında...</p>
              <p className="text-caption text-slate-600 mt-2">
                Backend'de user modeli ve authentication eklendiğinde aktif olacak
              </p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h3 className="text-section-title">Sistem Ayarları</h3>
            
            {/* Email Ayarları */}
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <h4 className="font-medium text-slate-50 mb-4">📧 Email Bildirim Ayarları</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-caption text-slate-400 mb-1">SMTP Sunucu</label>
                  <input className="input" placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className="block text-caption text-slate-400 mb-1">SMTP Port</label>
                  <input className="input" type="number" placeholder="587" />
                </div>
                <div>
                  <label className="block text-caption text-slate-400 mb-1">Email Adresi</label>
                  <input className="input" type="email" placeholder="admin@example.com" />
                </div>
                <div>
                  <label className="block text-caption text-slate-400 mb-1">Şifre</label>
                  <input className="input" type="password" placeholder="••••••••" />
                </div>
                <button className="btn-primary">Kaydet</button>
              </div>
            </div>

            {/* Bildirim Eşikleri */}
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <h4 className="font-medium text-slate-50 mb-4">🔔 Bildirim Eşikleri</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-caption text-slate-400 mb-1">
                    Kritik İhlal Eşiği (dakika içinde)
                  </label>
                  <input className="input" type="number" placeholder="15" />
                  <p className="text-xs text-slate-500 mt-1">
                    Belirtilen süre içinde bu kadar ihlal olursa email gönder
                  </p>
                </div>
                <div>
                  <label className="block text-caption text-slate-400 mb-1">
                    Toplu İhlal Eşiği (saat içinde)
                  </label>
                  <input className="input" type="number" placeholder="10" />
                </div>
                <button className="btn-primary">Kaydet</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">Model Yönetimi</h3>
              <button className="btn-primary">+ Model Ekle</button>
            </div>
            <div className="space-y-4">
              {domains.map((domain) => (
                <div key={domain.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{domain.icon}</span>
                      <h4 className="font-medium text-slate-50">{domain.name}</h4>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      domain.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {domain.status === 'active' ? 'Model Atanmış' : 'Model Bekleniyor'}
                    </span>
                  </div>
                  <p className="text-body text-slate-400 mb-3">
                    {domain.status === 'active' 
                      ? 'YOLOv8 (Custom trained) - runs/train/ppe_progressive_chatgpt_stage2/weights/best.pt'
                      : 'Model eğitimi bekleniyor'}
                  </p>
                  {domain.status === 'active' && (
                    <div className="flex gap-2">
                      <button className="btn-ghost text-xs">Model Detayları</button>
                      <button className="btn-ghost text-xs">Model Değiştir</button>
                      <button className="btn-ghost text-xs">Yeniden Eğit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'violations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">İhlal Yönetimi</h3>
              <div className="flex gap-2">
                <button className="btn-secondary">📥 Export CSV</button>
                <button className="btn-secondary">📥 Export JSON</button>
                <button className="btn-primary">Toplu Onayla</button>
              </div>
            </div>
            <div className="space-y-2">
              {violations.slice(0, 20).map((violation) => (
                <div
                  key={violation.id}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="rounded" />
                    <div>
                      <p className="text-body font-medium">
                        Kamera #{violation.camera_id} • {new Date(violation.timestamp).toLocaleString('tr-TR')}
                      </p>
                      <p className="text-caption text-slate-500">
                        {violation.missing_ppe.map(ppe => ppe.type).join(', ')} eksik
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      violation.acknowledged
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {violation.acknowledged ? 'Onaylandı' : 'Beklemede'}
                    </span>
                    <button className="btn-ghost text-xs">Detay</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <h3 className="text-section-title">Sistem Logları</h3>
            <div className="p-8 bg-slate-900/30 rounded-lg border border-slate-700 text-center">
              <div className="text-4xl mb-3 opacity-30">📋</div>
              <p className="text-body text-slate-500">Sistem logları yakında...</p>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-section-title">Genel İstatistikler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <h4 className="font-medium text-slate-50 mb-4">Domain Dağılımı</h4>
                <div className="space-y-2">
                  {domains.map((domain) => {
                    const domainCameras = cameras.filter(c => c.domain_id === domain.id).length
                    const domainViolations = violations.filter(v => v.domain_id === domain.id).length
                    return (
                      <div key={domain.id} className="flex items-center justify-between">
                        <span className="text-body">{domain.icon} {domain.name}</span>
                        <span className="text-caption text-slate-500">
                          {domainCameras} kamera • {domainViolations} ihlal
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <h4 className="font-medium text-slate-50 mb-4">Kamera Durumu</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-body">Aktif Kameralar</span>
                    <span className="text-green-400 font-medium">
                      {cameras.filter(c => c.is_active).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body">Pasif Kameralar</span>
                    <span className="text-slate-400 font-medium">
                      {cameras.filter(c => !c.is_active).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

