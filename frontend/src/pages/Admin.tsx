import { useState, useEffect } from 'react'
import { UserPlus, Edit, Trash2, Shield, Crown, Eye, Mail, User as UserIcon } from 'lucide-react'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { violationService, type Violation } from '../lib/api/services/violationService'
import { userService, type User } from '../lib/api/services/userService'
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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showUserForm, setShowUserForm] = useState(false)
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
        return <Crown className="w-4 h-4 text-yellow-600" />
      case 'domain_admin':
        return <Shield className="w-4 h-4 text-blue-600" />
      case 'viewer':
        return <Eye className="w-4 h-4 text-gray-600" />
      default:
        return <UserIcon className="w-4 h-4 text-gray-600" />
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

  const tabs = [
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'settings', label: 'System Settings', icon: '⚙️' },
    { id: 'models', label: 'Model Management', icon: '🤖' },
    { id: 'violations', label: 'Violation Management', icon: '⚠️' },
    { id: 'logs', label: 'System Logs', icon: '📋' },
    { id: 'stats', label: 'Statistics', icon: '📊' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Admin Panel</h1>
        <p className="text-sm text-gray-500">System management and configuration</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card">
          <div className="text-2xl font-bold text-gray-900 mb-1">{stats.totalUsers}</div>
          <div className="text-sm text-gray-500">Users</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-gray-900 mb-1">{stats.totalDomains}</div>
          <div className="text-sm text-gray-500">Domains</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-gray-900 mb-1">{stats.totalCameras}</div>
          <div className="text-sm text-gray-500">Cameras</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-gray-900 mb-1">{stats.totalViolations}</div>
          <div className="text-sm text-gray-500">Total Violations</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-red-600 mb-1">{stats.unacknowledgedViolations}</div>
          <div className="text-sm text-gray-500">Open Violations</div>
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
              <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
              <button
                onClick={() => setShowUserForm(!showUserForm)}
                className="btn-primary flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            </div>

            {showUserForm && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  User creation form will be implemented here. For now, users can be created via backend API.
                </p>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <p className="text-body text-gray-500">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
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
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

