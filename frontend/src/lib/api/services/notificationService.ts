/**
 * Notification Service
 *
 * Business logic for email notification settings management
 *
 * @module lib/api/services/notificationService
 */

import { httpClient } from '../httpClient'

/**
 * Notification Settings Entity
 */
export interface NotificationSettings {
  id: number
  smtp_host: string
  smtp_port: number
  smtp_user: string | null
  from_email: string | null
  from_name: string
  use_tls: boolean
  alert_recipients: string[]
  summary_recipients: string[]
  critical_violation_threshold: number
  high_violation_threshold: number
  bulk_violation_threshold: number
  send_immediate_alerts: boolean
  send_daily_summary: boolean
  send_weekly_summary: boolean
  daily_summary_time: string
  enabled: boolean
}

export interface NotificationSettingsUpdatePayload {
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_password?: string
  from_email?: string
  from_name?: string
  use_tls?: boolean
  alert_recipients?: string[]
  summary_recipients?: string[]
  critical_violation_threshold?: number
  high_violation_threshold?: number
  bulk_violation_threshold?: number
  send_immediate_alerts?: boolean
  send_daily_summary?: boolean
  send_weekly_summary?: boolean
  daily_summary_time?: string
  enabled?: boolean
}

export interface TestEmailRequest {
  to_email: string
}

export interface ApiResponse {
  status: string
  message: string
}

/**
 * Notification Service
 */
export class NotificationService {
  private readonly basePath = '/notification-settings'

  /**
   * Get current notification settings
   */
  async getSettings(): Promise<NotificationSettings> {
    return httpClient.get<NotificationSettings>(this.basePath)
  }

  /**
   * Update notification settings
   */
  async updateSettings(payload: NotificationSettingsUpdatePayload): Promise<NotificationSettings> {
    return httpClient.put<NotificationSettings>(this.basePath, payload)
  }

  /**
   * Send test email
   */
  async sendTestEmail(email: string): Promise<ApiResponse> {
    return httpClient.post<ApiResponse>(`${this.basePath}/test-email`, {
      to_email: email
    })
  }

  /**
   * Enable email notifications
   */
  async enable(): Promise<ApiResponse> {
    return httpClient.post<ApiResponse>(`${this.basePath}/enable`)
  }

  /**
   * Disable email notifications
   */
  async disable(): Promise<ApiResponse> {
    return httpClient.post<ApiResponse>(`${this.basePath}/disable`)
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
