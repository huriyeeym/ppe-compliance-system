import { useState, useEffect } from 'react'
import { Camera, Plus, Edit2, Trash2, Power, PowerOff, Video } from 'lucide-react'
import { cameraService, type Camera as CameraType } from '../lib/api/services/cameraService'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { logger } from '../lib/utils/logger'
import toast from 'react-hot-toast'

export default function CameraManagement() {
  const [cameras, setCameras] = useState<CameraType[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCamera, setEditingCamera] = useState<CameraType | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    domain_id: 0,
    source_type: 'webcam' as const,
    source_uri: '0',
    location: '',
    is_active: true,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [cameraList, domainList] = await Promise.all([
        cameraService.getAll(),
        domainService.getActive(),
      ])
      setCameras(cameraList)
      setDomains(domainList)
    } catch (err) {
      logger.error('Failed to load cameras/domains', err)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingCamera(null)
    setFormData({
      name: '',
      domain_id: domains[0]?.id || 0,
      source_type: 'webcam',
      source_uri: '0',
      location: '',
      is_active: true,
    })
    setShowModal(true)
  }

  const openEditModal = (camera: CameraType) => {
    setEditingCamera(camera)
    setFormData({
      name: camera.name,
      domain_id: camera.domain_id,
      source_type: camera.source_type,
      source_uri: camera.source_uri,
      location: camera.location || '',
      is_active: camera.is_active,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCamera) {
        await cameraService.update(editingCamera.id, formData)
        toast.success('Camera updated successfully')
      } else {
        await cameraService.create(formData)
        toast.success('Camera created successfully')
      }
      setShowModal(false)
      loadData()
    } catch (err) {
      logger.error('Failed to save camera', err)
      toast.error('Failed to save camera')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this camera? This will also delete all violations from this camera.')) return
    try {
      await cameraService.delete(id)
      toast.success('Camera deleted successfully')
      loadData()
    } catch (err) {
      logger.error('Failed to delete camera', err)
      toast.error('Failed to delete camera')
    }
  }

  const toggleActive = async (camera: CameraType) => {
    try {
      await cameraService.update(camera.id, { is_active: !camera.is_active })
      toast.success(camera.is_active ? 'Camera deactivated' : 'Camera activated')
      loadData()
    } catch (err) {
      logger.error('Failed to toggle camera status', err)
      toast.error('Failed to update camera status')
    }
  }

  const getDomainName = (domainId: number) => {
    return domains.find(d => d.id === domainId)?.name || 'Unknown'
  }

  const getDomainIcon = (domainId: number) => {
    return domains.find(d => d.id === domainId)?.icon || '📹'
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#E9ECEF] rounded w-1/4"></div>
          <div className="h-64 bg-[#E9ECEF] rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Video className="w-8 h-8 text-[#405189]" />
          <div>
            <h1 className="text-2xl font-semibold text-[#212529]">Camera Management</h1>
            <p className="text-sm text-[#878A99]">Manage cameras for PPE detection across all domains</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#405189] text-white rounded-lg hover:bg-[#364574] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Camera
        </button>
      </div>

      {/* Camera List */}
      <div className="card">
        {cameras.length === 0 ? (
          <div className="text-center py-12">
            <Video className="w-16 h-16 text-[#878A99] mx-auto mb-4" />
            <p className="text-[#878A99] mb-4">No cameras found</p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#405189] text-white rounded-lg hover:bg-[#364574] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Your First Camera
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#E9ECEF]">
              <thead className="bg-[#F3F6F9]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#878A99] uppercase tracking-wider">
                    Camera
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#878A99] uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#878A99] uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#878A99] uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#878A99] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#878A99] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#E9ECEF]">
                {cameras.map((camera) => (
                  <tr key={camera.id} className="hover:bg-[#F3F6F9] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Camera className="w-5 h-5 text-[#878A99] mr-3" />
                        <span className="font-medium text-[#495057]">{camera.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#405189]/10 text-[#405189]">
                        <span>{getDomainIcon(camera.domain_id)}</span>
                        {getDomainName(camera.domain_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#495057]">
                      <div className="flex flex-col">
                        <span className="font-medium">{camera.source_type}</span>
                        <span className="text-xs text-[#878A99]">{camera.source_uri}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#878A99]">
                      {camera.location || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {camera.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#0AB39C]/10 text-[#0AB39C]">
                          <Power className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F06548]/10 text-[#F06548]">
                          <PowerOff className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleActive(camera)}
                          className="p-2 text-[#405189] hover:bg-[#405189]/10 rounded-lg transition-colors"
                          title={camera.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {camera.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openEditModal(camera)}
                          className="p-2 text-[#F7B84B] hover:bg-[#F7B84B]/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(camera.id)}
                          className="p-2 text-[#F06548] hover:bg-[#F06548]/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-[#212529] mb-4">
                {editingCamera ? 'Edit Camera' : 'Add Camera'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#495057] mb-2">Camera Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CED4DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#405189] focus:border-transparent"
                    placeholder="e.g., Construction Site Main Gate"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#495057] mb-2">Domain</label>
                  <select
                    value={formData.domain_id}
                    onChange={(e) => setFormData({ ...formData, domain_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#CED4DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#405189] focus:border-transparent"
                    required
                  >
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.icon} {domain.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#495057] mb-2">Source Type</label>
                  <select
                    value={formData.source_type}
                    onChange={(e) => setFormData({ ...formData, source_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-[#CED4DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#405189] focus:border-transparent"
                    required
                  >
                    <option value="webcam">Webcam</option>
                    <option value="rtsp">RTSP</option>
                    <option value="file">File</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#495057] mb-2">Source URI</label>
                  <input
                    type="text"
                    value={formData.source_uri}
                    onChange={(e) => setFormData({ ...formData, source_uri: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CED4DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#405189] focus:border-transparent"
                    placeholder="0, 1, rtsp://..., file.mp4"
                    required
                  />
                  <p className="text-xs text-[#878A99] mt-1">
                    Webcam: 0, 1, 2... | RTSP: rtsp://192.168.1.100:554/stream | File: path/to/video.mp4
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#495057] mb-2">Location (Optional)</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CED4DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#405189] focus:border-transparent"
                    placeholder="e.g., Warehouse Zone A, Construction Site Gate"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-[#405189] border-[#CED4DA] rounded focus:ring-[#405189]"
                    id="is_active"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-[#495057]">
                    Active
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#E9ECEF]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-[#495057] bg-[#E9ECEF] rounded-lg hover:bg-[#CED4DA] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#405189] text-white rounded-lg hover:bg-[#364574] transition-colors"
                  >
                    {editingCamera ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
