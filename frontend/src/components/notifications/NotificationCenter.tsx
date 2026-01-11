import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Bell, X, Eye, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { violationService, type Violation } from '../../lib/api/services'
import { useDomain } from '../../context/DomainContext'
import { logger } from '../../lib/utils/logger'
import { useWebSocket } from '../../lib/websocket/useWebSocket'

interface NotificationItem {
  id: number
  message: string
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  read: boolean
  violation?: Violation
}

export default function NotificationCenter() {
  const { selectedDomain } = useDomain()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const wsConnectedRef = useRef(false) // Track wsConnected state

  // ✅ WebSocket for real-time violation notifications
  // Use useCallback to stabilize the onViolation callback
  const handleViolation = useCallback((violation: any) => {
    // Add new violation notification in real-time
    const newNotification: NotificationItem = {
      id: violation.id,
      message: `${violation.severity === 'critical' ? 'Critical' : 'Violation'} detected: ${violation.missing_ppe.map((p: any) => p.type.replace('_', ' ')).join(', ')}`,
      timestamp: violation.timestamp,
      severity: violation.severity,
      read: false,
      violation: violation as any, // Type assertion for compatibility
    }
    
    setNotifications(prev => {
      // Avoid duplicates
      if (prev.some(n => n.id === violation.id)) {
        return prev
      }
      // Add to beginning and keep only last 20
      return [newNotification, ...prev].slice(0, 20)
    })
    
    setUnreadCount(prev => prev + 1)
    
    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('PPE Violation Detected', {
        body: newNotification.message,
        icon: '/favicon.ico',
      })
    }
  }, [])

  // Stabilize domainIds array to prevent unnecessary reconnections
  const domainIds = useMemo(() => {
    return selectedDomain ? [selectedDomain.id] : []
  }, [selectedDomain?.id])

  const { isConnected: wsConnected } = useWebSocket({
    domainIds,
    onViolation: handleViolation,
  })

  // Update ref when wsConnected changes
  useEffect(() => {
    wsConnectedRef.current = wsConnected
  }, [wsConnected])

  // Load recent violations as notifications (initial load + fallback polling)
  useEffect(() => {
    if (!selectedDomain) return

    const loadNotifications = async () => {
      try {
        // Get violations from last 24 hours
        const yesterday = new Date()
        yesterday.setHours(yesterday.getHours() - 24)

        const response = await violationService.getAll({
          domain_id: selectedDomain.id,
          start_date: yesterday.toISOString(),
          limit: 10,
          severity: 'critical', // Only show critical for now
        })

        const notifs: NotificationItem[] = response.items.map(v => ({
          id: v.id,
          message: `Critical violation detected: ${v.missing_ppe.map(p => p.type.replace('_', ' ')).join(', ')}`,
          timestamp: v.timestamp,
          severity: v.severity,
          read: false, // All new notifications are unread
          violation: v,
        }))

        setNotifications(notifs)
        setUnreadCount(notifs.filter(n => !n.read).length)
      } catch (err) {
        logger.error('Failed to load notifications', err)
      }
    }

    // Initial load
    loadNotifications()

    // Fallback polling (every 60 seconds) if WebSocket is not connected
    // Use ref to track wsConnected to avoid recreating interval
    const interval = setInterval(() => {
      if (!wsConnectedRef.current) {
        loadNotifications()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [selectedDomain]) // Remove wsConnected from dependencies

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/20 text-red-600'
      case 'high':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-600'
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600'
      default:
        return 'bg-gray-500/10 border-gray-500/20 text-gray-600'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">No notifications</p>
                <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 hover:bg-gray-50 transition-colors ${
                      !notif.read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Severity Indicator */}
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        notif.severity === 'critical' ? 'bg-red-500' :
                        notif.severity === 'high' ? 'bg-orange-500' :
                        notif.severity === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />

                      <div className="flex-1 min-w-0">
                        {/* Message */}
                        <p className={`text-sm ${
                          !notif.read ? 'font-medium text-gray-900' : 'text-gray-700'
                        }`}>
                          {notif.message}
                        </p>

                        {/* Metadata */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(notif.timestamp)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${getSeverityColor(notif.severity)}`}>
                            {notif.severity.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notif.read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                            title="Mark as read"
                          >
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all as read
                </button>
              )}
              <Link
                to="/events"
                onClick={() => setIsOpen(false)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 ml-auto"
              >
                View all violations
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
