"""
Notification Service

Handles sending notifications for violations based on configured thresholds.
"""

from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database.models import NotificationSettings
from backend.services.email_service import get_email_service
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import asyncio

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing and sending notifications"""

    def __init__(self):
        self.violation_counts = defaultdict(int)  # Track violation counts
        self.last_alert_time = defaultdict(lambda: datetime.min)  # Prevent spam
        self.min_alert_interval = timedelta(minutes=5)  # Minimum time between alerts

    def should_send_alert(
        self,
        severity: str,
        settings: NotificationSettings,
        camera_id: Optional[int] = None
    ) -> bool:
        """
        Determine if an alert should be sent based on severity and thresholds.

        Args:
            severity: Violation severity (critical, high, medium, low)
            settings: Notification settings
            camera_id: Optional camera ID for rate limiting

        Returns:
            bool: True if alert should be sent
        """
        if not settings.enabled or not settings.send_immediate_alerts:
            return False

        # Check rate limiting per camera
        if camera_id:
            alert_key = f"camera_{camera_id}"
            last_alert = self.last_alert_time[alert_key]
            if datetime.now() - last_alert < self.min_alert_interval:
                logger.debug(f"Skipping alert for camera {camera_id} - too soon since last alert")
                return False

        # Check severity thresholds
        severity_lower = severity.lower()

        if severity_lower == 'critical':
            # Always send for critical violations
            return True

        elif severity_lower == 'high':
            # Send if threshold is met
            threshold = settings.high_violation_threshold
            self.violation_counts['high'] += 1
            if self.violation_counts['high'] >= threshold:
                self.violation_counts['high'] = 0  # Reset counter
                return True
            return False

        elif severity_lower in ['medium', 'low']:
            # Don't send immediate alerts for medium/low unless explicitly configured
            return False

        return False

    def send_violation_alert(
        self,
        db: Session,
        violation_data: Dict[str, Any],
        snapshot_path: Optional[str] = None
    ) -> bool:
        """
        Send violation alert email if conditions are met.

        Args:
            db: Database session
            violation_data: Violation information
            snapshot_path: Optional path to snapshot image

        Returns:
            bool: True if alert was sent
        """
        try:
            # Get notification settings
            settings = db.query(NotificationSettings).first()
            if not settings:
                logger.warning("No notification settings found - alerts disabled")
                return False

            # Check if alert should be sent
            severity = violation_data.get('severity', 'medium')
            camera_id = violation_data.get('camera_id')

            if not self.should_send_alert(severity, settings, camera_id):
                logger.debug(f"Alert conditions not met for {severity} violation")
                return False

            # Get recipients
            recipients = settings.alert_recipients
            if not recipients:
                logger.warning("No alert recipients configured")
                return False

            # Send email
            email_service = get_email_service()
            success = email_service.send_violation_alert(
                to_emails=recipients,
                violation_data=violation_data,
                snapshot_path=snapshot_path
            )

            if success:
                # Update last alert time
                if camera_id:
                    alert_key = f"camera_{camera_id}"
                    self.last_alert_time[alert_key] = datetime.now()

                logger.info(f"Violation alert sent to {len(recipients)} recipients")
            else:
                logger.error("Failed to send violation alert")

            return success

        except Exception as e:
            logger.error(f"Error sending violation alert: {str(e)}")
            return False

    async def send_violation_alert_async(
        self,
        db: AsyncSession,
        violation_data: Dict[str, Any],
        snapshot_path: Optional[str] = None
    ) -> bool:
        """
        Async version: Send violation alert email if conditions are met.

        Args:
            db: Async database session
            violation_data: Violation information
            snapshot_path: Optional path to snapshot image

        Returns:
            bool: True if alert was sent
        """
        try:
            # Get notification settings (async query)
            result = await db.execute(select(NotificationSettings))
            settings = result.scalars().first()

            if not settings:
                logger.warning("No notification settings found - alerts disabled")
                return False

            # Check if alert should be sent
            severity = violation_data.get('severity', 'medium')
            camera_id = violation_data.get('camera_id')

            if not self.should_send_alert(severity, settings, camera_id):
                logger.debug(f"Alert conditions not met for {severity} violation")
                return False

            # Get recipients
            recipients = settings.alert_recipients
            if not recipients:
                logger.warning("No alert recipients configured")
                return False

            # Send email in thread pool (email sending is blocking I/O)
            email_service = get_email_service()
            success = await asyncio.to_thread(
                email_service.send_violation_alert,
                to_emails=recipients,
                violation_data=violation_data,
                snapshot_path=snapshot_path
            )

            if success:
                # Update last alert time
                if camera_id:
                    alert_key = f"camera_{camera_id}"
                    self.last_alert_time[alert_key] = datetime.now()

                logger.info(f"Violation alert sent to {len(recipients)} recipients")
            else:
                logger.error("Failed to send violation alert")

            return success

        except Exception as e:
            logger.error(f"Error sending violation alert: {str(e)}")
            return False

    def send_bulk_violation_alert(
        self,
        db: Session,
        violation_count: int,
        time_period_minutes: int = 10
    ) -> bool:
        """
        Send alert for bulk violations in a short time period.

        Args:
            db: Database session
            violation_count: Number of violations detected
            time_period_minutes: Time period in minutes

        Returns:
            bool: True if alert was sent
        """
        try:
            settings = db.query(NotificationSettings).first()
            if not settings or not settings.enabled:
                return False

            # Check bulk threshold
            if violation_count < settings.bulk_violation_threshold:
                return False

            recipients = settings.alert_recipients
            if not recipients:
                return False

            # Create alert data
            email_service = get_email_service()

            subject = f"⚠️ BULK VIOLATION ALERT - {violation_count} violations in {time_period_minutes} minutes"

            html_body = f"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #DC2626;">⚠️ Bulk Violation Alert</h2>
                <p><strong>{violation_count} violations</strong> detected in the last {time_period_minutes} minutes.</p>
                <p>This exceeds your configured threshold of {settings.bulk_violation_threshold} violations.</p>
                <p style="background-color: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B;">
                    ⚡ <strong>Immediate action required.</strong> Please review your monitoring system.
                </p>
            </body>
            </html>
            """

            text_body = f"""
            ⚠️ BULK VIOLATION ALERT

            {violation_count} violations detected in the last {time_period_minutes} minutes.
            This exceeds your configured threshold of {settings.bulk_violation_threshold} violations.

            ⚡ Immediate action required. Please review your monitoring system.
            """

            success = email_service.send_email(
                to_emails=recipients,
                subject=subject,
                html_body=html_body,
                text_body=text_body
            )

            if success:
                logger.info(f"Bulk violation alert sent for {violation_count} violations")

            return success

        except Exception as e:
            logger.error(f"Error sending bulk violation alert: {str(e)}")
            return False

    def reset_counters(self):
        """Reset violation counters (called at end of day or on demand)"""
        self.violation_counts.clear()
        logger.info("Notification counters reset")


# Global notification service instance
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """Get or create the global notification service instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
