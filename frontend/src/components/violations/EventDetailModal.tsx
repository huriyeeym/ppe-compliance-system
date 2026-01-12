import { X, Camera, Clock, AlertTriangle, MapPin, UserCheck, TrendingUp, Edit, CheckCircle2, XCircle, Save, Search, UserX } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { userService, type User } from '../../lib/api/services/userService'
import { httpClient } from '../../lib/api/httpClient'
import toast from 'react-hot-toast'

interface EventDetailModalProps {
  violation: {
    id: number
    timestamp: string
    camera_id: number
    camera_name?: string
    camera_location?: string
    person_bbox: { x: number; y: number; w: number; h: number }
    detected_ppe: Array<{ type: string; confidence: number }>
    missing_ppe: Array<{ type: string; required: boolean; priority: number }>
    confidence: number
    frame_snapshot?: string
    snapshot_path?: string
    status?: string
    severity?: string
    detected_user_id?: number | null
    detected_user?: { id: number; full_name: string; email: string } | null
    face_match_confidence?: number | null
    notes?: string
    corrective_action?: string
    assigned_to?: string
  }
  onClose: () => void
  onUpdate?: (violationId: number, updates: any) => Promise<void>
  onUserReassign?: (violationId: number, userId: number | null) => Promise<void>
}

const PPE_LABELS: Record<string, string> = {
  hard_hat: 'Hard Hat',
  safety_vest: 'Safety Vest',
  gloves: 'Gloves',
  safety_boots: 'Safety Boots',
  safety_glasses: 'Safety Glasses',
}

type ViolationStatus = 'open' | 'in_progress' | 'closed' | 'false_positive'

