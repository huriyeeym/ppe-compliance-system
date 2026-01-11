import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UserPlus, Edit, Trash2, Shield, Crown, Eye, Mail, User as UserIcon, Camera, X, Star, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { userService, type User, type CreateUserPayload, type UpdateUserPayload, type UserPhoto } from '../lib/api/services/userService'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { logger } from '../lib/utils/logger'
import { useAuth } from '../context/AuthContext'
import CustomSelect from '../components/common/CustomSelect'
import KPICard from '../components/dashboard/KPICard'

/**
 * User Management Page
 * 
 * Manage system users, roles, and permissions
 */
export default function UserManagement() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [organizationDomains, setOrganizationDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedUserForPhoto, setSelectedUserForPhoto] = useState<User | null>(null)
  const [userPhotos, setUserPhotos] = useState<UserPhoto[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({})
  const [editingUserPhotos, setEditingUserPhotos] = useState<UserPhoto[]>([])
  const [loadingEditingUserPhotos, setLoadingEditingUserPhotos] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name') // 'name', 'email', 'date', 'role'
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [pagination, setPagination] = useState({ skip: 0, limit: 20 })
  const [totalUsers, setTotalUsers] = useState(0)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; userId: number | null; userName: string }>({ show: false, userId: null, userName: '' })
  const [newUser, setNewUser] = useState<CreateUserPayload>({
    email: '',
    full_name: '',
    password: '',
    role: 'viewer',
    domain_ids: [],
    permissions: [],
  })

  // Check if user has admin access
  useEffect(() => {
    if (user) {
      const canAccessAdmin = user.role === 'super_admin' || user.role === 'admin'
      if (!canAccessAdmin) {
        toast.error('You do not have permission to access this page')
        navigate('/')
      }
    }
  }, [user, navigate])

  useEffect(() => {
    loadData()
  }, [user?.organization_id, pagination.skip, pagination.limit])

  // Pre-fill form when editing user
  useEffect(() => {
    if (editingUser) {
      setNewUser({
        email: editingUser.email,
        full_name: editingUser.full_name,
        password: '', // Don't pre-fill password
        role: editingUser.role,
        domain_ids: editingUser.domains?.map(d => d.id) || [],
        permissions: [],
      })
    }
  }, [editingUser])

  const loadData = async () => {
    setLoading(true)
    try {
      console.log('🔍 Loading users for user:', {
        userId: user?.id,
        userEmail: user?.email,
        userRole: user?.role,
        organizationId: user?.organization_id,
        hasOrganizationId: !!user?.organization_id
      })
      
      // Load users (backend automatically filters by organization)
      const response = await userService.getAll(pagination.skip, pagination.limit).catch((err: any) => {
        console.error('❌ Failed to load users:', err)
        console.error('❌ Error details:', {
          message: err?.message,
          response: err?.response?.data,
          status: err?.response?.status,
          statusText: err?.response?.statusText
        })
        toast.error(err?.response?.data?.detail || err?.message || 'Failed to load users')
        return { items: [], total: 0, skip: 0, limit: 20 }
      })
      
      console.log('📊 Loaded users:', {
        count: response.items.length,
        total: response.total,
        users: response.items.map(u => ({ id: u.id, email: u.email, organization_id: u.organization_id }))
      })
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/61aff5a8-2abc-427c-9b0c-e65f708f0829', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'frontend/src/pages/UserManagement.tsx:100',
          message: 'Loaded users with domains',
          data: {
            usersCount: response.items.length,
            users: response.items.map(u => ({
              id: u.id,
              email: u.email,
              domainsCount: u.domains?.length || 0,
              domainsIds: u.domains?.map(d => d.id) || [],
              hasDomains: !!u.domains
            }))
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'B'
        })
      }).catch(() => {});
      // #endregion
      
      setUsers(response.items)
      setTotalUsers(response.total)
      
      // Load organization domains if user has organization_id
      if (user?.organization_id) {
        try {
          const orgDomains = await domainService.getOrganizationDomains(user.organization_id)
          console.log('📦 Organization domains:', {
            count: orgDomains.length,
            domains: orgDomains.map(d => ({ id: d.id, name: d.name }))
          })
          setOrganizationDomains(orgDomains)
        } catch (err) {
          logger.warn('Failed to load organization domains', err)
          console.error('❌ Failed to load organization domains:', err)
          setOrganizationDomains([])
        }
      } else {
        console.warn('⚠️ User has no organization_id, cannot load organization domains')
        setOrganizationDomains([])
      }
    } catch (err) {
      logger.error('User management data load error', err)
      console.error('❌ User management data load error:', err)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="w-4 h-4 text-[#F7B84B]" />
      case 'admin':
        return <Shield className="w-4 h-4 text-[#405189]" />
      case 'manager':
        return <Shield className="w-4 h-4 text-[#0AB39C]" />
      case 'operator':
        return <UserIcon className="w-4 h-4 text-[#405189]" />
      case 'viewer':
        return <Eye className="w-4 h-4 text-gray-500" />
      default:
        return <UserIcon className="w-4 h-4 text-gray-500" />
    }
  }

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      manager: 'Manager',
      operator: 'Operator',
      viewer: 'Viewer',
    }
    return roleMap[role] || role
  }

  const handleEditUser = async (userId: number) => {
    try {
      const userToEdit = users.find(u => u.id === userId)
      if (!userToEdit) {
        toast.error('User not found')
        return
      }
      setEditingUser(userToEdit)
      setShowUserForm(true)
      
      // Load user photos for edit modal
      setLoadingEditingUserPhotos(true)
      try {
        const photos = await userService.getPhotos(userId)
        setEditingUserPhotos(photos)
      } catch (err) {
        logger.error('Error loading user photos for edit', err)
        setEditingUserPhotos([])
      } finally {
        setLoadingEditingUserPhotos(false)
      }
    } catch (err) {
      logger.error('Error editing user', err)
      toast.error('Failed to load user data')
    }
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    try {
      const updatePayload: UpdateUserPayload = {
        full_name: newUser.full_name || editingUser.full_name,
        email: newUser.email || editingUser.email,
        role: newUser.role || editingUser.role,
        is_active: editingUser.is_active,
      }

      // Only include password if it was changed
      if (newUser.password && newUser.password.length > 0) {
        updatePayload.password = newUser.password
      }

      // Always include domain_ids to update domain access
      // domain_ids is always set in useEffect when editingUser changes
      updatePayload.domain_ids = newUser.domain_ids || []

      await userService.update(editingUser.id, updatePayload)
      toast.success('User updated successfully')
      setEditingUser(null)
      setShowUserForm(false)
      setEditingUserPhotos([])
      setNewUser({
        email: '',
        full_name: '',
        password: '',
        role: user?.role === 'super_admin' ? 'operator' : 'viewer',
        domain_ids: [],
        permissions: [],
      })
      await loadData()
    } catch (err: any) {
      logger.error('Error updating user', err)
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to update user'
      toast.error(errorMessage)
    }
  }

  const handleDeleteUser = (userId: number, userName: string) => {
    setDeleteConfirmModal({ show: true, userId, userName })
  }

  const confirmDeleteUser = async () => {
    if (!deleteConfirmModal.userId) return

    try {
      await userService.delete(deleteConfirmModal.userId)
      logger.info('Delete user', { userId: deleteConfirmModal.userId })
      toast.success(`User "${deleteConfirmModal.userName}" deleted successfully`)

      // Close modal and reload data
      setDeleteConfirmModal({ show: false, userId: null, userName: '' })
      await loadData()
    } catch (err) {
      logger.error('Error deleting user', err)
      toast.error('Failed to delete user')
    }
  }

  const getPhotoUrl = async (photoPath: string): Promise<string> => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    const token = localStorage.getItem('auth_token')
    
    const response = await fetch(`${apiBaseUrl}/api/v1/files/${photoPath}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to load photo: ${response.statusText}`)
    }
    
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  const handleOpenPhotoModal = async (user: User) => {
    setSelectedUserForPhoto(user)
    setShowPhotoModal(true)
    try {
      const photos = await userService.getPhotos(user.id)
      setUserPhotos(photos)
      
      // Load photo URLs with authentication
      const urls: Record<number, string> = {}
      for (const photo of photos) {
        try {
          const url = await getPhotoUrl(photo.photo_path)
          urls[photo.id] = url
        } catch (err) {
          logger.error('Error loading photo URL', { photoId: photo.id, err })
        }
      }
      setPhotoUrls(urls)
    } catch (err: any) {
      logger.error('Error loading photos', err)
      toast.error('Failed to load photos')
      setUserPhotos([])
    }
  }

  const handleClosePhotoModal = () => {
    // Clean up blob URLs
    Object.values(photoUrls).forEach(url => URL.revokeObjectURL(url))
    setPhotoUrls({})
    setShowPhotoModal(false)
    setSelectedUserForPhoto(null)
    setUserPhotos([])
  }

  const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedUserForPhoto) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setUploadingPhoto(true)
    try {
      const isPrimary = userPhotos.length === 0 // First photo is primary
      const photo = await userService.uploadPhoto(selectedUserForPhoto.id, file, isPrimary)
      toast.success('Photo uploaded successfully')
      
      // Reload photos and URLs
      const photos = await userService.getPhotos(selectedUserForPhoto.id)
      setUserPhotos(photos)
      
      // Reload all photo URLs
      const urls: Record<number, string> = { ...photoUrls }
      for (const p of photos) {
        if (!urls[p.id]) {
          try {
            const url = await getPhotoUrl(p.photo_path)
            urls[p.id] = url
          } catch (err) {
            logger.error('Error loading photo URL', { photoId: p.id, err })
          }
        }
      }
      setPhotoUrls(urls)
      
      // Reset file input
      event.target.value = ''
    } catch (err: any) {
      logger.error('Error uploading photo', err)
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to upload photo'
      toast.error(errorMessage)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = async (photoId: number) => {
    if (!selectedUserForPhoto) return

    const confirmed = window.confirm('Are you sure you want to delete this photo?')
    if (!confirmed) return

    try {
      // Clean up blob URL before deleting
      if (photoUrls[photoId]) {
        URL.revokeObjectURL(photoUrls[photoId])
      }
      
      await userService.deletePhoto(selectedUserForPhoto.id, photoId)
      toast.success('Photo deleted successfully')
      
      // Reload photos and URLs
      const photos = await userService.getPhotos(selectedUserForPhoto.id)
      setUserPhotos(photos)
      
      // Reload all photo URLs
      const urls: Record<number, string> = {}
      for (const photo of photos) {
        try {
          const url = await getPhotoUrl(photo.photo_path)
          urls[photo.id] = url
        } catch (err) {
          logger.error('Error loading photo URL', { photoId: photo.id, err })
        }
      }
      setPhotoUrls(urls)
    } catch (err: any) {
      logger.error('Error deleting photo', err)
      toast.error('Failed to delete photo')
    }
  }

  const handleSetPrimaryPhoto = async (photoId: number) => {
    if (!selectedUserForPhoto) return

    try {
      await userService.setPrimaryPhoto(selectedUserForPhoto.id, photoId)
      toast.success('Primary photo updated')
      
      // Reload photos
      const photos = await userService.getPhotos(selectedUserForPhoto.id)
      setUserPhotos(photos)
      
      // Reload all photo URLs (in case order changed)
      const urls: Record<number, string> = {}
      for (const photo of photos) {
        // Reuse existing URL if available
        if (photoUrls[photo.id]) {
          urls[photo.id] = photoUrls[photo.id]
        } else {
          try {
            const url = await getPhotoUrl(photo.photo_path)
            urls[photo.id] = url
          } catch (err) {
            logger.error('Error loading photo URL', { photoId: photo.id, err })
          }
        }
      }
      setPhotoUrls(urls)
    } catch (err: any) {
      logger.error('Error setting primary photo', err)
      toast.error('Failed to set primary photo')
    }
  }

  const handleCreateUser = async () => {
    try {
      // Validate form
      if (!newUser.email || !newUser.full_name || !newUser.password) {
        toast.error('Please fill in all required fields')
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(newUser.email)) {
        toast.error('Please enter a valid email address')
        return
      }

      // Validate password length
      if (newUser.password.length < 6) {
        toast.error('Password must be at least 6 characters long')
        return
      }

      // Validate domain selection
      if (!newUser.domain_ids || newUser.domain_ids.length === 0) {
        toast.error('Please select at least one domain')
        return
      }

      await userService.create(newUser)
      logger.info('User created', { email: newUser.email })
      toast.success(`User "${newUser.full_name}" created successfully`)

      // Reset form and close
      setNewUser({
        email: '',
        full_name: '',
        password: '',
        role: user?.role === 'super_admin' ? 'operator' : 'viewer',
        domain_ids: [],
        permissions: [],
      })
      setShowUserForm(false)

      // Reload data
      await loadData()
    } catch (err: any) {
      logger.error('Error creating user', err)
      
      // Show detailed error message from API
      let errorMessage = 'Failed to create user'
      if (err?.response?.data?.detail) {
        errorMessage = err.response.data.detail
      } else if (err?.message) {
        errorMessage = err.message
      }
      
      toast.error(errorMessage)
    }
  }

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          user.full_name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }
      
      // Role filter
      if (filterRole !== 'all' && user.role !== filterRole) {
        return false
      }
      
      return true
    })
    .sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.full_name.localeCompare(b.full_name)
          break
        case 'email':
          comparison = a.email.localeCompare(b.email)
          break
        case 'date':
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          comparison = dateA - dateB
          break
        case 'role':
          comparison = a.role.localeCompare(b.role)
          break
        default:
          comparison = 0
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

  // Calculate statistics
  // Note: totalUsers comes from state (set by API response), not users.length
  // This ensures we show the total count from backend, not just the current page
  const activeUsers = users.filter(u => u.is_active).length
  const usersByRole = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#405189] mx-auto mb-4"></div>
            <p className="text-body text-gray-500">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
              <UserIcon className="w-8 h-8 text-[#405189]" />
              User Management
            </h1>
            <p className="text-sm text-gray-600">
              Manage system users, roles, and permissions
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard
          title="Super Admin"
          value={(usersByRole['super_admin'] || 0).toString()}
          icon={<Crown className="w-6 h-6" />}
          color="warning"
        />
        <KPICard
          title="Admin"
          value={(usersByRole['admin'] || 0).toString()}
          icon={<Shield className="w-6 h-6" />}
          color="warning"
        />
        <KPICard
          title="Manager"
          value={(usersByRole['manager'] || 0).toString()}
          icon={<Shield className="w-6 h-6" />}
          color="success"
        />
        <KPICard
          title="Operator"
          value={(usersByRole['operator'] || 0).toString()}
          icon={<UserIcon className="w-6 h-6" />}
          color="info"
        />
        <KPICard
          title="Viewer"
          value={(usersByRole['viewer'] || 0).toString()}
          icon={<Eye className="w-6 h-6" />}
          color="info"
        />
      </div>

      {/* User Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Users</h2>
              <p className="text-sm text-gray-500 mt-1">
                {totalUsers} total user{totalUsers !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => {
                if (!showUserForm) {
                  // Reset form when opening
                  setEditingUser(null)
                  setNewUser({
                    email: '',
                    full_name: '',
                    password: '',
                    role: user?.role === 'super_admin' ? 'operator' : 'viewer',
                    domain_ids: [],
                    permissions: [],
                  })
                }
                setShowUserForm(!showUserForm)
              }}
              className="px-4 py-2 bg-[#405189] text-white rounded-lg hover:bg-[#405189]/90 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="md:col-span-2 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <CustomSelect
                value={filterRole}
                onChange={(val) => setFilterRole(String(val))}
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: 'super_admin', label: 'Super Admin' },
                  { value: 'admin', label: 'Admin' },
                  { value: 'manager', label: 'Manager' },
                  { value: 'operator', label: 'Operator' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <CustomSelect
                    value={sortBy}
                    onChange={(val) => setSortBy(String(val))}
                    options={[
                      { value: 'name', label: 'Name' },
                      { value: 'email', label: 'Email' },
                      { value: 'date', label: 'Date' },
                      { value: 'role', label: 'Role' },
                    ]}
                  />
                </div>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className={`px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] flex items-center justify-center min-w-[44px] ${
                    sortOrder === 'asc' ? 'text-[#405189] border-[#405189]' : 'text-gray-700'
                  }`}
                  title={sortOrder === 'asc' ? 'Ascending (A-Z, Oldest First)' : 'Descending (Z-A, Newest First)'}
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="w-4 h-4" />
                  ) : (
                    <ArrowDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {showUserForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                  <h4 className="text-section-title font-semibold text-gray-900">
                    {editingUser ? 'Edit User' : 'Create New User'}
                  </h4>
                  <button
                    onClick={() => {
                      setShowUserForm(false)
                      setEditingUser(null)
                      setNewUser({
                        email: '',
                        full_name: '',
                        password: '',
                        role: user?.role === 'super_admin' ? 'operator' : 'viewer',
                        domain_ids: [],
                        permissions: [],
                      })
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    placeholder="john@example.com"
                    autoComplete="off"
                  />
                </div>
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                    />
                  </div>
                )}
                {editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password (Leave empty to keep current)
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="Enter new password to change"
                      autoComplete="new-password"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    value={newUser.role}
                    onChange={(val) => setNewUser({ ...newUser, role: val as CreateUserPayload['role'] })}
                    options={[
                      { value: 'viewer', label: 'Viewer (Read-only)' },
                      { value: 'operator', label: 'Operator' },
                      { value: 'manager', label: 'Manager' },
                      ...(user?.role === 'super_admin' ? [
                        { value: 'admin', label: 'Admin' },
                        { value: 'super_admin', label: 'Super Admin' }
                      ] : []),
                    ]}
                  />
                </div>
                {editingUser && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Photos
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                      {loadingEditingUserPhotos ? (
                        <p className="text-sm text-gray-500">Loading photos...</p>
                      ) : editingUserPhotos.length > 0 ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {editingUserPhotos.find(p => p.is_primary) && (
                              <div className="w-10 h-10 rounded-full bg-[#405189]/10 flex items-center justify-center">
                                <Camera className="w-5 h-5 text-[#405189]" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                {editingUserPhotos.length} photo{editingUserPhotos.length !== 1 ? 's' : ''} uploaded
                              </p>
                              <p className="text-xs text-gray-500">
                                {editingUserPhotos.filter(p => p.is_primary).length > 0 ? 'Primary photo set' : 'No primary photo'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setShowUserForm(false)
                              handleOpenPhotoModal(editingUser)
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-[#405189] bg-[#405189]/10 rounded-lg hover:bg-[#405189]/20 transition-colors flex items-center gap-1"
                          >
                            <Camera className="w-4 h-4" />
                            Manage Photos
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500">No photos uploaded</p>
                          <button
                            onClick={() => {
                              setShowUserForm(false)
                              handleOpenPhotoModal(editingUser)
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-[#405189] bg-[#405189]/10 rounded-lg hover:bg-[#405189]/20 transition-colors flex items-center gap-1"
                          >
                            <Camera className="w-4 h-4" />
                            Upload Photos
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {organizationDomains.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domain Access <span className="text-red-500">*</span>
                    </label>
                    <div className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg">
                      <div className="space-y-2">
                        {organizationDomains.map((domain) => (
                          <label
                            key={domain.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={newUser.domain_ids?.includes(domain.id) || false}
                              onChange={(e) => {
                                const currentIds = newUser.domain_ids || []
                                if (e.target.checked) {
                                  setNewUser({ ...newUser, domain_ids: [...currentIds, domain.id] })
                                } else {
                                  setNewUser({ ...newUser, domain_ids: currentIds.filter(id => id !== domain.id) })
                                }
                              }}
                              className="w-4 h-4 text-[#405189] border-gray-300 rounded focus:ring-[#405189]"
                            />
                            <span className="text-sm text-gray-700">{domain.name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Select the domains this user should have access to
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowUserForm(false)
                    setEditingUser(null)
                    setNewUser({
                      email: '',
                      full_name: '',
                      password: '',
                      role: user?.role === 'super_admin' ? 'operator' : 'viewer',
                      domain_ids: [],
                      permissions: [],
                    })
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={editingUser ? handleUpdateUser : handleCreateUser}
                  className="btn-primary"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="border-t border-gray-200 pt-6">
            {filteredUsers.length === 0 ? (
              <div className="p-12 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <UserIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-base font-medium text-gray-700 mb-1">
                  {users.length === 0 ? 'No users found' : 'No users match your filters'}
                </p>
                <p className="text-sm text-gray-500">
                  {users.length === 0 ? 'Get started by creating your first user' : 'Try adjusting your search or filter criteria'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Domain Access
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#405189]/10 rounded-full flex items-center justify-center text-[#405189] font-semibold text-sm">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(user.role)}
                            <span className="text-sm font-medium text-gray-900">
                              {getRoleDisplayName(user.role)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {/* #region agent log */}
                          {(() => {
                            fetch('http://127.0.0.1:7242/ingest/61aff5a8-2abc-427c-9b0c-e65f708f0829', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                location: 'frontend/src/pages/UserManagement.tsx:959',
                                message: 'Rendering user domains',
                                data: {
                                  userId: user.id,
                                  userEmail: user.email,
                                  domainsCount: user.domains?.length || 0,
                                  domainsIds: user.domains?.map(d => d.id) || [],
                                  hasDomains: !!user.domains,
                                  domainsUndefined: user.domains === undefined
                                },
                                timestamp: Date.now(),
                                sessionId: 'debug-session',
                                runId: 'run1',
                                hypothesisId: 'C'
                              })
                            }).catch(() => {});
                            return null;
                          })()}
                          {/* #endregion */}
                          {user.domains && user.domains.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-gray-500">
                                {user.domains.length} domain{user.domains.length !== 1 ? 's' : ''} access
                              </span>
                              {user.domains.length <= 3 && (
                                <span className="text-xs text-gray-400">
                                  {user.domains.map(d => d.name).join(', ')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">No domain access</span>
                          )}
                        </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenPhotoModal(user)}
                              className="p-2 text-[#0AB39C] hover:bg-[#0AB39C]/10 rounded-lg transition-colors"
                              title="Manage photos"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditUser(user.id)}
                              className="p-2 text-[#405189] hover:bg-[#405189]/10 rounded-lg transition-colors"
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.full_name)}
                              className="p-2 text-[#F06548] hover:bg-[#F06548]/10 rounded-lg transition-colors"
                              title="Delete user"
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
          
          {/* Pagination */}
          {totalUsers > pagination.limit && (
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between -mx-6 -mb-6 mt-6">
              <div className="text-sm text-gray-600">
                Showing {pagination.skip + 1} to {Math.min(pagination.skip + pagination.limit, totalUsers)} of {totalUsers}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, skip: Math.max(0, pagination.skip - pagination.limit) })}
                  disabled={pagination.skip === 0}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, skip: pagination.skip + pagination.limit })}
                  disabled={pagination.skip + pagination.limit >= totalUsers}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <h4 className="text-section-title font-semibold text-gray-900">
                Delete User
              </h4>
              <button
                onClick={() => setDeleteConfirmModal({ show: false, userId: null, userName: '' })}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-body text-gray-700">
                Are you sure you want to delete user <span className="font-semibold">"{deleteConfirmModal.userName}"</span>?
              </p>
              <p className="text-sm text-red-600 mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmModal({ show: false, userId: null, userName: '' })}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-[#F06548] text-white rounded-lg text-sm font-medium hover:bg-[#F06548]/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoModal && selectedUserForPhoto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Manage Photos - {selectedUserForPhoto.full_name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload photos for face recognition matching
                </p>
              </div>
              <button
                onClick={handleClosePhotoModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Upload Section */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#405189] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadPhoto}
                  disabled={uploadingPhoto}
                  className="hidden"
                  id="photo-upload-input"
                />
                <label
                  htmlFor="photo-upload-input"
                  className={`cursor-pointer flex flex-col items-center gap-3 ${uploadingPhoto ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Camera className="w-12 h-12 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {uploadingPhoto ? 'Uploading...' : 'Click to upload photo'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                </label>
              </div>

              {/* Photos Grid */}
              {userPhotos.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Uploaded Photos ({userPhotos.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {userPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
                      >
                        <div className="aspect-square flex items-center justify-center bg-gray-100">
                          {photoUrls[photo.id] ? (
                            <img
                              src={photoUrls[photo.id]}
                              alt={`Photo ${photo.id}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback if image fails to load
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                const parent = target.parentElement
                                if (parent) {
                                  parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400"><Camera class="w-12 h-12" /></div>'
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Camera className="w-12 h-12" />
                            </div>
                          )}
                        </div>
                        <div className="absolute top-2 right-2 flex gap-2">
                          {photo.is_primary && (
                            <div className="bg-[#0AB39C] text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              Primary
                            </div>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          {!photo.is_primary && (
                            <button
                              onClick={() => handleSetPrimaryPhoto(photo.id)}
                              className="px-3 py-1.5 bg-[#0AB39C] text-white rounded text-xs hover:bg-[#0AB39C]/90 transition-colors flex items-center gap-1"
                              title="Set as primary"
                            >
                              <Star className="w-3 h-3" />
                              Set Primary
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="px-3 py-1.5 bg-[#F06548] text-white rounded text-xs hover:bg-[#F06548]/90 transition-colors"
                            title="Delete photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="p-2 bg-white border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            {photo.face_encoding ? 'Face detected' : 'No face detected'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(photo.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Camera className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No photos uploaded yet</p>
                  <p className="text-xs mt-1">Upload a photo to enable face recognition</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleClosePhotoModal}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

