import { useState } from 'react'

interface Domain {
  id: number
  name: string
  type: string
  icon: string
  description: string
  status: 'active' | 'planned'
}

interface DomainPPERule {
  id: number
  domain_id: number
  ppe_type_id: number
  ppe_name: string
  ppe_display_name: string
  is_required: boolean
  priority: number // 1=critical, 2=high, 3=medium
  warning_message?: string
}

interface Camera {
  id: number
  name: string
  domain_id: number
  source_type: 'webcam' | 'rtsp' | 'file'
  source_uri: string
  is_active: boolean
  location?: string
}

export default function Configure() {
  const [activeTab, setActiveTab] = useState('domains')

  // TODO: API calls
  const domains: Domain[] = [
    { id: 1, name: 'İnşaat Alanı', type: 'construction', icon: '🏗️', description: 'İnşaat şantiyesi, açık alan yapım işleri', status: 'active' },
    { id: 2, name: 'Üretim Sanayi', type: 'manufacturing', icon: '🏭', description: 'Fabrika, üretim bandı, montaj alanı', status: 'active' },
    { id: 3, name: 'Madencilik', type: 'mining', icon: '⛏️', description: 'Yeraltı/yerüstü maden ocakları', status: 'planned' },
  ]

  const domainRules: Record<number, DomainPPERule[]> = {
    1: [ // İnşaat
      { id: 1, domain_id: 1, ppe_type_id: 1, ppe_name: 'hard_hat', ppe_display_name: 'Baret', is_required: true, priority: 1, warning_message: 'İnşaat alanında baret zorunludur!' },
      { id: 2, domain_id: 1, ppe_type_id: 2, ppe_name: 'safety_vest', ppe_display_name: 'Reflektif Yelek', is_required: true, priority: 1 },
      { id: 3, domain_id: 1, ppe_type_id: 3, ppe_name: 'safety_boots', ppe_display_name: 'Güvenlik Botu', is_required: true, priority: 2 },
    ],
    2: [ // Üretim
      { id: 4, domain_id: 2, ppe_type_id: 4, ppe_name: 'safety_glasses', ppe_display_name: 'Koruyucu Gözlük', is_required: true, priority: 1 },
      { id: 5, domain_id: 2, ppe_type_id: 5, ppe_name: 'face_mask', ppe_display_name: 'Maske', is_required: true, priority: 1 },
    ],
  }

  const cameras: Camera[] = [
    { id: 1, name: 'Area 1 - Main Entrance', domain_id: 1, source_type: 'rtsp', source_uri: 'rtsp://camera1.local', is_active: true, location: 'Bina A, Giriş' },
    { id: 2, name: 'Area 2 - Construction Zone', domain_id: 1, source_type: 'webcam', source_uri: '/dev/video0', is_active: true, location: 'Şantiye Alanı' },
    { id: 3, name: 'Area 3 - Production Line', domain_id: 2, source_type: 'rtsp', source_uri: 'rtsp://camera3.local', is_active: true, location: 'Üretim Hattı' },
  ]

  const tabs = [
    { id: 'domains', label: 'Domainler & Kurallar', icon: '🏗️' },
    { id: 'cameras', label: 'Kameralar', icon: '📹' },
    { id: 'users', label: 'Kullanıcılar', icon: '👥' },
    { id: 'model', label: 'ML Model', icon: '🤖' },
  ]

  const getPriorityLabel = (priority: number) => {
    const labels: Record<number, { text: string; color: string }> = {
      1: { text: 'Kritik', color: 'bg-red-500/20 text-red-400' },
      2: { text: 'Yüksek', color: 'bg-orange-500/20 text-orange-400' },
      3: { text: 'Orta', color: 'bg-yellow-500/20 text-yellow-400' },
    }
    return labels[priority] || { text: 'Düşük', color: 'bg-blue-500/20 text-blue-400' }
  }

  const getSourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      webcam: 'Webcam',
      rtsp: 'RTSP Stream',
      file: 'Video Dosyası',
    }
    return labels[type] || type
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-page-title mb-1">Yapılandırma</h1>
        <p className="text-caption text-slate-500">Domainler, kameralar, kullanıcılar ve ML modellerini yönetin</p>
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
        {activeTab === 'domains' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">Domain Yönetimi</h3>
              <button className="btn-primary">+ Domain Ekle</button>
            </div>

            {/* Domain List */}
            <div className="space-y-4">
              {domains.map((domain) => (
                <div key={domain.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{domain.icon}</span>
                        <h4 className="font-medium text-slate-50">{domain.name}</h4>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                          domain.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {domain.status === 'active' ? 'Aktif' : 'Planlanmış'}
                        </span>
                      </div>
                      <p className="text-caption text-slate-500">{domain.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-ghost text-xs">Düzenle</button>
                      <button className="px-3 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-medium hover:bg-red-500/30 transition-all">
                        Sil
                      </button>
                    </div>
                  </div>

                  {/* Domain PPE Rules */}
                  {domainRules[domain.id] && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <h5 className="text-sm font-medium text-slate-300 mb-3">PPE Kuralları ({domainRules[domain.id].length})</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {domainRules[domain.id].map((rule) => {
                          const priority = getPriorityLabel(rule.priority)
                          return (
                            <div key={rule.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-slate-50">{rule.ppe_display_name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>
                                  {priority.text}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{rule.is_required ? '✓ Zorunlu' : '○ Opsiyonel'}</span>
                                {rule.warning_message && (
                                  <span className="text-yellow-400">⚠ {rule.warning_message}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <button className="mt-3 btn-ghost text-xs">+ Kural Ekle</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cameras' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">Kamera Yönetimi</h3>
              <button className="btn-primary">+ Kamera Ekle</button>
            </div>
            <div className="space-y-3">
              {cameras.map((camera) => {
                const domain = domains.find(d => d.id === camera.domain_id)
                return (
                  <div key={camera.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-slate-50">{camera.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          camera.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {camera.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                        {domain && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
                            {domain.icon} {domain.name}
                          </span>
                        )}
                      </div>
                      <p className="text-caption text-slate-500 mb-1">
                        <span className="font-medium">{getSourceTypeLabel(camera.source_type)}:</span> {camera.source_uri}
                      </p>
                      {camera.location && (
                        <p className="text-caption text-slate-600">📍 {camera.location}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-ghost text-xs px-3 py-1">Düzenle</button>
                      <button className="px-3 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-medium hover:bg-red-500/30 transition-all">
                        Sil
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <h3 className="text-section-title mb-4">Kullanıcı Yönetimi</h3>
            <div className="p-8 bg-slate-900/30 rounded-lg border border-slate-700 text-center">
              <div className="text-4xl mb-3 opacity-30">👥</div>
              <p className="text-body text-slate-500">Kullanıcı yönetimi arayüzü yakında...</p>
            </div>
          </div>
        )}

        {activeTab === 'model' && (
          <div className="space-y-4">
            <h3 className="text-section-title mb-4">ML Model Yönetimi</h3>
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
                      {domain.status === 'active' ? 'Eğitildi' : 'Beklemede'}
                    </span>
                  </div>
                  <p className="text-body text-slate-400 mb-3">
                    {domain.status === 'active' 
                      ? 'YOLOv8 (Custom trained)' 
                      : 'Model eğitimi bekleniyor'}
                  </p>
                  {domain.status === 'active' && (
                    <div className="flex gap-2">
                      <button className="btn-ghost text-xs">Model Detayları</button>
                      <button className="btn-ghost text-xs">Yeniden Eğit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