export default function EventDetailModal({ violation, onClose, onUpdate, onUserReassign }: EventDetailModalProps) {
  const [detectedUser, setDetectedUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(violation.detected_user_id || null)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [status, setStatus] = useState<ViolationStatus>(violation.status as ViolationStatus || 'open')
  const [notes, setNotes] = useState(violation.notes || '')
  const [correctiveAction, setCorrectiveAction] = useState(violation.corrective_action || '')
  const [saving, setSaving] = useState(false)

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose, isEditing])

  // Load detected user if detected_user_id exists
  useEffect(() => {
    if (violation.detected_user_id) {
      loadDetectedUser(violation.detected_user_id)
      setSelectedUserId(violation.detected_user_id)
    } else if (violation.detected_user) {
      setDetectedUser({
        id: violation.detected_user.id,
        full_name: violation.detected_user.full_name,
        email: violation.detected_user.email,
      } as User)
      setSelectedUserId(violation.detected_user.id)
    } else {
      setDetectedUser(null)
      setSelectedUserId(null)
    }
  }, [violation.detected_user_id, violation.detected_user])

  // Load all users for reassignment
  useEffect(() => {
    loadAllUsers()
  }, [])

  // Load snapshot image
  useEffect(() => {
    const loadSnapshot = async () => {
      if (violation.snapshot_path) {
        setLoadingSnapshot(true)
        try {
          let normalizedPath = violation.snapshot_path.replace(/\\/g, '/')
          if (!normalizedPath.startsWith('snapshots/')) {
            normalizedPath = `snapshots/${normalizedPath}`
          }
          const axiosInstance = httpClient.getInstance()
          const response = await axiosInstance.get(`/files/${normalizedPath}`, {
            responseType: 'blob'
          })
          const blob = new Blob([response.data])
          const url = URL.createObjectURL(blob)
          setSnapshotUrl(url)
        } catch (err) {
          console.error('Error loading snapshot:', err)
          setSnapshotUrl(null)
        } finally {
          setLoadingSnapshot(false)
        }
      } else if (violation.frame_snapshot) {
        setSnapshotUrl(violation.frame_snapshot)
      } else {
        setSnapshotUrl(null)
      }
    }

    loadSnapshot()

    return () => {
      if (snapshotUrl && snapshotUrl.startsWith('blob:')) {
        URL.revokeObjectURL(snapshotUrl)
      }
    }
  }, [violation.snapshot_path, violation.frame_snapshot])

  const loadDetectedUser = async (userId: number) => {
    setLoadingUser(true)
    try {
      const response = await userService.getAll(0, 1000)
      const users = response.items || []
      const user = users.find(u => u.id === userId)
      if (user) {
        setDetectedUser(user)
      }
    } catch (err) {
      console.error('Error loading detected user:', err)
    } finally {
      setLoadingUser(false)
    }
  }

  const loadAllUsers = async () => {
    try {
      const response = await userService.getAll(0, 1000)
      setAllUsers(response.items || [])
    } catch (err) {
      console.error('Error loading users:', err)
      setAllUsers([])
    }
  }

  const handleReassignUser = async (userId: number | null) => {
    if (!onUserReassign) return
    
    try {
      await onUserReassign(violation.id, userId)
      setSelectedUserId(userId)
      if (userId) {
        await loadDetectedUser(userId)
      } else {
        setDetectedUser(null)
      }
      setShowUserSearch(false)
      setUserSearchQuery('')
      toast.success('User reassigned successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reassign user')
    }
  }

  const handleQuickStatusChange = async (newStatus: ViolationStatus) => {
    if (!onUpdate) return
    
    setSaving(true)
    try {
      await onUpdate(violation.id, { status: newStatus })
      setStatus(newStatus)
      toast.success(`Status changed to ${newStatus.replace('_', ' ')}`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!onUpdate) return
    
    setSaving(true)
    try {
      await onUpdate(violation.id, {
        status,
        notes,
        corrective_action: correctiveAction,
      })
      setIsEditing(false)
      toast.success('Event updated successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update event')
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return null
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      open: { label: 'Open', color: 'text-[#F06548]', bg: 'bg-[#F06548]/10 border-[#F06548]/20' },
      in_progress: { label: 'In Progress', color: 'text-[#F7B84B]', bg: 'bg-[#F7B84B]/10 border-[#F7B84B]/20' },
      closed: { label: 'Closed', color: 'text-[#0AB39C]', bg: 'bg-[#0AB39C]/10 border-[#0AB39C]/20' },
      false_positive: { label: 'False Positive', color: 'text-gray-600', bg: 'bg-gray-100 border-gray-200' },
      pending: { label: 'Pending', color: 'text-[#F7B84B]', bg: 'bg-[#F7B84B]/10 border-[#F7B84B]/20' },
      resolved: { label: 'Resolved', color: 'text-[#0AB39C]', bg: 'bg-[#0AB39C]/10 border-[#0AB39C]/20' },
      acknowledged: { label: 'Acknowledged', color: 'text-[#405189]', bg: 'bg-[#405189]/10 border-[#405189]/20' },
    }
    const statusInfo = statusMap[status] || { label: status, color: 'text-gray-600', bg: 'bg-gray-100 border-gray-200' }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${statusInfo.bg} ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  const getSeverityColor = (severity?: string) => {
    const severityMap: Record<string, { color: string; bg: string }> = {
      critical: { color: 'text-[#F06548]', bg: 'bg-[#F06548]/10 border-[#F06548]/20' },
      high: { color: 'text-orange-600', bg: 'bg-orange-100 border-orange-200' },
      medium: { color: 'text-[#F7B84B]', bg: 'bg-[#F7B84B]/10 border-[#F7B84B]/20' },
      low: { color: 'text-[#405189]', bg: 'bg-[#405189]/10 border-[#405189]/20' },
    }
    return severityMap[severity || 'medium'] || severityMap.medium
  }

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) {
      return allUsers
    }
    const query = userSearchQuery.toLowerCase()
    return allUsers.filter(user => 
      user.full_name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    )
  }, [allUsers, userSearchQuery])

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  }

  const { date, time } = formatDateTime(violation.timestamp)
  const severityInfo = getSeverityColor(violation.severity)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-500">Event ID: #{violation.id}</p>
                {getStatusBadge(status)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isEditing}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Quick Actions Bar */}
        {onUpdate && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-600 mr-2">Quick Actions:</span>
              <button
                onClick={() => handleQuickStatusChange('open')}
                disabled={saving || status === 'open'}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  status === 'open'
                    ? 'bg-[#405189] text-white cursor-not-allowed'
                    : 'bg-white border border-[#E9ECEF] text-[#495057] hover:bg-[#F3F6F9]'
                } disabled:opacity-50`}
              >
                <Clock className="h-3.5 w-3.5" />
                Open
              </button>
              <button
                onClick={() => handleQuickStatusChange('in_progress')}
                disabled={saving || status === 'in_progress'}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  status === 'in_progress'
                    ? 'bg-[#F7B84B] text-white cursor-not-allowed'
                    : 'bg-white border border-[#E9ECEF] text-[#495057] hover:bg-[#F3F6F9]'
                } disabled:opacity-50`}
              >
                <Edit className="h-3.5 w-3.5" />
                In Progress
              </button>
              <button
                onClick={() => handleQuickStatusChange('closed')}
                disabled={saving || status === 'closed'}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  status === 'closed'
                    ? 'bg-[#0AB39C] text-white cursor-not-allowed'
                    : 'bg-white border border-[#E9ECEF] text-[#495057] hover:bg-[#F3F6F9]'
                } disabled:opacity-50`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Close
              </button>
              <button
                onClick={() => handleQuickStatusChange('false_positive')}
                disabled={saving || status === 'false_positive'}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  status === 'false_positive'
                    ? 'bg-gray-500 text-white cursor-not-allowed'
                    : 'bg-white border border-[#E9ECEF] text-[#495057] hover:bg-[#F3F6F9]'
                } disabled:opacity-50`}
              >
                <XCircle className="h-3.5 w-3.5" />
                False Positive
              </button>
            </div>
          </div>
        )}

        {/* Top Info Bar */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Date & Time</p>
                <p className="text-sm font-medium text-gray-900">{date}</p>
                <p className="text-xs text-gray-600">{time}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Camera</p>
                <p className="text-sm font-medium text-gray-900">
                  {violation.camera_name || `Camera #${violation.camera_id}`}
                </p>
                {violation.camera_location && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {violation.camera_location}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Confidence</p>
                <p className="text-sm font-medium text-gray-900">
                  {(violation.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            {violation.severity && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Severity</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityInfo.bg} ${severityInfo.color}`}>
                    {(violation.severity || 'medium').toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Column - Snapshot (Larger) */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Image Record</h3>
              {loadingSnapshot ? (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-12 text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm text-gray-500">Loading image...</p>
                </div>
              ) : snapshotUrl ? (
                <div className="relative bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={snapshotUrl}
                    alt="Violation snapshot"
                    className="w-full h-auto"
                  />
                  {/* Bounding box overlay */}
                  <div
                    className="absolute border-2 border-red-500"
                    style={{
                      left: `${(violation.person_bbox.x / 640) * 100}%`,
                      top: `${(violation.person_bbox.y / 480) * 100}%`,
                      width: `${(violation.person_bbox.w / 640) * 100}%`,
                      height: `${(violation.person_bbox.h / 480) * 100}%`,
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-red-500 px-2 py-1 text-xs font-semibold text-white rounded">
                      Violation Detected
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-12 text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Image record not found</p>
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-4">
              {/* PPE Detection Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#F06548]" />
                  PPE Detection
                </h3>
                <div className="space-y-3">
                  {/* Missing PPE - Tags */}
                  {violation.missing_ppe.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Missing PPE</p>
                      <div className="flex flex-wrap gap-2">
                        {violation.missing_ppe.map((ppe, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#F06548]/10 text-[#F06548] border border-[#F06548]/20"
                          >
                            {PPE_LABELS[ppe.type] || ppe.type}
                            {ppe.required && (
                              <span className="ml-1 text-[#F06548]/70">• Required</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {violation.missing_ppe.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">
                      No PPE information available
                    </p>
                  )}
                </div>
              </div>

              {/* User Assignment Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#405189]" />
                  Identified Person
                </h3>
                {loadingUser ? (
                  <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                    <p className="text-xs text-gray-500">Loading...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detectedUser ? (
                      <div className="bg-[#405189]/5 border border-[#405189]/20 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{detectedUser.full_name}</p>
                            <p className="text-xs text-gray-500">{detectedUser.email}</p>
                          </div>
                          {violation.face_match_confidence !== null && violation.face_match_confidence !== undefined && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                violation.face_match_confidence >= 0.8
                                  ? 'bg-[#0AB39C]/10 text-[#0AB39C] border border-[#0AB39C]/20'
                                  : violation.face_match_confidence >= 0.6
                                  ? 'bg-[#F7B84B]/10 text-[#F7B84B] border border-[#F7B84B]/20'
                                  : 'bg-[#F06548]/10 text-[#F06548] border border-[#F06548]/20'
                              }`}
                            >
                              {(violation.face_match_confidence * 100).toFixed(1)}% match
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                        <p className="text-xs text-gray-600">No user identified</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Face recognition did not find a match
                        </p>
                      </div>
                    )}
                    
                    {onUserReassign && (
                      <div className="space-y-2">
                        {!showUserSearch ? (
                          <button
                            onClick={() => setShowUserSearch(true)}
                            className="w-full px-3 py-2 bg-[#405189] hover:bg-[#405189]/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <UserCheck className="h-4 w-4" />
                            {detectedUser ? 'Change User' : 'Assign User'}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                placeholder="Search by name or email..."
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                                autoFocus
                              />
                            </div>
                            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                              <button
                                onClick={() => {
                                  handleReassignUser(null)
                                  setShowUserSearch(false)
                                  setUserSearchQuery('')
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
                              >
                                <UserX className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700">No user assigned</span>
                              </button>
                              {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                  <button
                                    key={user.id}
                                    onClick={() => {
                                      handleReassignUser(user.id)
                                      setShowUserSearch(false)
                                      setUserSearchQuery('')
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm ${
                                      selectedUserId === user.id ? 'bg-[#405189]/5' : ''
                                    }`}
                                  >
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900">{user.full_name}</p>
                                      <p className="text-xs text-gray-500">{user.email}</p>
                                    </div>
                                    {selectedUserId === user.id && (
                                      <div className="h-2 w-2 rounded-full bg-[#405189]"></div>
                                    )}
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-4 text-center text-sm text-gray-500">
                                  No users found
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setShowUserSearch(false)
                                setUserSearchQuery('')
                              }}
                              className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Management & Notes Section */}
              {onUpdate && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Edit className="h-4 w-4 text-[#405189]" />
                    Management & Notes
                  </h3>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as ViolationStatus)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="closed">Closed</option>
                          <option value="false_positive">False Positive</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] resize-none"
                          placeholder="Add notes about this event..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Corrective Action</label>
                        <textarea
                          value={correctiveAction}
                          onChange={(e) => setCorrectiveAction(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] resize-none"
                          placeholder="Describe corrective action taken..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex-1 px-3 py-2 bg-[#405189] hover:bg-[#405189]/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(false)
                            setStatus(violation.status as ViolationStatus || 'open')
                            setNotes(violation.notes || '')
                            setCorrectiveAction(violation.corrective_action || '')
                          }}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Current Status</p>
                        {getStatusBadge(status)}
                      </div>
                      {notes && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Notes</p>
                          <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{notes}</p>
                        </div>
                      )}
                      {correctiveAction && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Corrective Action</p>
                          <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{correctiveAction}</p>
                        </div>
                      )}
                      {(!notes && !correctiveAction) && (
                        <p className="text-xs text-gray-500 text-center py-2">No notes or actions recorded</p>
                      )}
                      <button
                        onClick={() => setIsEditing(true)}
                        className="w-full px-3 py-2 bg-[#405189] hover:bg-[#405189]/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit Details
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isEditing}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
