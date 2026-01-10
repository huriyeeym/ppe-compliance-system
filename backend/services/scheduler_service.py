"""
Scheduler Service
Manages APScheduler for email notification jobs
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_
from backend.database.connection import AsyncSessionLocal
from backend.database.models import NotificationSchedule, ScheduleType
from backend.services.notification_jobs import (
    run_daily_summary_sync,
    run_worker_reminders_sync,
    run_critical_alerts_sync,
    NotificationJobsService
)
from backend.utils.logger import logger
import asyncio


class SchedulerService:
    """
    Service for managing scheduled email jobs
    Uses APScheduler with background thread execution
    """

    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone='Europe/Istanbul')
        self.is_running = False

    def start(self):
        """Start the scheduler"""
        if self.is_running:
            logger.warning("Scheduler already running")
            return

        try:
            self.scheduler.start()
            self.is_running = True
            logger.info("Scheduler started successfully")

            # Schedule job to reload schedules periodically (every hour)
            self.scheduler.add_job(
                self._reload_schedules_sync,
                IntervalTrigger(hours=1),
                id='reload_schedules',
                replace_existing=True
            )

            # Initial schedule load
            self._reload_schedules_sync()

        except Exception as e:
            logger.error(f"Failed to start scheduler: {str(e)}", exc_info=True)
            self.is_running = False

    def stop(self):
        """Stop the scheduler"""
        if not self.is_running:
            return

        try:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Scheduler stopped successfully")
        except Exception as e:
            logger.error(f"Failed to stop scheduler: {str(e)}", exc_info=True)

    def _reload_schedules_sync(self):
        """Synchronous wrapper for reloading schedules"""
        asyncio.run(self.reload_schedules())

    async def reload_schedules(self):
        """
        Reload all notification schedules from database
        Updates APScheduler jobs accordingly
        """
        try:
            logger.info("Reloading notification schedules...")

            async with AsyncSessionLocal() as db:
                # Get all enabled schedules
                result = await db.execute(
                    select(NotificationSchedule).where(
                        NotificationSchedule.enabled == True
                    )
                )
                schedules = result.scalars().all()

                # Clear existing notification jobs (except reload_schedules)
                for job in self.scheduler.get_jobs():
                    if job.id != 'reload_schedules':
                        self.scheduler.remove_job(job.id)

                # Add jobs based on schedules
                for schedule in schedules:
                    try:
                        self._add_schedule_job(schedule)
                    except Exception as e:
                        logger.error(
                            f"Failed to add job for schedule {schedule.id}: {str(e)}",
                            exc_info=True
                        )

                logger.info(f"Loaded {len(schedules)} notification schedules")

        except Exception as e:
            logger.error(f"Error reloading schedules: {str(e)}", exc_info=True)

    def _add_schedule_job(self, schedule: NotificationSchedule):
        """Add a single schedule job to APScheduler"""

        if schedule.type == ScheduleType.DAILY_SUMMARY:
            # Daily at specific time (e.g., 18:00)
            if not schedule.schedule_time:
                logger.warning(f"Daily summary schedule {schedule.id} missing time")
                return

            hour, minute = map(int, schedule.schedule_time.split(':'))

            self.scheduler.add_job(
                run_daily_summary_sync,
                CronTrigger(hour=hour, minute=minute),
                id=f'daily_summary_{schedule.id}',
                replace_existing=True
            )
            logger.info(f"Scheduled daily summary at {schedule.schedule_time}")

        elif schedule.type == ScheduleType.WORKER_REMINDER:
            # Weekly on specific day and time
            if not schedule.schedule_time or not schedule.schedule_day:
                logger.warning(f"Worker reminder schedule {schedule.id} missing time/day")
                return

            hour, minute = map(int, schedule.schedule_time.split(':'))

            # Map day name to cron day_of_week (0=Monday)
            day_map = {
                'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
                'Friday': 4, 'Saturday': 5, 'Sunday': 6,
                'Pazartesi': 0, 'Salı': 1, 'Çarşamba': 2, 'Perşembe': 3,
                'Cuma': 4, 'Cumartesi': 5, 'Pazar': 6
            }

            day_of_week = day_map.get(schedule.schedule_day, 0)

            self.scheduler.add_job(
                run_worker_reminders_sync,
                CronTrigger(day_of_week=day_of_week, hour=hour, minute=minute),
                id=f'worker_reminder_{schedule.id}',
                replace_existing=True
            )
            logger.info(
                f"Scheduled worker reminder on {schedule.schedule_day} at {schedule.schedule_time}"
            )

        elif schedule.type == ScheduleType.CRITICAL_ALERT:
            # Run every 15 minutes to check for critical situations
            self.scheduler.add_job(
                run_critical_alerts_sync,
                IntervalTrigger(minutes=15),
                id=f'critical_alert_{schedule.id}',
                replace_existing=True
            )
            logger.info("Scheduled critical alert checks every 15 minutes")

        elif schedule.type == ScheduleType.WEEKLY_REPORT:
            # Weekly on specific day and time
            if not schedule.schedule_time or not schedule.schedule_day:
                logger.warning(f"Weekly report schedule {schedule.id} missing time/day")
                return

            hour, minute = map(int, schedule.schedule_time.split(':'))

            day_map = {
                'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
                'Friday': 4, 'Saturday': 5, 'Sunday': 6,
                'Pazartesi': 0, 'Salı': 1, 'Çarşamba': 2, 'Perşembe': 3,
                'Cuma': 4, 'Cumartesi': 5, 'Pazar': 6
            }

            day_of_week = day_map.get(schedule.schedule_day, 0)

            # TODO: Implement weekly report job
            logger.info(
                f"Weekly report scheduled on {schedule.schedule_day} at {schedule.schedule_time} (not yet implemented)"
            )

    async def trigger_job_manually(self, schedule_type: ScheduleType):
        """Manually trigger a notification job (for testing)"""
        try:
            if schedule_type == ScheduleType.DAILY_SUMMARY:
                await NotificationJobsService.send_daily_summary()
            elif schedule_type == ScheduleType.WORKER_REMINDER:
                await NotificationJobsService.send_worker_reminders()
            elif schedule_type == ScheduleType.CRITICAL_ALERT:
                await NotificationJobsService.check_critical_alerts()
            else:
                logger.warning(f"Unknown schedule type: {schedule_type}")

        except Exception as e:
            logger.error(f"Error triggering job manually: {str(e)}", exc_info=True)
            raise


# Global scheduler instance
_scheduler_service: SchedulerService = None


def get_scheduler_service() -> SchedulerService:
    """Get global scheduler service instance"""
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = SchedulerService()
    return _scheduler_service


def start_scheduler():
    """Start the global scheduler service"""
    scheduler = get_scheduler_service()
    scheduler.start()


def stop_scheduler():
    """Stop the global scheduler service"""
    scheduler = get_scheduler_service()
    scheduler.stop()
