/**
 * Activity Feed Component
 * 
 * Displays recent system activities in a timeline format
 * Shows violations, camera status changes, system events
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Clock, AlertTriangle, Camera as CameraIcon, CheckCircle2, XCircle, Activity, User } from 'lucide-react'
import { violationService, type Violation } from '../../lib/api/services/violationService'
import { domainService, type Domain } from '../../lib/api/services/domainService'
import { logger } from '../../lib/utils/logger'

interface ActivityItem {
  id: number
  type: 'violation' | 'camera_online' | 'camera_offline' | 'system'
  timestamp: Date
  domainId?: number
  domainName?: string
  message: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  violation?: Violation
}

interface ActivityFeedProps {
  domainId?: number
  limit?: number
}

export default function ActivityFeed({ domainId, limit = 20 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [domains, setDomains] = useState<Domain[]>([])

  useEffect(() => {
    loadDomains()
    loadActivities()
    const interval = setInterval(loadActivities, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [domainId])

  const loadDomains = async () => {
    try {
      const allDomains = await domainService.getAll()
      setDomains(allDomains)
    } catch (err) {
      logger.error('Error loading domains for activity feed', err)
    }
  }

  const loadActivities = async () => {
    try {
      setLoading(true)
      
      // Get recent violations
      const yesterday = new Date()
      yesterday.setHours(yesterday.getHours() - 24)
      
      const violationsResponse = await violationService.getAll({
        domain_id: domainId,
        start_date: yesterday.toISOString(),
        limit: limit,
      })

      const violations = violationsResponse.items

      // Transform violations to activity items
      const activityItems: ActivityItem[] = violations.map((violation) => {
        const domain = domains.find(d => d.id === violation.domain_id) || 
                      domains.find(d => d.id === domainId)
        
        const missingPPE = violation.missing_ppe.map(ppe => {
          const names: Record<string, string> = {
            hard_hat: 'Hard Hat',
            safety_vest: 'Safety Vest',
            safety_glasses: 'Safety Glasses',
            face_mask: 'Face Mask',
            safety_boots: 'Safety Boots',
            gloves: 'Gloves',
          }
          return names[ppe.type] || ppe.type
        }).join(', ')

        return {
          id: violation.id,
          type: 'violation' as const,
          timestamp: new Date(violation.timestamp),
          domainId: violation.domain_id,
          domainName: domain?.name,
          message: `Violation detected: Missing ${missingPPE}`,
          severity: violation.severity,
          violation,
        }
      })

      // Sort by timestamp (newest first)
      activityItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      setActivities(activityItems.slice(0, limit))
    } catch (err) {
      logger.error('Error loading activity feed', err)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'violation':
        return activity.severity === 'critical' ? (
          <AlertTriangle className="w-5 h-5 text-red-600" />
        ) : activity.severity === 'high' ? (
          <AlertTriangle className="w-5 h-5 text-orange-600" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
        )
      case 'camera_online':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case 'camera_offline':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return <Activity className="w-5 h-5 text-gray-600" />
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading && activities.length === 0) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-section-title flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Activity
        </h3>
        <Link
          to="/events"
          className="text-sm text-[#405189] hover:text-[#364574] font-medium"
        >
          View All →
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400 opacity-50" />
          <p className="text-body">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body text-gray-900">{activity.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  {activity.domainName && (
                    <span className="text-caption text-gray-500">{activity.domainName}</span>
                  )}
                  {activity.violation && (
                    <>
                      <span className="text-caption text-gray-400">•</span>
                      <span className="text-caption text-gray-500">
                        Camera #{activity.violation.camera_id}
                      </span>
                    </>
                  )}
                  <span className="text-caption text-gray-400">•</span>
                  <span className="text-caption text-gray-500">{formatTime(activity.timestamp)}</span>
                </div>
              </div>
              {activity.violation && (
                <Link
                  to="/events"
                  className="text-sm text-[#405189] hover:text-[#364574] font-medium flex-shrink-0"
                >
                  View →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

