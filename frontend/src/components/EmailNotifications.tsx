/**
 * Email Notifications Component
 * Modern, professional email notification settings with beautiful UI
 */

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Mail,
  Send,
  Clock,
  Calendar,
  AlertTriangle,
  Users,
  Settings,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Save,
  Zap,
  TrendingUp,
  Shield,
  Timer,
  Target,
  Bell,
  Power,
  Check,
  X,
} from 'lucide-react';
import {
  getNotificationSchedules,
  createNotificationSchedule,
  updateNotificationSchedule,
  testNotificationSchedule,
  type NotificationSchedule,
  type ScheduleType,
} from '../lib/api/services';
import { notificationService } from '../lib/api/services';

interface EmailNotificationsProps {
  emailSettings: any;
  onEmailSettingsUpdate: () => void;
}

export const EmailNotifications: React.FC<EmailNotificationsProps> = ({
  emailSettings,
  onEmailSettingsUpdate,
}) => {
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // Daily summary state
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(false);
  const [dailySummaryTime, setDailySummaryTime] = useState('18:00');
  const [dailySummaryRecipients, setDailySummaryRecipients] = useState<string[]>([]);
  const [newDailySummaryRecipient, setNewDailySummaryRecipient] = useState('');

  // Worker reminder state
  const [workerReminderEnabled, setWorkerReminderEnabled] = useState(false);
  const [workerReminderDay, setWorkerReminderDay] = useState('Pazartesi');
  const [workerReminderTime, setWorkerReminderTime] = useState('09:00');
  const [workerReminderRecipients, setWorkerReminderRecipients] = useState<string[]>([]);
  const [newWorkerReminderRecipient, setNewWorkerReminderRecipient] = useState('');
  const [minViolations, setMinViolations] = useState(3);
  const [minDurationMinutes, setMinDurationMinutes] = useState(5);
  const [ccManager, setCcManager] = useState(true);

  // Critical alert state
  const [criticalAlertEnabled, setCriticalAlertEnabled] = useState(false);
  const [violationsThreshold, setViolationsThreshold] = useState(5);
  const [timeWindowHours, setTimeWindowHours] = useState(1);
  const [criticalAlertRecipients, setCriticalAlertRecipients] = useState<string[]>([]);
  const [newCriticalAlertRecipient, setNewCriticalAlertRecipient] = useState('');

  // SMTP Config
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');

  useEffect(() => {
    loadSchedules();
    loadEmailSettings();
  }, []);

  const loadEmailSettings = () => {
    if (emailSettings) {
      setSmtpEmail(emailSettings.smtp_user || '');
    }
  };

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const data = await getNotificationSchedules();
      setSchedules(data);

      const dailySummary = data.find((s) => s.type === 'daily_summary');
      if (dailySummary) {
        setDailySummaryEnabled(dailySummary.enabled);
        setDailySummaryTime(dailySummary.schedule_time || '18:00');
        setDailySummaryRecipients(dailySummary.recipients || []);
      }

      const workerReminder = data.find((s) => s.type === 'worker_reminder');
      if (workerReminder) {
        setWorkerReminderEnabled(workerReminder.enabled);
        setWorkerReminderDay(workerReminder.schedule_day || 'Monday');
        setWorkerReminderTime(workerReminder.schedule_time || '09:00');
        setWorkerReminderRecipients(workerReminder.recipients || []);
        setMinViolations(workerReminder.settings?.min_violations || 3);
        setMinDurationMinutes(workerReminder.settings?.min_duration_minutes || 5);
        setCcManager(workerReminder.settings?.cc_manager ?? true);
      }

      const criticalAlert = data.find((s) => s.type === 'critical_alert');
      if (criticalAlert) {
        setCriticalAlertEnabled(criticalAlert.enabled);
        setCriticalAlertRecipients(criticalAlert.recipients || []);
        setViolationsThreshold(criticalAlert.settings?.violations_threshold || 5);
        setTimeWindowHours(criticalAlert.settings?.time_window_hours || 1);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveEmailConfig = async () => {
    if (!smtpEmail || !smtpPassword) {
      toast.error('Please enter email and password');
      return;
    }

    try {
      setSaving(true);
      await notificationService.updateNotificationSettings({
        smtp_user: smtpEmail,
        smtp_password: smtpPassword,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        from_email: smtpEmail,
        use_tls: true,
      });

      toast.success('Email settings saved successfully!');
      onEmailSettingsUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    try {
      setTestingEmail(true);
      await notificationService.testEmail();
      toast.success('Test email sent! Please check your inbox.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send test email');
    } finally {
      setTestingEmail(false);
    }
  };

  const saveSchedule = async (type: ScheduleType) => {
    try {
      setSaving(true);

      const existing = schedules.find((s) => s.type === type);

      let data: any = {};

      if (type === 'daily_summary') {
        data = {
          enabled: dailySummaryEnabled,
          schedule_time: dailySummaryTime,
          recipients: dailySummaryRecipients,
          settings: { include_trends: true, top_violators_count: 5 },
        };
      } else if (type === 'worker_reminder') {
        data = {
          enabled: workerReminderEnabled,
          schedule_time: workerReminderTime,
          schedule_day: workerReminderDay,
          recipients: workerReminderRecipients,
          settings: {
            min_violations: minViolations,
            min_duration_minutes: minDurationMinutes,
            cc_manager: ccManager,
          },
        };
      } else if (type === 'critical_alert') {
        data = {
          enabled: criticalAlertEnabled,
          recipients: criticalAlertRecipients,
          settings: {
            violations_threshold: violationsThreshold,
            time_window_hours: timeWindowHours,
          },
        };
      }

      if (existing) {
        await updateNotificationSchedule(existing.id, data);
      } else {
        await createNotificationSchedule({ type, ...data });
      }

      await loadSchedules();
      toast.success('Notification settings saved!');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = (type: 'daily' | 'worker' | 'critical', email: string) => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (type === 'daily') {
      if (dailySummaryRecipients.includes(email)) {
        toast.error('Email already added');
        return;
      }
      setDailySummaryRecipients([...dailySummaryRecipients, email]);
      setNewDailySummaryRecipient('');
    } else if (type === 'worker') {
      if (workerReminderRecipients.includes(email)) {
        toast.error('Email already added');
        return;
      }
      setWorkerReminderRecipients([...workerReminderRecipients, email]);
      setNewWorkerReminderRecipient('');
    } else if (type === 'critical') {
      if (criticalAlertRecipients.includes(email)) {
        toast.error('Email already added');
        return;
      }
      setCriticalAlertRecipients([...criticalAlertRecipients, email]);
      setNewCriticalAlertRecipient('');
    }
    toast.success('Email added');
  };

  const removeRecipient = (type: 'daily' | 'worker' | 'critical', email: string) => {
    if (type === 'daily') {
      setDailySummaryRecipients(dailySummaryRecipients.filter((e) => e !== email));
    } else if (type === 'worker') {
      setWorkerReminderRecipients(workerReminderRecipients.filter((e) => e !== email));
    } else if (type === 'critical') {
      setCriticalAlertRecipients(criticalAlertRecipients.filter((e) => e !== email));
    }
    toast.success('Email removed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#405189]"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Notifications</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure and manage automated email notifications
          </p>
        </div>
        <Bell className="w-8 h-8 text-[#405189]" />
      </div>

      {/* Email Service Config */}
      <div className="bg-gradient-to-br from-[#405189] to-[#556CB1] rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center">
            <Settings className="w-5 h-5 text-white mr-2" />
            <h3 className="text-lg font-semibold text-white">Email Service Configuration</h3>
          </div>
          <p className="mt-1 text-sm text-white/80">Send emails using your Gmail account</p>
        </div>

        <div className="px-6 py-5 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 mr-1.5 text-[#405189]" />
                Gmail Address
              </label>
              <input
                type="email"
                value={smtpEmail}
                onChange={(e) => setSmtpEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#405189] focus:border-transparent transition-all"
                placeholder="example@gmail.com"
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Shield className="w-4 h-4 mr-1.5 text-[#405189]" />
                App Password
              </label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#405189] focus:border-transparent transition-all"
                placeholder="••••••••••••••••"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#405189] hover:underline font-medium"
                >
                  Click here
                </a>{' '}
                to create a Google App Password
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={saveEmailConfig}
              disabled={saving}
              className="flex items-center px-5 py-2.5 bg-[#405189] text-white rounded-lg hover:bg-[#35446f] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={testEmail}
              disabled={testingEmail}
              className="flex items-center px-5 py-2.5 bg-white border-2 border-[#405189] text-[#405189] rounded-lg hover:bg-[#405189] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              <Send className="w-4 h-4 mr-2" />
              {testingEmail ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Daily Summary Report</h3>
                <p className="text-sm text-gray-600">Detailed statistics at end of day</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={dailySummaryEnabled}
                onChange={(e) => setDailySummaryEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {dailySummaryEnabled ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>
        </div>

        {dailySummaryEnabled && (
          <div className="px-6 py-5 space-y-5">
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 mr-1.5 text-blue-600" />
                Send Time (End of Shift)
              </label>
              <input
                type="time"
                value={dailySummaryTime}
                onChange={(e) => setDailySummaryTime(e.target.value)}
                className="w-full md:w-1/3 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Users className="w-4 h-4 mr-1.5 text-blue-600" />
                Recipients ({dailySummaryRecipients.length})
              </label>
              <div className="space-y-2">
                {dailySummaryRecipients.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between bg-blue-50 border border-blue-100 px-4 py-2.5 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-800">{email}</span>
                    <button
                      onClick={() => removeRecipient('daily', email)}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newDailySummaryRecipient}
                    onChange={(e) => setNewDailySummaryRecipient(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === 'Enter' && addRecipient('daily', newDailySummaryRecipient)
                    }
                    placeholder="new@email.com"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => addRecipient('daily', newDailySummaryRecipient)}
                    className="flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => saveSchedule('daily_summary')}
              disabled={saving}
              className="w-full flex items-center justify-center px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : 'Save Daily Summary Settings'}
            </button>
          </div>
        )}
      </div>

      {/* Worker Reminder */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Worker Reminders</h3>
                <p className="text-sm text-gray-600">Notifications for recurring violations</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={workerReminderEnabled}
                onChange={(e) => setWorkerReminderEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {workerReminderEnabled ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>
        </div>

        {workerReminderEnabled && (
          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 mr-1.5 text-purple-600" />
                  Send Day
                </label>
                <select
                  value={workerReminderDay}
                  onChange={(e) => setWorkerReminderDay(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  <option>Monday</option>
                  <option>Tuesday</option>
                  <option>Wednesday</option>
                  <option>Thursday</option>
                  <option>Friday</option>
                  <option>Saturday</option>
                  <option>Sunday</option>
                </select>
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 mr-1.5 text-purple-600" />
                  Send Time
                </label>
                <input
                  type="time"
                  value={workerReminderTime}
                  onChange={(e) => setWorkerReminderTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="bg-indigo-50 border-l-4 border-indigo-500 rounded-lg p-4">
              <div className="flex items-start">
                <Zap className="w-5 h-5 text-indigo-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-indigo-900 mb-1">Smart Filtering</h4>
                  <p className="text-sm text-indigo-800">
                    Only serious violations are counted. Example: 10 seconds without helmet{' '}
                    <span className="font-semibold">not counted</span>, but {minDurationMinutes}+ minutes
                    without helmet <span className="font-semibold">triggers notification</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4 mr-1.5 text-purple-600" />
                  Minimum Violation Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={minViolations}
                  onChange={(e) => setMinViolations(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <p className="mt-1.5 text-xs text-gray-500">Weekly violations equal to or more than this count</p>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Timer className="w-4 h-4 mr-1.5 text-purple-600" />
                  Minimum Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={minDurationMinutes}
                  onChange={(e) => setMinDurationMinutes(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Only violations lasting {minDurationMinutes}+ minutes
                </p>
              </div>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Users className="w-4 h-4 mr-1.5 text-purple-600" />
                Recipients ({workerReminderRecipients.length})
              </label>
              <div className="space-y-2">
                {workerReminderRecipients.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between bg-purple-50 border border-purple-100 px-4 py-2.5 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-800">{email}</span>
                    <button
                      onClick={() => removeRecipient('worker', email)}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newWorkerReminderRecipient}
                    onChange={(e) => setNewWorkerReminderRecipient(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === 'Enter' && addRecipient('worker', newWorkerReminderRecipient)
                    }
                    placeholder="safety@company.com"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => addRecipient('worker', newWorkerReminderRecipient)}
                    className="flex items-center px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => saveSchedule('worker_reminder')}
              disabled={saving}
              className="w-full flex items-center justify-center px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : 'Save Reminder Settings'}
            </button>
          </div>
        )}
      </div>

      {/* Critical Alerts */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
        <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg mr-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Critical Alerts</h3>
                <p className="text-sm text-gray-600">Real-time critical situation notifications</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={criticalAlertEnabled}
                onChange={(e) => setCriticalAlertEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {criticalAlertEnabled ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>
        </div>

        {criticalAlertEnabled && (
          <div className="px-6 py-5 space-y-5">
            <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-yellow-900 mb-1">Automatic Check</h4>
                  <p className="text-sm text-yellow-800">
                    System checks every 15 minutes. When the same worker commits too many violations in a
                    short time, an immediate email is sent.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4 mr-1.5 text-red-600" />
                  Violation Count Threshold
                </label>
                <input
                  type="number"
                  min="1"
                  value={violationsThreshold}
                  onChange={(e) => setViolationsThreshold(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Timer className="w-4 h-4 mr-1.5 text-red-600" />
                  Time Window (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  value={timeWindowHours}
                  onChange={(e) => setTimeWindowHours(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                <span className="font-semibold">Trigger:</span> If a worker commits{' '}
                <span className="font-bold">{violationsThreshold} or more</span> violations within{' '}
                <span className="font-bold">{timeWindowHours} hour(s)</span>, a critical alert is sent.
              </p>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Users className="w-4 h-4 mr-1.5 text-red-600" />
                Recipients ({criticalAlertRecipients.length})
              </label>
              <div className="space-y-2">
                {criticalAlertRecipients.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between bg-red-50 border border-red-100 px-4 py-2.5 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-800">{email}</span>
                    <button
                      onClick={() => removeRecipient('critical', email)}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newCriticalAlertRecipient}
                    onChange={(e) => setNewCriticalAlertRecipient(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === 'Enter' && addRecipient('critical', newCriticalAlertRecipient)
                    }
                    placeholder="safety@company.com"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => addRecipient('critical', newCriticalAlertRecipient)}
                    className="flex items-center px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => saveSchedule('critical_alert')}
              disabled={saving}
              className="w-full flex items-center justify-center px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : 'Save Critical Alert Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
