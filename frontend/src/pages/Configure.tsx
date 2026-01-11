import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Building2, Video, Bot, Settings, RefreshCw, Plus, Edit, Trash2, CheckCircle2, AlertCircle, Camera as CameraIcon, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { canViewConfigure, canEditConfigure, type UserRole } from '../lib/utils/permissions'
import PermissionGate from '../components/common/PermissionGate'
import {
  domainService,
  type Domain,
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
import CustomSelect from '../components/common/CustomSelect'

type DomainRulesMap = Record<number, DomainRule[]>

type CameraFormState = {
  name: string
  domain_id: number | null
  source_type: Camera['source_type']
  source_uri: string
  is_active: boolean
  location: string
}


const initialCameraForm: CameraFormState = {
  name: '',
  domain_id: null,
  source_type: 'webcam',
  source_uri: '',
  is_active: true,
  location: '',
}

export default function Configure() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('domains')
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
  const [domains, setDomains] = useState<Domain[]>([])
  const [organizationDomains, setOrganizationDomains] = useState<Domain[]>([])
  const [domainRules, setDomainRules] = useState<DomainRulesMap>({})
  const [cameras, setCameras] = useState<Camera[]>([])
  const [ppeTypes, setPpeTypes] = useState<PPEType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraFormVisible, setCameraFormVisible] = useState(false)
  const [cameraForm, setCameraForm] = useState<CameraFormState>(initialCameraForm)
  const [cameraFormError, setCameraFormError] = useState<string | null>(null)
  const [savingCamera, setSavingCamera] = useState(false)
  const [showCameraModalAfterDomainAdd, setShowCameraModalAfterDomainAdd] = useState(false)
  const [selectedDomainForCamera, setSelectedDomainForCamera] = useState<number | null>(null)

  // Check access on mount
  useEffect(() => {
    if (user && !canViewConfigure(user.role as UserRole)) {
      navigate('/')
    }
  }, [user, navigate])

  const isViewOnly = user && !canEditConfigure(user.role as UserRole)

  const selectedDomain = selectedDomainId ? domains.find(d => d.id === selectedDomainId) : null
  const selectedDomainCameras = selectedDomain ? cameras.filter(c => c.domain_id === selectedDomain.id) : []

  // Get organization's domain IDs
  const organizationDomainIds = useMemo(() => {
    return organizationDomains.map(d => d.id)
  }, [organizationDomains])

  const ppeTypeLookup = useMemo(() => {
    return ppeTypes.reduce<Record<number, PPEType>>((acc, type) => {
      acc[type.id] = type
      return acc
    }, {})
  }, [ppeTypes])

  useEffect(() => {
    refreshData()
  }, [])

  // Migration is now handled in refreshData() function
  // This useEffect is kept for backward compatibility but migration happens automatically in refreshData

  // When domain is added and modal is shown, open camera form with domain pre-selected
  useEffect(() => {
    if (showCameraModalAfterDomainAdd && selectedDomainForCamera) {
      setCameraFormVisible(true)
      setCameraForm((prev) => ({ ...prev, domain_id: selectedDomainForCamera }))
      // Switch to cameras tab
      setActiveTab('cameras')
    }
  }, [showCameraModalAfterDomainAdd, selectedDomainForCamera])

  const refreshData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Load organization domains if user has organization_id
      logger.info('Loading organization domains for user:', { 
        userId: user?.id, 
        organizationId: user?.organization_id,
        hasOrganizationId: !!user?.organization_id,
        fullUser: user
      })
      console.log('🔍 User object:', user)
      console.log('🔍 User organization_id:', user?.organization_id)
      
      const orgDomainsPromise = user?.organization_id 
        ? domainService.getOrganizationDomains(user.organization_id).catch((err) => {
            logger.error('Failed to load organization domains, will try migration', err)
            return []
          })
        : Promise.resolve([])
      
      const [domainList, cameraList, ppeList, orgDomains] = await Promise.all([
        domainService.getAll(),
        cameraService.getAll(),
        ppeTypeService.getAll(),
        orgDomainsPromise,
      ])
      
      // If organization domains are empty but user has organization_id, try migration
      let finalOrgDomains = orgDomains
      console.log('📊 Organization domains loaded:', { 
        count: orgDomains.length, 
        organizationId: user?.organization_id,
        domains: orgDomains.map(d => ({ id: d.id, name: d.name }))
      })
      logger.info('Organization domains loaded:', { 
        count: orgDomains.length, 
        organizationId: user?.organization_id,
        domains: orgDomains.map(d => ({ id: d.id, name: d.name }))
      })
      
      if (orgDomains.length === 0 && user?.organization_id) {
        try {
          logger.info('Organization domains empty, attempting migration...', {
            organizationId: user.organization_id,
            userDomains: user?.domains?.map(d => ({ id: d.id, name: d.name }))
          })
          const migrationResult = await domainService.migrateUserDomainsToOrganization(user.organization_id)
          logger.info('Migration completed:', migrationResult)
          
          // Reload organization domains after migration
          finalOrgDomains = await domainService.getOrganizationDomains(user.organization_id)
          logger.info('Organization domains after migration:', {
            count: finalOrgDomains.length,
            domains: finalOrgDomains.map(d => ({ id: d.id, name: d.name }))
          })
        } catch (migrationErr) {
          logger.error('Migration failed during refreshData', migrationErr)
        }
      }
      
      // Filter to show only the 4 integrated domains: Construction, Manufacturing, Mining, Warehouse
      const allowedDomainTypes = ['construction', 'manufacturing', 'mining', 'warehouse']
      const filteredDomains = domainList.filter(domain => 
        allowedDomainTypes.includes(domain.type)
      )
      setDomains(filteredDomains)
      setOrganizationDomains(finalOrgDomains)
      setCameras(cameraList)
      setPpeTypes(ppeList)

      const rulesEntries = await Promise.all(
        filteredDomains.map(async (domain) => {
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
          : 'Error loading data'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCameraSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCameraFormError(null)

    if (!cameraForm.name.trim() || !cameraForm.domain_id || !cameraForm.source_uri.trim()) {
      setCameraFormError('Camera name, domain, and source URI are required')
      return
    }

    if (!cameraForm.domain_id) {
      setCameraFormError('Please select a valid domain')
      return
    }

    const payload: CameraCreatePayload = {
      name: cameraForm.name.trim(),
      domain_id: cameraForm.domain_id,
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
      setShowCameraModalAfterDomainAdd(false)
      setSelectedDomainForCamera(null)
      toast.success(`Camera "${created.name}" created successfully`)
    } catch (submitError: any) {
      logger.error('Camera create failed', submitError)
      // Extract error message from API response
      let errorMessage = 'Failed to add camera'
      if (submitError?.response?.data?.detail) {
        errorMessage = submitError.response.data.detail
      } else if (submitError?.message) {
        errorMessage = submitError.message
      } else if (typeof submitError === 'string') {
        errorMessage = submitError
      }
      setCameraFormError(errorMessage)
    } finally {
      setSavingCamera(false)
    }
  }

  const handleEditCamera = async (cameraId: number) => {
    try {
      // TODO: Implement camera edit modal/form
      logger.info('Edit camera', { cameraId })
      toast.success('Camera edit feature coming soon')
    } catch (err) {
      logger.error('Error editing camera', err)
      toast.error('Failed to edit camera')
    }
  }

  const handleDeleteCamera = async (cameraId: number, cameraName: string) => {
    try {
      const confirmed = window.confirm(`Are you sure you want to delete camera "${cameraName}"?`)
      if (!confirmed) return

      await cameraService.delete(cameraId)
      setCameras((prev) => prev.filter((c) => c.id !== cameraId))
      toast.success(`Camera "${cameraName}" deleted successfully`)
    } catch (err) {
      logger.error('Error deleting camera', err)
      toast.error('Failed to delete camera')
    }
  }

  const handleAddDomainToOrganization = async (domainId: number) => {
    try {
      if (!user?.organization_id) {
        toast.error('Organization not found')
        return
      }
      
      // Add domain to organization
      await domainService.addDomainToOrganization(user.organization_id, domainId)
      
      // Refresh the page data
      await refreshData()
      
      // Show modal to add camera for this domain
      setSelectedDomainForCamera(domainId)
      setShowCameraModalAfterDomainAdd(true)
      
      toast.success('Domain added to your organization successfully')
    } catch (err: any) {
      logger.error('Error adding domain to organization', err)
      toast.error(err?.message || 'Failed to add domain to your organization')
    }
  }

  const handleRemoveDomainFromOrganization = async (domainId: number, domainName: string) => {
    try {
      if (!user?.organization_id) {
        toast.error('Organization not found')
        return
      }
      
      // Check if domain has cameras
      const domainCameras = cameras.filter(c => c.domain_id === domainId)
      if (domainCameras.length > 0) {
        const confirmed = window.confirm(
          `Warning: This domain has ${domainCameras.length} camera(s). Removing it will affect access to these cameras and their violations. Are you sure you want to continue?`
        )
        if (!confirmed) return
      }
      
      // Remove domain from organization
      await domainService.removeDomainFromOrganization(user.organization_id, domainId)
      
      // Refresh the page data
      await refreshData()
      
      // If removed domain was selected, clear selection
      if (selectedDomainId === domainId) {
        setSelectedDomainId(null)
      }
      
      toast.success(`Domain "${domainName}" removed from your organization successfully`)
    } catch (err: any) {
      logger.error('Error removing domain from organization', err)
      toast.error(err?.message || 'Failed to remove domain from your organization')
    }
  }

  // Domain delete and status toggle - only for SUPER_ADMIN
  const handleDeleteDomain = async (domainId: number, domainName: string) => {
    try {
      const confirmed = window.confirm(
        `Are you sure you want to delete domain "${domainName}"? This action cannot be undone and will remove all associated rules and cameras.`
      )
      if (!confirmed) return

      await domainService.delete(domainId)
      setDomains((prev) => prev.filter((d) => d.id !== domainId))
      setDomainRules((prev) => {
        const updated = { ...prev }
        delete updated[domainId]
        return updated
      })
      
      // If deleted domain was selected, clear selection
      if (selectedDomainId === domainId) {
        setSelectedDomainId(null)
      }
      
      toast.success(`Domain "${domainName}" deleted successfully`)
    } catch (err: any) {
      logger.error('Error deleting domain', err)
      toast.error(err?.message || 'Failed to delete domain')
    }
  }

  const handleToggleDomainStatus = async (domainId: number, domainName: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'planned' : 'active'
      const statusLabel = newStatus === 'active' ? 'activate' : 'deactivate'
      
      const confirmed = window.confirm(
        `Are you sure you want to ${statusLabel} domain "${domainName}"?`
      )
      if (!confirmed) return

      await domainService.update(domainId, { status: newStatus as 'active' | 'planned' })
      
      // Update domain in state
      setDomains((prev) =>
        prev.map((d) => (d.id === domainId ? { ...d, status: newStatus } : d))
      )
      
      toast.success(`Domain "${domainName}" ${statusLabel}d successfully`)
    } catch (err: any) {
      logger.error('Error updating domain status', err)
      toast.error(err?.message || 'Failed to update domain status')
    }
  }

  const tabs = [
    { id: 'domains', label: 'Domains & Rules', icon: Building2 },
    { id: 'cameras', label: 'Cameras', icon: Video },
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
      file: 'Video File',
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div>
          <h1 className="text-page-title flex items-center gap-2">
            <Settings className="w-7 h-7 text-[#405189]" />
            Configuration
          </h1>
          <p className="text-caption text-gray-600 mt-1">
            Manage domains, cameras, and PPE rules
          </p>
        </div>
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
                  {isViewOnly && (
                    <span className="text-sm text-gray-500 italic">(View Only)</span>
                  )}
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
                    const isOrganizationDomain = organizationDomainIds.includes(domain.id)
                    
                    return (
                      <div
                        key={domain.id}
                        className={`
                          w-full p-4 rounded-lg border transition-all
                          ${isSelected
                            ? 'bg-[#405189]/5 border-[#405189] shadow-sm'
                            : 'bg-white border-[#E9ECEF] hover:border-[#DEE2E6] hover:shadow-sm'
                          }
                        `}
                      >
                        <button
                          onClick={() => setSelectedDomainId(domain.id)}
                          className="w-full text-left"
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
                              ${isOrganizationDomain
                                ? 'bg-[#0AB39C]/10 text-[#0AB39C]'
                                : 'bg-[#878A99]/10 text-[#878A99]'
                              }
                            `}>
                              {isOrganizationDomain ? 'Integrated' : 'Available'}
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
                        <div className="mt-3 pt-3 border-t border-[#E9ECEF] flex flex-col gap-2">
                          {!isOrganizationDomain && (
                            <PermissionGate roles={['super_admin', 'admin']}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddDomainToOrganization(domain.id)
                                }}
                                className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                Add to Organization
                              </button>
                            </PermissionGate>
                          )}
                          {isOrganizationDomain && (
                            <PermissionGate roles={['super_admin', 'admin']}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveDomainFromOrganization(domain.id, domain.name)
                                }}
                                className="w-full btn-secondary text-sm flex items-center justify-center gap-2 text-[#F06548] hover:bg-[#F06548]/10"
                              >
                                <X className="w-4 h-4" />
                                Remove from Organization
                              </button>
                            </PermissionGate>
                          )}
                          <PermissionGate roles={['super_admin']}>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleDomainStatus(domain.id, domain.name, domain.status)
                                }}
                                className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1 px-2 py-1.5"
                                title={domain.status === 'active' ? 'Deactivate domain' : 'Activate domain'}
                              >
                                {domain.status === 'active' ? (
                                  <>
                                    <X className="w-3 h-3" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    Activate
                                  </>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteDomain(domain.id, domain.name)
                                }}
                                className="btn-secondary text-xs flex items-center justify-center gap-1 px-2 py-1.5 text-[#F06548] hover:bg-[#F06548]/10"
                                title="Delete domain"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </PermissionGate>
                        </div>
                      </div>
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
                    <PermissionGate roles={['super_admin']}>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleToggleDomainStatus(selectedDomain.id, selectedDomain.name, selectedDomain.status)}
                          className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5"
                        >
                          {selectedDomain.status === 'active' ? (
                            <>
                              <X className="w-4 h-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              Activate
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteDomain(selectedDomain.id, selectedDomain.name)}
                          className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5 text-[#F06548] hover:bg-[#F06548]/10"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </PermissionGate>
                    {user?.organization_id && (
                      <PermissionGate roles={['super_admin', 'admin']}>
                        <div className="flex gap-2 mt-3">
                          {organizationDomainIds.includes(selectedDomain.id) ? (
                            <button
                              onClick={() => handleRemoveDomainFromOrganization(selectedDomain.id, selectedDomain.name)}
                              className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5 text-[#F06548] hover:bg-[#F06548]/10"
                            >
                              <X className="w-4 h-4" />
                              Remove from Organization
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddDomainToOrganization(selectedDomain.id)}
                              className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5"
                            >
                              <Plus className="w-4 h-4" />
                              Add to Organization
                            </button>
                          )}
                        </div>
                      </PermissionGate>
                    )}
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
                </div>

                {/* PPE Rules Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-[#495057]">
                      PPE Rules ({domainRules[selectedDomain.id]?.length || 0})
                    </h4>
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


        {/* Cameras Tab */}
        {activeTab === 'cameras' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">Camera Management</h3>
              <PermissionGate roles={['super_admin', 'admin']}>
                <button className="btn-primary flex items-center gap-2" onClick={() => setCameraFormVisible((prev) => !prev)}>
                  <Plus className="w-4 h-4" />
                  <span>{cameraFormVisible ? 'Hide Form' : 'Add Camera'}</span>
                </button>
              </PermissionGate>
              {isViewOnly && (
                <span className="text-sm text-gray-500 italic">(View Only)</span>
              )}
            </div>

            <PermissionGate roles={['super_admin', 'admin']}>
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
                      <CustomSelect
                        value={cameraForm.domain_id ?? ''}
                        onChange={(val) => {
                          const domainId = val === '' || val === null ? null : Number(val)
                          setCameraForm((prev) => ({ ...prev, domain_id: domainId }))
                        }}
                        options={[
                          { value: '', label: 'Select domain' },
                          ...domains.map(domain => ({
                            value: domain.id,
                            label: domain.name
                          }))
                        ]}
                        placeholder="Select domain"
                      />
                    </div>
                    <div>
                      <label className="text-label block mb-1">Source Type</label>
                      <CustomSelect
                        value={cameraForm.source_type}
                        onChange={(val) => setCameraForm((prev) => ({ ...prev, source_type: val as Camera['source_type'] }))}
                        options={[
                          { value: 'webcam', label: 'Webcam' },
                          { value: 'rtsp', label: 'RTSP Stream' },
                          { value: 'file', label: 'Video File' }
                        ]}
                      />
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
                        setShowCameraModalAfterDomainAdd(false)
                        setSelectedDomainForCamera(null)
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
            </PermissionGate>

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
                        <PermissionGate roles={['super_admin', 'admin']}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditCamera(camera.id)}
                              className="btn-ghost flex items-center gap-1 text-xs"
                              title="Edit camera"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteCamera(camera.id, camera.name)}
                              className="btn-danger flex items-center gap-1 text-xs"
                              title="Delete camera"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </PermissionGate>
                      </div>
                    </div>
                  )
                })
              )}
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
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Camera Setup Modal after Domain Addition */}
      {showCameraModalAfterDomainAdd && selectedDomainForCamera && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-title">Domain Added Successfully</h3>
              <button
                onClick={() => {
                  setShowCameraModalAfterDomainAdd(false)
                  setSelectedDomainForCamera(null)
                }}
                className="text-[#878A99] hover:text-[#495057] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-body text-[#495057] mb-6">
              The domain <strong>{domains.find(d => d.id === selectedDomainForCamera)?.name}</strong> has been added to your account.
              Would you like to add a camera for this domain now?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCameraModalAfterDomainAdd(false)
                  setSelectedDomainForCamera(null)
                }}
                className="btn-secondary"
              >
                Maybe Later
              </button>
              <button
                onClick={() => {
                  setShowCameraModalAfterDomainAdd(false)
                  // Camera form will be opened by useEffect
                }}
                className="btn-primary"
              >
                Add Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
