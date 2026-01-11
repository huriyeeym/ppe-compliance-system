/**
 * Notification Schedule Service
 * API calls for managing email notification schedules
 */

import { httpClient } from '../httpClient';

export type ScheduleType = 'daily_summary' | 'worker_reminder' | 'critical_alert' | 'weekly_report';

export interface NotificationSchedule {
  id: number;
  type: ScheduleType;
  enabled: boolean;
  schedule_time?: string;  // "18:00"
  schedule_day?: string;   // "Monday"
  recipients: string[];
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
}

export interface CreateScheduleRequest {
  type: ScheduleType;
  enabled: boolean;
  schedule_time?: string;
  schedule_day?: string;
  recipients: string[];
  settings?: Record<string, any>;
}

export interface UpdateScheduleRequest {
  enabled?: boolean;
  schedule_time?: string;
  schedule_day?: string;
  recipients?: string[];
  settings?: Record<string, any>;
}

/**
 * Get all notification schedules
 */
export const getNotificationSchedules = async (): Promise<NotificationSchedule[]> => {
  const response = await httpClient.get<NotificationSchedule[]>('/notification-schedules');
  return response.data;
};

/**
 * Get single notification schedule by ID
 */
export const getNotificationSchedule = async (id: number): Promise<NotificationSchedule> => {
  const response = await httpClient.get<NotificationSchedule>(`/notification-schedules/${id}`);
  return response.data;
};

/**
 * Create new notification schedule
 */
export const createNotificationSchedule = async (
  data: CreateScheduleRequest
): Promise<NotificationSchedule> => {
  const response = await httpClient.post<NotificationSchedule>('/notification-schedules', data);
  return response.data;
};

/**
 * Update notification schedule
 */
export const updateNotificationSchedule = async (
  id: number,
  data: UpdateScheduleRequest
): Promise<NotificationSchedule> => {
  const response = await httpClient.put<NotificationSchedule>(`/notification-schedules/${id}`, data);
  return response.data;
};

/**
 * Delete notification schedule
 */
export const deleteNotificationSchedule = async (id: number): Promise<void> => {
  await httpClient.delete(`/notification-schedules/${id}`);
};

/**
 * Test notification schedule (manually trigger)
 */
export const testNotificationSchedule = async (
  id: number
): Promise<{ message: string; schedule_type: string }> => {
  const response = await httpClient.post<{ message: string; schedule_type: string }>(
    `/notification-schedules/${id}/test`
  );
  return response.data;
};
