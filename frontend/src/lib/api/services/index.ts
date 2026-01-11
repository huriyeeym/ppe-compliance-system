/**
 * API Services Index
 * 
 * Centralized export for all API services
 * 
 * @module lib/api/services
 */

export { domainService, type Domain } from './domainService'
export { violationService, type Violation, type ViolationStatistics, type ViolationFilters, type ViolationCreatePayload } from './violationService'
export { cameraService, type Camera } from './cameraService'
export { detectionService, type DetectionResult } from './detectionService'
export { authService, type User } from './authService'
export { userService } from './userService'
export { notificationService, type NotificationSettings, type NotificationSettingsUpdatePayload } from './notificationService'
export * from './notificationScheduleService'

