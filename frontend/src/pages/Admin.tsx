import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, Edit, Trash2, Shield, Crown, Eye, Mail, User as UserIcon, Settings as SettingsIcon, Database, FileText, Activity } from 'lucide-react'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { violationService, type Violation } from '../lib/api/services/violationService'
import { userService, type User, type CreateUserPayload } from '../lib/api/services/userService'
import { logger } from '../lib/utils/logger'
import KPICard from '../components/dashboard/KPICard'

/**
 * Admin Panel
 *
 * System management:
 * - User management (CRUD)
 * - System configuration
 * - Statistics overview
 */
export default function Admin() {
  const [activeTab, setActiveTab] = useState('users')
  const [domains, setDomains] = useState<Domain[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [violations, setViolations] = useState<Violation[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showUserForm, setShowUserForm] = useState(false)
  const [newUser, setNewUser] = useState<CreateUserPayload>({
    email: '',
    full_name: '',
    password: '',
    role: 'operator',
  })
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDomains: 0,
    totalCameras: 0,
    totalViolations: 0,
    unacknowledgedViolations: 0,
  })

  // Email settings state
  const [emailSettings, setEmailSettings] = useState({
    smtpServer: '',
    smtpPort: '587',
    emailAddress: '',
    password: '',
  })

  // Notification thresholds state
  const [thresholds, setThresholds] = useState({
    criticalViolationThreshold: '15',
    bulkViolationThreshold: '10',
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const [domainList, cameraList, violationList, userList] = await Promise.all([
        domainService.getAll(),
        cameraService.getAll(),
        violationService.getAll({ limit: 1000 }),
        userService.getAll().catch(() => []), // May fail if not authenticated
      ])
      setDomains(domainList)
      setCameras(cameraList)
      setViolations(violationList.items)
      setUsers(userList)

      const unacknowledged = violationList.items.filter(v => v.status === 'open').length

      setStats({
        totalUsers: userList.length,
        totalDomains: domainList.length,
        totalCameras: cameraList.length,
        totalViolations: violationList.items.length,
        unacknowledgedViolations: unacknowledged,
      })
    } catch (err) {
      logger.error('Admin stats load error', err)
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="w-4 h-4 text-[#F7B84B]" />
      case 'domain_admin':
        return <Shield className="w-4 h-4 text-[#405189]" />
      case 'viewer':
        return <Eye className="w-4 h-4 text-gray-500" />
      default:
        return <UserIcon className="w-4 h-4 text-gray-500" />
    }
  }

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      super_admin: 'Super Admin',
      domain_admin: 'Domain Admin',
      viewer: 'Viewer',
      admin: 'Admin',
      operator: 'Operator',
    }
    return roleMap[role] || role
  }

  const handleSaveEmailSettings = async () => {
    try {
      // TODO: Implement API call to save email settings
      logger.info('Saving email settings', emailSettings)
      toast.success('Email settings saved successfully')
    } catch (err) {
      logger.error('Error saving email settings', err)
      toast.error('Failed to save email settings')
    }
  }

  const handleSaveThresholds = async () => {
    try {
      // TODO: Implement API call to save thresholds
      logger.info('Saving thresholds', thresholds)
      toast.success('Notification thresholds saved successfully')
    } catch (err) {
      logger.error('Error saving thresholds', err)
      toast.error('Failed to save thresholds')
    }
  }

  const handleEditUser = async (userId: number) => {
    try {
      // TODO: Implement user edit modal/form
      logger.info('Edit user', { userId })
      toast.success('User edit feature coming soon')
    } catch (err) {
      logger.error('Error editing user', err)
      toast.error('Failed to edit user')
    }
  }

  const handleDeleteUser = async (userId: number, userName: string) => {
    try {
      const confirmed = window.confirm(`Are you sure you want to delete user "${userName}"?`)
      if (!confirmed) return

      await userService.delete(userId)
      logger.info('Delete user', { userId })
      toast.success(`User "${userName}" deleted successfully`)

      // Reload stats to update user list
      await loadStats()
    } catch (err) {
      logger.error('Error deleting user', err)
      toast.error('Failed to delete user')
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

      await userService.create(newUser)
      logger.info('User created', { email: newUser.email })
      toast.success(`User "${newUser.full_name}" created successfully`)

      // Reset form and close
      setNewUser({
        email: '',
        full_name: '',
        password: '',
        role: 'operator',
      })
      setShowUserForm(false)

      // Reload stats to update user list
      await loadStats()
    } catch (err: any) {
      logger.error('Error creating user', err)
      toast.error(err?.message || 'Failed to create user')
    }
  }

  const tabs = [
    { id: 'users', label: 'User Management', icon: UserIcon },
    { id: 'settings', label: 'System Settings', icon: SettingsIcon },
    { id: 'logs', label: 'System Logs', icon: FileText },
    { id: 'stats', label: 'Statistics', icon: Activity },
  ]

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
      <div>
        <h1 className="text-page-title">Admin Panel</h1>
        <p className="text-caption text-gray-500">System management and configuration</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KPICard
          title="Users"
          value={stats.totalUsers.toString()}
          icon={<UserIcon className="w-6 h-6" />}
          color="info"
        />
        <KPICard
          title="Domains"
          value={stats.totalDomains.toString()}
          icon={<Database className="w-6 h-6" />}
          color="info"
        />
        <KPICard
          title="Cameras"
          value={stats.totalCameras.toString()}
          icon={<Eye className="w-6 h-6" />}
          color="info"
        />
        <KPICard
          title="Total Violations"
          value={stats.totalViolations.toString()}
          icon={<FileText className="w-6 h-6" />}
          color="warning"
        />
        <KPICard
          title="Open Violations"
          value={stats.unacknowledgedViolations.toString()}
          icon={<Activity className="w-6 h-6" />}
          color="danger"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium transition-all relative flex items-center gap-2
                ${activeTab === tab.id
                  ? 'text-[#405189] border-b-2 border-[#405189]'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">User Management</h3>
              <button
                onClick={() => setShowUserForm(!showUserForm)}
                className="btn-primary flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            </div>

            {showUserForm && (
              <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-body font-semibold text-gray-900 mb-4">Create New User</h4>
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
                    />
                  </div>
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
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'operator' })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    >
                      <option value="operator">Operator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowUserForm(false)
                      setNewUser({
                        email: '',
                        full_name: '',
                        password: '',
                        role: 'operator',
                      })
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateUser}
                    className="btn-primary"
                  >
                    Create User
                  </button>
                </div>
              </div>
            )}

            {users.length === 0 ? (
              <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <UserIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-body text-gray-500">No users found</p>
                <p className="text-sm text-gray-400 mt-2">
                  Users can be created via backend API or admin interface
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(user.role)}
                            <span className="text-sm text-gray-900">
                              {getRoleDisplayName(user.role)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              user.is_active
                                ? 'bg-[#0AB39C]/10 text-[#0AB39C]'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
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
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h3 className="text-section-title">System Settings</h3>

            {/* Email Settings */}
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-[#405189]" />
                <h4 className="font-medium text-gray-900">Email Notification Settings</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Server</label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    placeholder="smtp.gmail.com"
                    value={emailSettings.smtpServer}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpServer: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    type="number"
                    placeholder="587"
                    value={emailSettings.smtpPort}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    type="email"
                    placeholder="admin@example.com"
                    value={emailSettings.emailAddress}
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailAddress: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    type="password"
                    placeholder="••••••••"
                    value={emailSettings.password}
                    onChange={(e) => setEmailSettings({ ...emailSettings, password: e.target.value })}
                  />
                </div>
                <button onClick={handleSaveEmailSettings} className="btn-primary">Save Settings</button>
              </div>
            </div>

            {/* Notification Thresholds */}
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-[#405189]" />
                <h4 className="font-medium text-gray-900">Notification Thresholds</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Critical Violation Threshold (per 15 min)
                  </label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    type="number"
                    placeholder="15"
                    value={thresholds.criticalViolationThreshold}
                    onChange={(e) => setThresholds({ ...thresholds, criticalViolationThreshold: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Send email notification if this many violations occur within 15 minutes
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bulk Violation Threshold (per hour)
                  </label>
                  <input
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    type="number"
                    placeholder="10"
                    value={thresholds.bulkViolationThreshold}
                    onChange={(e) => setThresholds({ ...thresholds, bulkViolationThreshold: e.target.value })}
                  />
                </div>
                <button onClick={handleSaveThresholds} className="btn-primary">Save Thresholds</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-section-title">System Logs</h3>
              <div className="flex items-center gap-2">
                <select className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]">
                  <option value="all">All Events</option>
                  <option value="user">User Actions</option>
                  <option value="system">System Events</option>
                  <option value="violation">Violations</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Event Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        User/Source
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {violations.slice(0, 20).map((violation, idx) => (
                      <tr key={violation.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {new Date(violation.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-[#F06548]/10 text-[#F06548]">
                            Violation
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          PPE violation detected - Camera #{violation.camera_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          System
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              violation.status === 'acknowledged'
                                ? 'bg-[#0AB39C]/10 text-[#0AB39C]'
                                : violation.status === 'resolved'
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-yellow-100 text-yellow-600'
                            }`}
                          >
                            {violation.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {users.map((user, idx) => (
                      <tr key={`user-${user.id}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {new Date(user.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-[#405189]/10 text-[#405189]">
                            User
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          User account created - {user.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          Admin
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-[#0AB39C]/10 text-[#0AB39C]">
                            Success
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <p>Showing last {violations.length + users.length} events</p>
              <p className="text-caption">Real-time logging • Auto-refresh enabled</p>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-section-title">System Statistics</h3>

            {/* Domain Distribution */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-body font-semibold text-gray-900">Domain Distribution</h4>
                <span className="text-caption text-gray-500">{domains.length} active domains</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {domains.map((domain) => {
                  const domainCameras = cameras.filter(c => c.domain_id === domain.id).length
                  const domainViolations = violations.filter(v => v.domain_id === domain.id).length
                  return (
                    <div key={domain.id} className="border border-gray-200 rounded-lg p-4 hover:border-[#405189] transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-[#405189]/10 rounded-lg flex items-center justify-center text-xl">
                          {domain.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{domain.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{domain.type}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-2 bg-[#405189]/5 rounded">
                          <p className="text-xs text-gray-500 mb-1">Cameras</p>
                          <p className="text-lg font-bold text-[#405189]">{domainCameras}</p>
                        </div>
                        <div className="text-center p-2 bg-[#F06548]/5 rounded">
                          <p className="text-xs text-gray-500 mb-1">Violations</p>
                          <p className="text-lg font-bold text-[#F06548]">{domainViolations}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* System Health */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-body font-semibold text-gray-900">Camera Status</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-[#0AB39C]/5 rounded-lg border border-[#0AB39C]/20">
                    <span className="text-sm font-medium text-gray-900">Active</span>
                    <span className="text-xl font-bold text-[#0AB39C]">
                      {cameras.filter(c => c.is_active).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-900">Inactive</span>
                    <span className="text-xl font-bold text-gray-500">
                      {cameras.filter(c => !c.is_active).length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-body font-semibold text-gray-900">Violation Status</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <span className="text-sm font-medium text-gray-900">Pending</span>
                    <span className="text-xl font-bold text-yellow-600">
                      {violations.filter(v => v.status === 'pending').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0AB39C]/5 rounded-lg border border-[#0AB39C]/20">
                    <span className="text-sm font-medium text-gray-900">Resolved</span>
                    <span className="text-xl font-bold text-[#0AB39C]">
                      {violations.filter(v => v.status === 'resolved' || v.status === 'acknowledged').length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-body font-semibold text-gray-900">System Health</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-[#0AB39C]/5 rounded-lg border border-[#0AB39C]/20">
                    <span className="text-sm font-medium text-gray-900">Uptime</span>
                    <span className="text-sm font-bold text-[#0AB39C]">99.9%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0AB39C]/5 rounded-lg border border-[#0AB39C]/20">
                    <span className="text-sm font-medium text-gray-900">API Status</span>
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-[#0AB39C] text-white">
                      Online
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
