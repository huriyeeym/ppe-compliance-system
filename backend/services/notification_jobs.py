"""
Notification Jobs Service
Scheduled email jobs for daily summaries, worker reminders, and critical alerts
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database.connection import AsyncSessionLocal
from backend.database.models import (
    Violation, ViolationStatus, NotificationSchedule, ScheduleType
)
from backend.services.email_service import get_email_service
from backend.services.email_template_service import EmailTemplateService
from backend.utils.logger import logger
import asyncio


class NotificationJobsService:
    """Service for executing scheduled notification jobs"""

    @staticmethod
    async def send_daily_summary():
        """
        Daily summary job - sends end-of-day violation report
        Triggered by scheduler based on NotificationSchedule settings
        """
        try:
            logger.info("Starting daily summary email job...")

            async with AsyncSessionLocal() as db:
                # Get daily summary schedule
                result = await db.execute(
                    select(NotificationSchedule).where(
                        and_(
                            NotificationSchedule.type == ScheduleType.DAILY_SUMMARY,
                            NotificationSchedule.enabled == True
                        )
                    )
                )
                schedule = result.scalar_one_or_none()

                if not schedule or not schedule.recipients:
                    logger.warning("Daily summary schedule not configured or no recipients")
                    return

                # Get today's violations
                today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                today_end = datetime.now()

                violations_result = await db.execute(
                    select(Violation).where(
                        and_(
                            Violation.created_at >= today_start,
                            Violation.created_at <= today_end
                        )
                    )
                )
                violations = violations_result.scalars().all()

                # Calculate statistics
                total_violations = len(violations)

                # Get unique workers (from worker names in violations)
                unique_workers = set()
                for v in violations:
                    if hasattr(v, 'worker_name') and v.worker_name:
                        unique_workers.add(v.worker_name)

                total_workers = len(unique_workers) if unique_workers else 1  # Avoid division by zero

                violation_rate = (total_violations / total_workers * 100) if total_workers > 0 else 0

                # Get top violators
                top_violators = await NotificationJobsService._get_top_violators(
                    db, today_start, today_end, limit=5
                )

                # Get yesterday's violation count for trend
                yesterday_start = today_start - timedelta(days=1)
                yesterday_violations_result = await db.execute(
                    select(func.count(Violation.id)).where(
                        and_(
                            Violation.created_at >= yesterday_start,
                            Violation.created_at < today_start
                        )
                    )
                )
                yesterday_count = yesterday_violations_result.scalar() or 0

                # Calculate trend
                trend_info = None
                if yesterday_count > 0:
                    change_percent = ((total_violations - yesterday_count) / yesterday_count) * 100
                    if abs(change_percent) > 20:  # Significant change
                        direction = "arttı" if change_percent > 0 else "azaldı"
                        trend_info = f"Dikkat: İhlal sayısı dünden bu yana %{abs(change_percent):.0f} {direction}!"

                # Get email template
                template = await EmailTemplateService.get_template(db, ScheduleType.DAILY_SUMMARY)
                if not template:
                    logger.error("Daily summary email template not found")
                    return

                # Format template variables
                variables = EmailTemplateService.format_daily_summary_variables(
                    date=datetime.now().strftime("%d %B %Y"),
                    total_workers=total_workers,
                    total_violations=total_violations,
                    violation_rate=violation_rate,
                    top_violators=top_violators,
                    trend_info=trend_info,
                    dashboard_url="http://localhost:5173"
                )

                # Render email
                subject, html_body, text_body = EmailTemplateService.render_template(
                    template, variables
                )

                # Send email to all recipients
                email_service = get_email_service()
                for recipient in schedule.recipients:
                    try:
                        await email_service.send_email(
                            to_email=recipient,
                            subject=subject,
                            html_body=html_body,
                            text_body=text_body
                        )
                        logger.info(f"Daily summary sent to {recipient}")
                    except Exception as e:
                        logger.error(f"Failed to send daily summary to {recipient}: {str(e)}")

                # Update last run time
                schedule.last_run_at = datetime.now()
                await db.commit()

                logger.info(f"Daily summary job completed. Sent to {len(schedule.recipients)} recipients.")

        except Exception as e:
            logger.error(f"Error in daily summary job: {str(e)}", exc_info=True)

    @staticmethod
    async def send_worker_reminders():
        """
        Worker reminder job - sends weekly reminders to workers with many violations
        Triggered by scheduler based on NotificationSchedule settings
        """
        try:
            logger.info("Starting worker reminder email job...")

            async with AsyncSessionLocal() as db:
                # Get worker reminder schedule
                result = await db.execute(
                    select(NotificationSchedule).where(
                        and_(
                            NotificationSchedule.type == ScheduleType.WORKER_REMINDER,
                            NotificationSchedule.enabled == True
                        )
                    )
                )
                schedule = result.scalar_one_or_none()

                if not schedule:
                    logger.warning("Worker reminder schedule not configured")
                    return

                # Get settings
                settings = schedule.settings or {}
                min_violations = settings.get('min_violations', 3)
                min_duration_minutes = settings.get('min_duration_minutes', 5)  # Default: 5 min minimum
                cc_manager = settings.get('cc_manager', False)

                # Get violations from last week
                week_ago = datetime.now() - timedelta(days=7)
                violations_result = await db.execute(
                    select(Violation).where(
                        Violation.created_at >= week_ago
                    )
                )
                all_violations = violations_result.scalars().all()

                # Filter by duration - only count violations >= min_duration_minutes
                # This prevents spam from brief, insignificant violations
                violations = [
                    v for v in all_violations
                    if (getattr(v, 'duration_seconds', 0) or 0) >= (min_duration_minutes * 60)
                ]

                logger.info(
                    f"Worker reminder: Found {len(violations)} violations >= {min_duration_minutes} min "
                    f"(filtered from {len(all_violations)} total)"
                )

                # Group violations by worker
                worker_violations = {}
                for v in violations:
                    worker_name = getattr(v, 'worker_name', None) or "Unknown"
                    if worker_name not in worker_violations:
                        worker_violations[worker_name] = []
                    worker_violations[worker_name].append(v)

                # Get email template
                template = await EmailTemplateService.get_template(db, ScheduleType.WORKER_REMINDER)
                if not template:
                    logger.error("Worker reminder email template not found")
                    return

                email_service = get_email_service()
                reminder_count = 0

                # Send reminders to workers with >= min_violations
                for worker_name, worker_viols in worker_violations.items():
                    violation_count = len(worker_viols)

                    if violation_count < min_violations:
                        continue

                    # Count violations by type
                    violation_types = {}
                    for v in worker_viols:
                        vtype = getattr(v, 'violation_type', 'Unknown')
                        violation_types[vtype] = violation_types.get(vtype, 0) + 1

                    # Format breakdown
                    violations_breakdown = [
                        {"type": vtype, "count": count}
                        for vtype, count in violation_types.items()
                    ]

                    # Format template variables
                    variables = EmailTemplateService.format_worker_reminder_variables(
                        worker_name=worker_name,
                        violation_count=violation_count,
                        violations_breakdown=violations_breakdown,
                        contact_url="mailto:safety@company.com"
                    )

                    # Render email
                    subject, html_body, text_body = EmailTemplateService.render_template(
                        template, variables
                    )

                    # In a real system, we'd have worker emails in database
                    # For now, send to configured recipients (safety team)
                    for recipient in schedule.recipients:
                        try:
                            await email_service.send_email(
                                to_email=recipient,
                                subject=f"{subject} - {worker_name}",
                                html_body=html_body,
                                text_body=text_body
                            )
                            reminder_count += 1
                            logger.info(f"Worker reminder sent for {worker_name} to {recipient}")
                        except Exception as e:
                            logger.error(f"Failed to send worker reminder: {str(e)}")

                # Update last run time
                schedule.last_run_at = datetime.now()
                await db.commit()

                logger.info(f"Worker reminder job completed. Sent {reminder_count} reminders.")

        except Exception as e:
            logger.error(f"Error in worker reminder job: {str(e)}", exc_info=True)

    @staticmethod
    async def check_critical_alerts():
        """
        Critical alert job - checks for workers with multiple violations in short time
        Runs frequently (e.g., every 15 minutes)
        """
        try:
            async with AsyncSessionLocal() as db:
                # Get critical alert schedule
                result = await db.execute(
                    select(NotificationSchedule).where(
                        and_(
                            NotificationSchedule.type == ScheduleType.CRITICAL_ALERT,
                            NotificationSchedule.enabled == True
                        )
                    )
                )
                schedule = result.scalar_one_or_none()

                if not schedule or not schedule.recipients:
                    return  # Silent return, this runs frequently

                # Get settings
                settings = schedule.settings or {}
                violations_threshold = settings.get('violations_threshold', 5)
                time_window_hours = settings.get('time_window_hours', 1)

                # Get recent violations
                time_window = datetime.now() - timedelta(hours=time_window_hours)
                violations_result = await db.execute(
                    select(Violation).where(
                        Violation.created_at >= time_window
                    )
                )
                violations = violations_result.scalars().all()

                # Group by worker
                worker_violations = {}
                for v in violations:
                    worker_name = getattr(v, 'worker_name', None) or "Unknown"
                    if worker_name not in worker_violations:
                        worker_violations[worker_name] = []
                    worker_violations[worker_name].append(v)

                # Check for critical situations
                email_service = get_email_service()
                template = await EmailTemplateService.get_template(db, ScheduleType.CRITICAL_ALERT)

                if not template:
                    logger.error("Critical alert email template not found")
                    return

                for worker_name, worker_viols in worker_violations.items():
                    if len(worker_viols) >= violations_threshold:
                        # Critical situation detected!
                        latest_violation = worker_viols[-1]

                        # Format template variables
                        variables = EmailTemplateService.format_critical_alert_variables(
                            worker_name=worker_name,
                            violation_count=len(worker_viols),
                            time_window=f"{time_window_hours} saat",
                            location=getattr(latest_violation, 'location', 'Bilinmiyor'),
                            violation_type=getattr(latest_violation, 'violation_type', 'Çoklu'),
                            timestamp=datetime.now().strftime("%d/%m/%Y %H:%M"),
                            dashboard_url="http://localhost:5173"
                        )

                        # Render email
                        subject, html_body, text_body = EmailTemplateService.render_template(
                            template, variables
                        )

                        # Send to all recipients
                        for recipient in schedule.recipients:
                            try:
                                await email_service.send_email(
                                    to_email=recipient,
                                    subject=subject,
                                    html_body=html_body,
                                    text_body=text_body
                                )
                                logger.warning(
                                    f"CRITICAL ALERT sent: {worker_name} - "
                                    f"{len(worker_viols)} violations in {time_window_hours}h"
                                )
                            except Exception as e:
                                logger.error(f"Failed to send critical alert: {str(e)}")

                # Update last run time
                if schedule:
                    schedule.last_run_at = datetime.now()
                    await db.commit()

        except Exception as e:
            logger.error(f"Error in critical alert job: {str(e)}", exc_info=True)

    @staticmethod
    async def _get_top_violators(
        db: AsyncSession,
        start_date: datetime,
        end_date: datetime,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get top violators in a date range"""
        try:
            # Get all violations in range
            result = await db.execute(
                select(Violation).where(
                    and_(
                        Violation.created_at >= start_date,
                        Violation.created_at <= end_date
                    )
                )
            )
            violations = result.scalars().all()

            # Count by worker
            worker_counts = {}
            worker_types = {}  # Track most common violation type per worker

            for v in violations:
                worker_name = getattr(v, 'worker_name', None) or "Unknown"
                vtype = getattr(v, 'violation_type', 'N/A')

                worker_counts[worker_name] = worker_counts.get(worker_name, 0) + 1

                if worker_name not in worker_types:
                    worker_types[worker_name] = {}
                worker_types[worker_name][vtype] = worker_types[worker_name].get(vtype, 0) + 1

            # Build top violators list
            top_violators = []
            for worker_name, count in sorted(worker_counts.items(), key=lambda x: x[1], reverse=True)[:limit]:
                # Get most common violation type
                most_common_type = max(
                    worker_types[worker_name].items(),
                    key=lambda x: x[1]
                )[0] if worker_name in worker_types else "N/A"

                top_violators.append({
                    "name": worker_name,
                    "count": count,
                    "type": most_common_type
                })

            return top_violators

        except Exception as e:
            logger.error(f"Error getting top violators: {str(e)}")
            return []


# Standalone job functions for APScheduler (must be top-level functions)

def run_daily_summary_sync():
    """Synchronous wrapper for daily summary job"""
    asyncio.run(NotificationJobsService.send_daily_summary())


def run_worker_reminders_sync():
    """Synchronous wrapper for worker reminders job"""
    asyncio.run(NotificationJobsService.send_worker_reminders())


def run_critical_alerts_sync():
    """Synchronous wrapper for critical alerts job"""
    asyncio.run(NotificationJobsService.check_critical_alerts())
