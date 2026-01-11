import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Settings, Mail, Power, PowerOff, Plus, X, AlertCircle, Send } from 'lucide-react'
import { notificationService, type NotificationSettings } from '../lib/api/services'
import { logger } from '../lib/utils/logger'
import { useAuth } from '../context/AuthContext'

/**
 * System Settings Page
 * 
 * Configure system-wide settings and preferences
 */
export default function SystemSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [newRecipientEmail, setNewRecipientEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)

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
    loadNotificationSettings()
  }, [])

  const loadNotificationSettings = async () => {
    setSettingsLoading(true)
    try {
      const settings = await notificationService.getSettings()
      setNotificationSettings(settings)
      logger.info('Notification settings loaded', settings)
    } catch (err) {
      logger.error('Error loading notification settings', err)
      toast.error('Failed to load notification settings')
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleSaveNotificationSettings = async () => {
    if (!notificationSettings) return

    setIsSaving(true)
    try {
      const updated = await notificationService.updateSettings({
        smtp_host: notificationSettings.smtp_host,
        smtp_port: notificationSettings.smtp_port,
        smtp_user: notificationSettings.smtp_user || '',
        smtp_password: notificationSettings.smtp_password || '',
        from_email: notificationSettings.from_email || '',
        from_name: notificationSettings.from_name,
        use_tls: notificationSettings.use_tls,
        alert_recipients: notificationSettings.alert_recipients,
        summary_recipients: notificationSettings.summary_recipients,
        critical_violation_threshold: notificationSettings.critical_violation_threshold,
        high_violation_threshold: notificationSettings.high_violation_threshold,
        bulk_violation_threshold: notificationSettings.bulk_violation_threshold,
        send_immediate_alerts: notificationSettings.send_immediate_alerts,
        send_daily_summary: notificationSettings.send_daily_summary,
        enabled: notificationSettings.enabled,
      })
      setNotificationSettings(updated)
      logger.info('Notification settings saved', updated)
      toast.success('Email settings saved successfully')
    } catch (err: any) {
      logger.error('Error saving notification settings', err)
      toast.error(err?.message || 'Failed to save email settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error('Please enter an email address')
      return
    }

    setIsSendingTest(true)
    try {
      await notificationService.sendTestEmail(testEmailAddress)
      logger.info('Test email sent', { to: testEmailAddress })
      toast.success(`Test email sent to ${testEmailAddress}`)
      setTestEmailAddress('')
    } catch (err: any) {
      logger.error('Error sending test email', err)
      toast.error(err?.message || 'Failed to send test email')
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleToggleNotifications = async () => {
    if (!notificationSettings) return

    try {
      if (notificationSettings.enabled) {
        await notificationService.disable()
        setNotificationSettings({ ...notificationSettings, enabled: false })
        toast.success('Email notifications disabled')
      } else {
        await notificationService.enable()
        setNotificationSettings({ ...notificationSettings, enabled: true })
        toast.success('Email notifications enabled')
      }
    } catch (err: any) {
      logger.error('Error toggling notifications', err)
      toast.error(err?.message || 'Failed to toggle notifications')
    }
  }

  const handleAddRecipient = () => {
    if (!newRecipientEmail || !notificationSettings) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newRecipientEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    if (notificationSettings.alert_recipients.includes(newRecipientEmail)) {
      toast.error('Email already in recipients list')
      return
    }

    setNotificationSettings({
      ...notificationSettings,
      alert_recipients: [...notificationSettings.alert_recipients, newRecipientEmail]
    })
    setNewRecipientEmail('')
    toast.success('Recipient added (remember to save)')
  }

  const handleRemoveRecipient = (email: string) => {
    if (!notificationSettings) return
    setNotificationSettings({
      ...notificationSettings,
      alert_recipients: notificationSettings.alert_recipients.filter(e => e !== email)
    })
    toast.success('Recipient removed (remember to save)')
  }

  if (settingsLoading) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#405189] mx-auto mb-4"></div>
            <p className="text-body text-gray-500">Loading settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              <Settings className="w-7 h-7 text-[#405189]" />
              System Settings
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Configure system-wide settings and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Email Notification Settings */}
      <div className="card">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title">Email Notification Settings</h3>
            {notificationSettings && (
              <button
                onClick={handleToggleNotifications}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  notificationSettings.enabled
                    ? 'bg-[#0AB39C]/10 text-[#0AB39C] hover:bg-[#0AB39C]/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {notificationSettings.enabled ? (
                  <>
                    <Power className="w-4 h-4" />
                    <span>Enabled</span>
                  </>
                ) : (
                  <>
                    <PowerOff className="w-4 h-4" />
                    <span>Disabled</span>
                  </>
                )}
              </button>
            )}
          </div>

          {!notificationSettings ? (
            <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-body text-gray-500">Failed to load notification settings</p>
              <button onClick={loadNotificationSettings} className="btn-primary mt-4">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Status Banner */}
              {!notificationSettings.enabled && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900">Email notifications are disabled</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Configure SMTP settings below and enable notifications to receive email alerts for PPE violations.
                    </p>
                  </div>
                </div>
              )}

              {/* SMTP Configuration */}
              <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-5 h-5 text-[#405189]" />
                  <h4 className="font-medium text-gray-900">SMTP Configuration</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Host <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="smtp.gmail.com"
                      value={notificationSettings.smtp_host}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, smtp_host: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Port <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="587"
                      value={notificationSettings.smtp_port}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, smtp_port: parseInt(e.target.value) || 587 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="your-email@gmail.com"
                      value={notificationSettings.smtp_user || ''}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, smtp_user: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="••••••••"
                      value={notificationSettings.smtp_password || ''}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, smtp_password: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">For Gmail, use App Password</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="notifications@example.com"
                      value={notificationSettings.from_email || ''}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, from_email: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Defaults to SMTP username if empty</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="PPE Safety System"
                      value={notificationSettings.from_name}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, from_name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-[#405189] bg-white border-gray-300 rounded focus:ring-[#405189]"
                        checked={notificationSettings.use_tls}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, use_tls: e.target.checked })}
                      />
                      <span className="text-sm font-medium text-gray-700">Use TLS/STARTTLS</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Alert Recipients */}
              <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-5 h-5 text-[#405189]" />
                  <h4 className="font-medium text-gray-900">Alert Recipients</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                      placeholder="email@example.com"
                      value={newRecipientEmail}
                      onChange={(e) => setNewRecipientEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
                    />
                    <button
                      onClick={handleAddRecipient}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                  {notificationSettings.alert_recipients.length === 0 ? (
                    <div className="p-4 bg-white border border-gray-200 rounded-lg text-center">
                      <p className="text-sm text-gray-500">No recipients configured</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notificationSettings.alert_recipients.map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{email}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveRecipient(email)}
                            className="p-1 text-[#F06548] hover:bg-[#F06548]/10 rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Test Email */}
              <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-5 h-5 text-[#405189]" />
                  <h4 className="font-medium text-gray-900">Test Email</h4>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
                    placeholder="test@example.com"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                  />
                  <button
                    onClick={handleSendTestEmail}
                    disabled={isSendingTest || !testEmailAddress}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSendingTest ? 'Sending...' : 'Send Test'}</span>
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveNotificationSettings}
                  disabled={isSaving}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Settings className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

