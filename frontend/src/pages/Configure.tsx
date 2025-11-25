import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  domainService,
  type Domain,
  type DomainCreatePayload,
  type DomainRule,
} from '../lib/api/services/domainService'
import {
  cameraService,
  type Camera,
  type CameraCreatePayload,
} from '../lib/api/services/cameraService'
import {
  ppeTypeService,
  type PPEType,
} from '../lib/api/services/ppeTypeService'
import { logger } from '../lib/utils/logger'

type DomainRulesMap = Record<number, DomainRule[]>

type CameraFormState = {
  name: string
  domain_id: string
  source_type: Camera['source_type']
  source_uri: string
  is_active: boolean
  location: string
}

const initialDomainForm: DomainCreatePayload = {
  name: '',
  type: '',
  icon: '🏗️',
  description: '',
  status: 'active',
}

const initialCameraForm: CameraFormState = {
  name: '',
  domain_id: '',
  source_type: 'webcam',
  source_uri: '',
  is_active: true,
  location: '',
}

export default function Configure() {
  const [activeTab, setActiveTab] = useState('domains')
  const [domains, setDomains] = useState<Domain[]>([])
  const [domainRules, setDomainRules] = useState<DomainRulesMap>({})
  const [cameras, setCameras] = useState<Camera[]>([])
  const [ppeTypes, setPpeTypes] = useState<PPEType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [domainFormVisible, setDomainFormVisible] = useState(false)
  const [cameraFormVisible, setCameraFormVisible] = useState(false)
  const [domainForm, setDomainForm] = useState<DomainCreatePayload>(initialDomainForm)
  const [cameraForm, setCameraForm] = useState<CameraFormState>(initialCameraForm)
  const [domainFormError, setDomainFormError] = useState<string | null>(null)
  const [cameraFormError, setCameraFormError] = useState<string | null>(null)
  const [savingDomain, setSavingDomain] = useState(false)
  const [savingCamera, setSavingCamera] = useState(false)

  const ppeTypeLookup = useMemo(() => {
    return ppeTypes.reduce<Record<number, PPEType>>((acc, type) => {
      acc[type.id] = type
      return acc
    }, {})
  }, [ppeTypes])

  useEffect(() => {
    refreshData()
  }, [])

  const refreshData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [domainList, cameraList, ppeList] = await Promise.all([
        domainService.getAll(),
        cameraService.getAll(),
        ppeTypeService.getAll(),
      ])
      setDomains(domainList)
      setCameras(cameraList)
      setPpeTypes(ppeList)

      const rulesEntries = await Promise.all(
        domainList.map(async (domain) => {
          try {
            const rules = await domainService.getRules(domain.id)
            return [domain.id, rules] as const
          } catch (rulesError) {
            logger.error('Domain rules fetch failed', domain.id, rulesError)
            return [domain.id, []] as const
          }
        })
      )
      setDomainRules(Object.fromEntries(rulesEntries))
    } catch (fetchError) {
      logger.error('Configure data fetch failed', fetchError)
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Veriler yüklenirken hata oluştu'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDomainSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDomainFormError(null)

    if (!domainForm.name.trim() || !domainForm.type.trim()) {
      setDomainFormError('Domain adı ve tipi zorunludur')
      return
    }

    setSavingDomain(true)
    try {
      const payload: DomainCreatePayload = {
        ...domainForm,
        name: domainForm.name.trim(),
        type: domainForm.type.trim(),
        icon: domainForm.icon?.trim() || undefined,
        description: domainForm.description?.trim() || undefined,
      }
      const created = await domainService.create(payload)
      setDomains((prev) => [...prev, created])
      const rules = await domainService.getRules(created.id)
      setDomainRules((prev) => ({ ...prev, [created.id]: rules }))
      setDomainForm(initialDomainForm)
      setDomainFormVisible(false)
    } catch (submitError) {
      logger.error('Domain create failed', submitError)
      setDomainFormError(
        submitError instanceof Error
          ? submitError.message
          : 'Domain oluşturulamadı'
      )
    } finally {
      setSavingDomain(false)
    }
  }

  const handleCameraSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCameraFormError(null)

    if (!cameraForm.name.trim() || !cameraForm.domain_id || !cameraForm.source_uri.trim()) {
      setCameraFormError('Kamera adı, domain ve kaynak URI zorunludur')
      return
    }

    const domainId = Number(cameraForm.domain_id)
    if (Number.isNaN(domainId)) {
      setCameraFormError('Geçerli bir domain seçmelisiniz')
      return
    }

    const payload: CameraCreatePayload = {
      name: cameraForm.name.trim(),
      domain_id: domainId,
      source_type: cameraForm.source_type,
      source_uri: cameraForm.source_uri.trim(),
      is_active: cameraForm.is_active,
      location: cameraForm.location?.trim() || undefined,
    }

    setSavingCamera(true)
    try {
      const created = await cameraService.create(payload)
      setCameras((prev) => [...prev, created])
      setCameraForm(initialCameraForm)
      setCameraFormVisible(false)
    } catch (submitError) {
      logger.error('Camera create failed', submitError)
      setCameraFormError(
        submitError instanceof Error
          ? submitError.message
          : 'Kamera eklenemedi'
      )
    } finally {
      setSavingCamera(false)
    }
  }

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

  const getRuleDisplayName = (rule: DomainRule) => {
    const ppeType = ppeTypeLookup[rule.ppe_type_id]
    if (ppeType?.display_name) return ppeType.display_name
    if (ppeType?.name) return ppeType.name
    return `PPE #${rule.ppe_type_id}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title mb-1">Yapılandırma</h1>
        <p className="text-caption text-slate-500">Domainler, kameralar, kullanıcılar ve ML modellerini yönetin</p>
      </div>

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

      <div className="card space-y-4">
        {loading && (
          <div className="p-6 bg-slate-900/40 rounded-lg border border-slate-700 text-center">
            <p className="text-body text-slate-400">Veriler yükleniyor...</p>
          </div>
        )}
        {!loading && error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {activeTab === 'domains' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">Domain Yönetimi</h3>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs" onClick={refreshData}>
                  ↻ Yenile
                </button>
                <button className="btn-primary" onClick={() => setDomainFormVisible((prev) => !prev)}>
                  {domainFormVisible ? 'Formu Gizle' : '+ Domain Ekle'}
                </button>
              </div>
            </div>

            {domainFormVisible && (
              <form
                onSubmit={handleDomainSubmit}
                className="p-4 bg-slate-900/60 rounded-lg border border-slate-700 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">Domain Adı</label>
                    <input
                      className="input"
                      value={domainForm.name}
                      onChange={(e) => setDomainForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="İnşaat Alanı"
                    />
                  </div>
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">Tip (unique)</label>
                    <input
                      className="input"
                      value={domainForm.type}
                      onChange={(e) => setDomainForm((prev) => ({ ...prev, type: e.target.value }))}
                      placeholder="construction"
                    />
                  </div>
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">İkon</label>
                    <input
                      className="input"
                      value={domainForm.icon ?? ''}
                      onChange={(e) => setDomainForm((prev) => ({ ...prev, icon: e.target.value }))}
                      placeholder="🏗️"
                    />
                  </div>
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">Durum</label>
                    <select
                      className="input"
                      value={domainForm.status}
                      onChange={(e) => setDomainForm((prev) => ({ ...prev, status: e.target.value as 'active' | 'planned' }))}
                    >
                      <option value="active">Aktif</option>
                      <option value="planned">Planlanmış</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-caption text-slate-400 block mb-1">Açıklama</label>
                  <textarea
                    className="input min-h-[80px]"
                    value={domainForm.description ?? ''}
                    onChange={(e) => setDomainForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Alanla ilgili detay bilgiler..."
                  />
                </div>
                {domainFormError && (
                  <p className="text-sm text-red-400">{domainFormError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setDomainForm(initialDomainForm)
                      setDomainFormVisible(false)
                    }}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingDomain}
                  >
                    {savingDomain ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {domains.length === 0 && !loading ? (
                <div className="p-6 text-center border border-dashed border-slate-700 rounded-lg text-slate-500">
                  Henüz domain eklenmemiş. Yeni domain eklemek için formu kullanın.
                </div>
              ) : (
                domains.map((domain) => (
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
                        <p className="text-caption text-slate-500">{domain.description || 'Açıklama girilmemiş'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-ghost text-xs">Düzenle</button>
                        <button className="px-3 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-medium hover:bg-red-500/30 transition-all">
                          Sil
                        </button>
                      </div>
                    </div>

                    {domainRules[domain.id] && domainRules[domain.id].length > 0 ? (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <h5 className="text-sm font-medium text-slate-300 mb-3">PPE Kuralları ({domainRules[domain.id].length})</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {domainRules[domain.id].map((rule) => {
                            const priority = getPriorityLabel(rule.priority)
                            return (
                              <div key={rule.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-slate-50">{getRuleDisplayName(rule)}</span>
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
                    ) : (
                      <div className="mt-4 pt-4 border-t border-dashed border-slate-700 text-sm text-slate-500">
                        Bu domain için henüz PPE kuralı yok.
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'cameras' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">Kamera Yönetimi</h3>
              <button className="btn-primary" onClick={() => setCameraFormVisible((prev) => !prev)}>
                {cameraFormVisible ? 'Formu Gizle' : '+ Kamera Ekle'}
              </button>
            </div>

            {cameraFormVisible && (
              <form
                onSubmit={handleCameraSubmit}
                className="p-4 bg-slate-900/60 rounded-lg border border-slate-700 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">Kamera Adı</label>
                    <input
                      className="input"
                      value={cameraForm.name}
                      onChange={(e) => setCameraForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Şantiye Girişi"
                    />
                  </div>
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">Domain</label>
                    <select
                      className="input"
                      value={cameraForm.domain_id}
                      onChange={(e) => setCameraForm((prev) => ({ ...prev, domain_id: e.target.value }))}
                    >
                      <option value="">Domain seçin</option>
                      {domains.map((domain) => (
                        <option key={domain.id} value={domain.id}>{domain.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">Kaynak Tipi</label>
                    <select
                      className="input"
                      value={cameraForm.source_type}
                      onChange={(e) => setCameraForm((prev) => ({ ...prev, source_type: e.target.value as Camera['source_type'] }))}
                    >
                      <option value="webcam">Webcam (device://local0)</option>
                      <option value="rtsp">RTSP Stream</option>
                      <option value="file">Video Dosyası</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">Kaynak URI / Device</label>
                    <input
                      className="input"
                      value={cameraForm.source_uri}
                      onChange={(e) => setCameraForm((prev) => ({ ...prev, source_uri: e.target.value }))}
                      placeholder="rtsp://..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-caption text-slate-400 block mb-1">Lokasyon</label>
                    <input
                      className="input"
                      value={cameraForm.location}
                      onChange={(e) => setCameraForm((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="Bina A, Güvenlik"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      className="accent-purple-500"
                      checked={cameraForm.is_active}
                      onChange={(e) => setCameraForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    />
                    <span className="text-sm text-slate-300">Aktif</span>
                  </div>
                </div>
                {cameraFormError && (
                  <p className="text-sm text-red-400">{cameraFormError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setCameraForm(initialCameraForm)
                      setCameraFormVisible(false)
                    }}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingCamera}
                  >
                    {savingCamera ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {cameras.length === 0 && !loading ? (
                <div className="p-6 text-center border border-dashed border-slate-700 rounded-lg text-slate-500">
                  Henüz kamera eklenmemiş. Önce domain seçip kamera ekleyin.
                </div>
              ) : (
                cameras.map((camera) => {
                  const domain = domains.find((d) => d.id === camera.domain_id)
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
                })
              )}
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
