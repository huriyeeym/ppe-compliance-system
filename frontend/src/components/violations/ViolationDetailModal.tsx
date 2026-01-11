import { X, User, Camera, Clock, AlertTriangle, MapPin, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { userService, type User } from '../../lib/api/services/userService'
import toast from 'react-hot-toast'

interface ViolationDetailModalProps {
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
    status?: string
    detected_user_id?: number | null
    detected_user?: { id: number; full_name: string; email: string } | null
    face_match_confidence?: number | null
  }
  onClose: () => void
  onUserReassign?: (violationId: number, userId: number | null) => Promise<void>
}

const PPE_LABELS: Record<string, string> = {
  hard_hat: 'Hard Hat',
  safety_vest: 'Safety Vest',
  gloves: 'Gloves',
  safety_boots: 'Safety Boots',
  safety_glasses: 'Safety Glasses',
}

export default function ViolationDetailModal({ violation, onClose, onUserReassign }: ViolationDetailModalProps) {
  const [detectedUser, setDetectedUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [showUserSelect, setShowUserSelect] = useState(false)

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Load detected user if detected_user_id exists
  useEffect(() => {
    if (violation.detected_user_id) {
      loadDetectedUser(violation.detected_user_id)
    } else if (violation.detected_user) {
      // Use provided user data
      setDetectedUser({
        id: violation.detected_user.id,
        full_name: violation.detected_user.full_name,
        email: violation.detected_user.email,
      } as User)
    }
  }, [violation.detected_user_id, violation.detected_user])

  // Load all users for reassignment
  useEffect(() => {
    if (showUserSelect) {
      loadAllUsers()
    }
  }, [showUserSelect])

  const loadDetectedUser = async (userId: number) => {
    setLoadingUser(true)
    try {
      const users = await userService.getAll()
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
      const users = await userService.getAll()
      setAllUsers(users)
    } catch (err) {
      console.error('Error loading users:', err)
      toast.error('Failed to load users')
    }
  }

  const handleReassignUser = async (userId: number | null) => {
    if (!onUserReassign) return
    
    try {
      await onUserReassign(violation.id, userId)
      if (userId) {
        await loadDetectedUser(userId)
      } else {
        setDetectedUser(null)
      }
      setShowUserSelect(false)
      toast.success('User reassigned successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reassign user')
    }
  }

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  }

  const { date, time } = formatDateTime(violation.timestamp)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-section-title text-slate-50">Violation Details</h2>
            <p className="text-caption text-slate-400 mt-1">Violation ID: #{violation.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Snapshot */}
            <div>
              <h3 className="text-body font-semibold text-slate-50 mb-3">Image Record</h3>
              {violation.frame_snapshot ? (
                <div className="relative bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
                  <img
                    src={violation.frame_snapshot}
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
                <div className="bg-slate-950 rounded-lg border border-slate-700 p-12 text-center">
                  <Camera className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-caption text-slate-500">Image record not found</p>
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              {/* Time & Location */}
              <div>
                <h3 className="text-body font-semibold text-slate-50 mb-3">Time & Location</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-purple-400 mt-0.5" />
                    <div>
                      <p className="text-caption text-slate-400">Date & Time</p>
                      <p className="text-body text-slate-50">{date}</p>
                      <p className="text-body text-slate-50">{time}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Camera className="h-5 w-5 text-purple-400 mt-0.5" />
                    <div>
                      <p className="text-caption text-slate-400">Camera</p>
                      <p className="text-body text-slate-50">
                        {violation.camera_name || `Camera #${violation.camera_id}`}
                      </p>
                      {violation.camera_location && (
                        <p className="text-caption text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {violation.camera_location}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Missing PPE */}
              <div>
                <h3 className="text-body font-semibold text-slate-50 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  Missing PPE
                </h3>
                <div className="space-y-2">
                  {violation.missing_ppe.map((ppe, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                    >
                      <span className="text-body text-red-400 font-medium">
                        {PPE_LABELS[ppe.type] || ppe.type}
                      </span>
                      {ppe.required && (
                        <span className="text-caption text-red-400/70">Mandatory</span>
                      )}
                    </div>
                  ))}
                  {violation.missing_ppe.length === 0 && (
                    <p className="text-caption text-slate-500 text-center py-4">
                      No missing PPE found
                    </p>
                  )}
                </div>
              </div>

              {/* Detected PPE */}
              {violation.detected_ppe.length > 0 && (
                <div>
                  <h3 className="text-body font-semibold text-slate-50 mb-3">Detected PPE</h3>
                  <div className="space-y-2">
                    {violation.detected_ppe.map((ppe, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
                      >
                        <span className="text-body text-green-400 font-medium">
                          {PPE_LABELS[ppe.type] || ppe.type}
                        </span>
                        <span className="text-caption text-green-400/70">
                          {(ppe.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detection Confidence */}
              <div>
                <h3 className="text-body font-semibold text-slate-50 mb-3">Detection Confidence</h3>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption text-slate-400">Confidence Score</span>
                    <span className="text-body font-semibold text-slate-50">
                      {(violation.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${violation.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Detected User (Face Recognition) */}
              <div>
                <h3 className="text-body font-semibold text-slate-50 mb-3 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-400" />
                  Identified Person
                </h3>
                {loadingUser ? (
                  <div className="bg-slate-800 rounded-lg p-4 text-center">
                    <p className="text-caption text-slate-400">Loading...</p>
                  </div>
                ) : detectedUser ? (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-body text-blue-400 font-medium">{detectedUser.full_name}</p>
                        <p className="text-caption text-blue-400/70">{detectedUser.email}</p>
                      </div>
                      {violation.face_match_confidence !== null && violation.face_match_confidence !== undefined && (
                        <div className="text-right">
                          <p className="text-caption text-blue-400/70">Match Confidence</p>
                          <p
                            className={`text-body font-semibold ${
                              violation.face_match_confidence >= 0.8
                                ? 'text-green-400'
                                : violation.face_match_confidence >= 0.6
                                ? 'text-yellow-400'
                                : 'text-red-400'
                            }`}
                          >
                            {(violation.face_match_confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                    {violation.face_match_confidence !== null && violation.face_match_confidence !== undefined && (
                      <div className="mt-2">
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              violation.face_match_confidence >= 0.8
                                ? 'bg-green-500'
                                : violation.face_match_confidence >= 0.6
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${violation.face_match_confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {onUserReassign && (
                      <button
                        onClick={() => setShowUserSelect(true)}
                        className="w-full mt-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-sm transition-colors"
                      >
                        Reassign User
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-lg p-4 text-center">
                    <p className="text-caption text-slate-400">No user identified</p>
                    <p className="text-caption text-slate-500 mt-1 text-xs">
                      Face recognition did not find a match for this violation
                    </p>
                    {onUserReassign && (
                      <button
                        onClick={() => setShowUserSelect(true)}
                        className="w-full mt-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-sm transition-colors"
                      >
                        Assign User Manually
                      </button>
                    )}
                  </div>
                )}
                
                {/* User Selection Dropdown */}
                {showUserSelect && (
                  <div className="mt-2 bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <p className="text-caption text-slate-400 mb-2">Select user:</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      <button
                        onClick={() => handleReassignUser(null)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded text-sm text-slate-300"
                      >
                        Clear assignment
                      </button>
                      {allUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleReassignUser(user.id)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded text-sm text-slate-300"
                        >
                          {user.full_name} ({user.email})
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowUserSelect(false)}
                      className="w-full mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Status */}
              {violation.status && (
                <div>
                  <h3 className="text-body font-semibold text-slate-50 mb-3">Status</h3>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <span className="text-body text-yellow-400 font-medium">
                      {violation.status === 'pending' ? 'Pending' :
                       violation.status === 'resolved' ? 'Resolved' :
                       violation.status === 'acknowledged' ? 'Acknowledged' : violation.status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-50 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
