import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, Video, Users, Bot, Settings, RefreshCw, Plus, Edit, Trash2, CheckCircle2, AlertCircle, Camera as CameraIcon } from 'lucide-react'
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
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
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

  const selectedDomain = selectedDomainId ? domains.find(d => d.id === selectedDomainId) : null
  const selectedDomainCameras = selectedDomain ? cameras.filter(c => c.domain_id === selectedDomain.id) : []

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
    { id: 'domains', label: 'Domainler & Kurallar', icon: Building2 },
    { id: 'cameras', label: 'Kameralar', icon: Video },
    { id: 'users', label: 'Kullanıcılar', icon: Users },
    { id: 'model', label: 'ML Model', icon: Bot },
  ]

  const getPriorityLabel = (priority: number) => {
    const labels: Record<number, { text: string; color: string }> = {
      1: { text: 'Critical', color: 'bg-[#F06548]/10 text-[#F06548]' },
      2: { text: 'High', color: 'bg-[#F7B84B]/10 text-[#F7B84B]' },
      3: { text: 'Medium', color: 'bg-[#878A99]/10 text-[#878A99]' },
    }
    return labels[priority] || { text: 'Low', color: 'bg-[#878A99]/10 text-[#878A99]' }
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

  // Calculate summary stats
  const totalDomains = domains.length
  const activeDomains = domains.filter(d => d.status === 'active').length
  const pendingDomains = domains.filter(d => d.status === 'planned').length
  const totalRules = Object.values(domainRules).reduce((sum, rules) => sum + rules.length, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-page-title mb-1">Configure</h1>
        <p className="text-caption">Manage domains, cameras, users, and ML models</p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption mb-1">Total Domains</p>
              <h3 className="text-2xl font-semibold text-[#495057]">{totalDomains}</h3>
            </div>
            <div className="w-12 h-12 bg-[#405189]/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#405189]" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption mb-1">Active Domains</p>
              <h3 className="text-2xl font-semibold text-[#495057]">{activeDomains}</h3>
            </div>
            <div className="w-12 h-12 bg-[#0AB39C]/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[#0AB39C]" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption mb-1">Pending Domains</p>
              <h3 className="text-2xl font-semibold text-[#495057]">{pendingDomains}</h3>
            </div>
            <div className="w-12 h-12 bg-[#F7B84B]/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-[#F7B84B]" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-caption mb-1">Total Rules</p>
              <h3 className="text-2xl font-semibold text-[#495057]">{totalRules}</h3>
            </div>
            <div className="w-12 h-12 bg-[#F06548]/10 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6 text-[#F06548]" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E9ECEF]">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative
                ${activeTab === tab.id
                  ? 'text-[#405189] border-b-2 border-[#405189]'
                  : 'text-[#878A99] hover:text-[#495057]'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="card text-center py-12">
          <p className="text-body text-[#878A99]">Loading data...</p>
        </div>
      )}
      {!loading && error && (
        <div className="card p-4 bg-[#F06548]/10 border border-[#F06548]/30 rounded-lg text-[#F06548] text-sm">
          {error}
        </div>
      )}

      {/* Domains Tab - Master-Detail Layout */}
      {!loading && !error && activeTab === 'domains' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Domain List (Master) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-section-title">Domains</h3>
                <div className="flex gap-2">
                  <button 
                    className="p-2 text-[#878A99] hover:text-[#495057] hover:bg-[#F3F6F9] rounded-md transition-colors"
                    onClick={refreshData}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button 
                    className="btn-primary flex items-center gap-2"
                    onClick={() => setDomainFormVisible((prev) => !prev)}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </div>
              </div>

              {/* Domain List */}
              <div className="space-y-2">
                {domains.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-[#E9ECEF] rounded-lg text-[#878A99] text-sm">
                    No domains yet. Add a new domain to get started.
                  </div>
                ) : (
                  domains.map((domain) => {
                    const domainCameras = cameras.filter(c => c.domain_id === domain.id)
                    const domainRulesCount = domainRules[domain.id]?.length || 0
                    const isSelected = selectedDomainId === domain.id
                    
                    return (
                      <button
                        key={domain.id}
                        onClick={() => setSelectedDomainId(domain.id)}
                        className={`
                          w-full text-left p-4 rounded-lg border transition-all
                          ${isSelected
                            ? 'bg-[#405189]/5 border-[#405189] shadow-sm'
                            : 'bg-white border-[#E9ECEF] hover:border-[#DEE2E6] hover:shadow-sm'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className={`w-5 h-5 ${isSelected ? 'text-[#405189]' : 'text-[#878A99]'}`} />
                            <h4 className={`font-medium ${isSelected ? 'text-[#405189]' : 'text-[#495057]'}`}>
                              {domain.name}
                            </h4>
                          </div>
                          <span className={`
                            px-2 py-0.5 rounded text-xs font-medium
                            ${domain.status === 'active'
                              ? 'bg-[#0AB39C]/10 text-[#0AB39C]'
                              : 'bg-[#F7B84B]/10 text-[#F7B84B]'
                            }
                          `}>
                            {domain.status === 'active' ? 'Active' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs text-[#878A99] mb-2 line-clamp-1">
                          {domain.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-[#878A99]">
                          <span className="flex items-center gap-1">
                            <CameraIcon className="w-3 h-3" />
                            {domainCameras.length}
                          </span>
                          <span className="flex items-center gap-1">
                            <Settings className="w-3 h-3" />
                            {domainRulesCount} rules
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: Domain Details (Detail) */}
          <div className="col-span-12 lg:col-span-8">
            {selectedDomain ? (
              <div className="card space-y-6">
                {/* Domain Header */}
                <div className="flex items-start justify-between pb-4 border-b border-[#E9ECEF]">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="w-6 h-6 text-[#405189]" />
                      <h3 className="text-section-title">{selectedDomain.name}</h3>
                      <span className={`
                        px-2 py-1 rounded-md text-xs font-medium
                        ${selectedDomain.status === 'active'
                          ? 'bg-[#0AB39C]/10 text-[#0AB39C]'
                          : 'bg-[#F7B84B]/10 text-[#F7B84B]'
                        }
                      `}>
                        {selectedDomain.status === 'active' ? 'Active' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-body text-[#878A99] mb-4">
                      {selectedDomain.description || 'No description provided'}
                    </p>
                    
                    {/* Domain Summary Stats */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#E9ECEF]">
                      <div>
                        <p className="text-xs text-[#878A99] mb-1">Cameras</p>
                        <p className="text-lg font-semibold text-[#495057]">
                          {selectedDomainCameras.length}
                        </p>
                        <p className="text-xs text-[#878A99]">
                          {selectedDomainCameras.filter(c => c.is_active).length} active
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#878A99] mb-1">PPE Rules</p>
                        <p className="text-lg font-semibold text-[#495057]">
                          {domainRules[selectedDomain.id]?.length || 0}
                        </p>
                        <p className="text-xs text-[#878A99">
                          {domainRules[selectedDomain.id]?.filter(r => r.is_required).length || 0} required
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#878A99] mb-1">ML Model</p>
                        <p className="text-lg font-semibold text-[#495057]">
                          PPE-YOLOv8
                        </p>
                        <p className="text-xs text-[#878A99]">
                          v1.2 • mAP: 0.88
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button className="btn-secondary flex items-center gap-2">
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button className="btn-danger flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* PPE Rules Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-[#495057]">
                      PPE Rules ({domainRules[selectedDomain.id]?.length || 0})
                    </h4>
                    <button className="btn-ghost flex items-center gap-1 text-xs">
                      <Plus className="w-3 h-3" />
                      <span>Add Rule</span>
                    </button>
                  </div>

                  {domainRules[selectedDomain.id] && domainRules[selectedDomain.id].length > 0 ? (
                    <div className="space-y-2">
                      {domainRules[selectedDomain.id].map((rule) => {
                        const priority = getPriorityLabel(rule.priority)
                        return (
                          <div key={rule.id} className="p-4 bg-[#F3F6F9] rounded-lg border border-[#E9ECEF]">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {rule.is_required ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#0AB39C]" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-[#878A99]" />
                                )}
                                <span className="font-medium text-[#495057]">{getRuleDisplayName(rule)}</span>
                              </div>
                              <span className={`
                                px-2 py-0.5 rounded text-xs font-medium
                                ${priority.text === 'Kritik' 
                                  ? 'bg-[#F06548]/10 text-[#F06548]'
                                  : priority.text === 'Yüksek'
                                  ? 'bg-[#F7B84B]/10 text-[#F7B84B]'
                                  : 'bg-[#878A99]/10 text-[#878A99]'
                                }
                              `}>
                                {priority.text}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#878A99]">
                              <span>{rule.is_required ? 'Required' : 'Optional'}</span>
                              {rule.warning_message && (
                                <span className="text-[#F7B84B]">⚠ {rule.warning_message}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center border border-dashed border-[#E9ECEF] rounded-lg text-[#878A99] text-sm">
                      No PPE rules defined for this domain.
                    </div>
                  )}
                </div>

                {/* Cameras Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-[#495057]">
                      Cameras ({selectedDomainCameras.length})
                    </h4>
                  </div>

                  {selectedDomainCameras.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDomainCameras.map((camera) => (
                        <div key={camera.id} className="p-4 bg-[#F3F6F9] rounded-lg border border-[#E9ECEF]">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <CameraIcon className="w-4 h-4 text-[#405189]" />
                              <span className="font-medium text-[#495057]">{camera.name}</span>
                              <span className={`
                                px-2 py-0.5 rounded text-xs font-medium
                                ${camera.is_active
                                  ? 'bg-[#0AB39C]/10 text-[#0AB39C]'
                                  : 'bg-[#878A99]/10 text-[#878A99]'
                                }
                              `}>
                                {camera.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-[#878A99] mb-1">
                            <span className="font-medium">{getSourceTypeLabel(camera.source_type)}:</span> {camera.source_uri}
                          </p>
                          {camera.location && (
                            <p className="text-xs text-[#878A99]">📍 {camera.location}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center border border-dashed border-[#E9ECEF] rounded-lg text-[#878A99] text-sm">
                      No cameras assigned to this domain.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-[#878A99] mx-auto mb-4" />
                  <p className="text-body text-[#878A99]">Select a domain from the list to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Add Domain Form - Outside master-detail, shown when form is visible */}
        {domainFormVisible && activeTab === 'domains' && (
          <div className="card">
            <h3 className="text-section-title mb-4">Add New Domain</h3>
            <form onSubmit={handleDomainSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-label block mb-1">Domain Name</label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    value={domainForm.name}
                    onChange={(e) => setDomainForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Construction Site"
                  />
                </div>
                <div>
                  <label className="text-label block mb-1">Type (unique)</label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    value={domainForm.type}
                    onChange={(e) => setDomainForm((prev) => ({ ...prev, type: e.target.value }))}
                    placeholder="construction"
                  />
                </div>
                <div>
                  <label className="text-label block mb-1">Icon (emoji)</label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    value={domainForm.icon ?? ''}
                    onChange={(e) => setDomainForm((prev) => ({ ...prev, icon: e.target.value }))}
                    placeholder="🏗️"
                  />
                </div>
                <div>
                  <label className="text-label block mb-1">Status</label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    value={domainForm.status}
                    onChange={(e) => setDomainForm((prev) => ({ ...prev, status: e.target.value as 'active' | 'planned' }))}
                  >
                    <option value="active">Active</option>
                    <option value="planned">Planned</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-label block mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] min-h-[80px]"
                  value={domainForm.description ?? ''}
                  onChange={(e) => setDomainForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Domain description..."
                />
              </div>
              {domainFormError && (
                <p className="text-sm text-[#F06548]">{domainFormError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDomainForm(initialDomainForm)
                    setDomainFormVisible(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingDomain}
                >
                  {savingDomain ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cameras Tab */}
        {activeTab === 'cameras' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">Camera Management</h3>
              <button className="btn-primary flex items-center gap-2" onClick={() => setCameraFormVisible((prev) => !prev)}>
                <Plus className="w-4 h-4" />
                <span>{cameraFormVisible ? 'Hide Form' : 'Add Camera'}</span>
              </button>
            </div>

            {cameraFormVisible && (
              <div className="card">
                <h3 className="text-section-title mb-4">Add New Camera</h3>
                <form onSubmit={handleCameraSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-label block mb-1">Camera Name</label>
                      <input
                        className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                        value={cameraForm.name}
                        onChange={(e) => setCameraForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Site Entrance"
                      />
                    </div>
                    <div>
                      <label className="text-label block mb-1">Domain</label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                        value={cameraForm.domain_id}
                        onChange={(e) => setCameraForm((prev) => ({ ...prev, domain_id: e.target.value }))}
                      >
                        <option value="">Select domain</option>
                        {domains.map((domain) => (
                          <option key={domain.id} value={domain.id}>{domain.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-label block mb-1">Source Type</label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                        value={cameraForm.source_type}
                        onChange={(e) => setCameraForm((prev) => ({ ...prev, source_type: e.target.value as Camera['source_type'] }))}
                      >
                        <option value="webcam">Webcam</option>
                        <option value="rtsp">RTSP Stream</option>
                        <option value="file">Video File</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-label block mb-1">Source URI / Device</label>
                      <input
                        className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                        value={cameraForm.source_uri}
                        onChange={(e) => setCameraForm((prev) => ({ ...prev, source_uri: e.target.value }))}
                        placeholder="rtsp://..."
                      />
                    </div>
                    <div>
                      <label className="text-label block mb-1">Location</label>
                      <input
                        className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-md text-sm text-[#495057] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                        value={cameraForm.location}
                        onChange={(e) => setCameraForm((prev) => ({ ...prev, location: e.target.value }))}
                        placeholder="Building A, Security"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-[#405189] border-[#E9ECEF] rounded focus:ring-[#405189]"
                        checked={cameraForm.is_active}
                        onChange={(e) => setCameraForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                      />
                      <span className="text-sm text-[#495057]">Active</span>
                    </div>
                  </div>
                  {cameraFormError && (
                    <p className="text-sm text-[#F06548]">{cameraFormError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setCameraForm(initialCameraForm)
                        setCameraFormVisible(false)
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={savingCamera}
                    >
                      {savingCamera ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {cameras.length === 0 && !loading ? (
                <div className="card text-center py-12">
                  <Video className="w-12 h-12 text-[#878A99] mx-auto mb-4" />
                  <p className="text-body text-[#878A99]">No cameras added yet. Add a camera to get started.</p>
                </div>
              ) : (
                cameras.map((camera) => {
                  const domain = domains.find((d) => d.id === camera.domain_id)
                  return (
                    <div key={camera.id} className="card">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CameraIcon className="w-5 h-5 text-[#405189]" />
                            <h4 className="font-medium text-[#495057]">{camera.name}</h4>
                            <span className={`
                              px-2 py-0.5 rounded text-xs font-medium
                              ${camera.is_active
                                ? 'bg-[#0AB39C]/10 text-[#0AB39C]'
                                : 'bg-[#878A99]/10 text-[#878A99]'
                              }
                            `}>
                              {camera.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {domain && (
                              <span className="px-2 py-0.5 bg-[#405189]/10 text-[#405189] rounded text-xs font-medium">
                                {domain.name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#878A99] mb-1">
                            <span className="font-medium">{getSourceTypeLabel(camera.source_type)}:</span> {camera.source_uri}
                          </p>
                          {camera.location && (
                            <p className="text-xs text-[#878A99]">📍 {camera.location}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button className="btn-ghost flex items-center gap-1 text-xs">
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button className="btn-danger flex items-center gap-1 text-xs">
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="card">
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#878A99] mx-auto mb-4" />
              <h3 className="text-section-title mb-2">User Management</h3>
              <p className="text-body text-[#878A99]">User management interface coming soon...</p>
            </div>
          </div>
        )}

        {/* ML Model Tab */}
        {activeTab === 'model' && (
          <div className="space-y-4">
            <h3 className="text-section-title">ML Model Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {domains.map((domain) => (
                <div key={domain.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-[#405189]" />
                      <h4 className="font-medium text-[#495057]">{domain.name}</h4>
                    </div>
                    <span className={`
                      px-2 py-1 rounded-md text-xs font-medium
                      ${domain.status === 'active'
                        ? 'bg-[#0AB39C]/10 text-[#0AB39C]'
                        : 'bg-[#F7B84B]/10 text-[#F7B84B]'
                      }
                    `}>
                      {domain.status === 'active' ? 'Trained' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-body text-[#878A99] mb-3">
                    {domain.status === 'active'
                      ? 'YOLOv8 (Custom trained)'
                      : 'Model training pending'}
                  </p>
                  {domain.status === 'active' && (
                    <div className="flex gap-2">
                      <button className="btn-ghost text-xs">Model Details</button>
                      <button className="btn-ghost text-xs">Retrain</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
