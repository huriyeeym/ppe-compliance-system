"""
Email Template Service
Manages email templates with variable substitution
"""

from typing import Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database.models import EmailTemplate, ScheduleType
from backend.utils.logger import logger
from datetime import datetime


# Default email templates
DEFAULT_TEMPLATES = {
    ScheduleType.DAILY_SUMMARY: {
        "subject": "PPE Günlük Rapor - {date}",
        "body_html": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; }}
        .stats {{ background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }}
        .stat-item {{ margin: 10px 0; }}
        .stat-label {{ font-weight: bold; color: #1f2937; }}
        .violations-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        .violations-table th {{ background: #e5e7eb; padding: 10px; text-align: left; }}
        .violations-table td {{ padding: 10px; border-bottom: 1px solid #e5e7eb; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 PPE Günlük İhlal Raporu</h1>
        <p>{date}</p>
    </div>

    <div class="content">
        <div class="stats">
            <div class="stat-item">
                <span class="stat-label">✓ Toplam Çalışan:</span> {total_workers}
            </div>
            <div class="stat-item">
                <span class="stat-label">✗ İhlal Sayısı:</span> {total_violations}
            </div>
            <div class="stat-item">
                <span class="stat-label">📈 İhlal Oranı:</span> {violation_rate}%
            </div>
        </div>

        {trend_alert}

        <h2>⚠️ En Çok İhlal Yapan Çalışanlar</h2>
        <table class="violations-table">
            <thead>
                <tr>
                    <th>Sıra</th>
                    <th>Çalışan</th>
                    <th>İhlal Sayısı</th>
                    <th>İhlal Tipi</th>
                </tr>
            </thead>
            <tbody>
                {top_violators_table}
            </tbody>
        </table>

        <p style="margin-top: 30px;">
            <a href="{dashboard_url}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                📊 Detaylı Raporu Görüntüle
            </a>
        </p>
    </div>

    <div class="footer">
        <p>Bu email otomatik olarak PPE Güvenlik Sistemi tarafından gönderilmiştir.</p>
        <p>Sorularınız için: safety@company.com</p>
    </div>
</body>
</html>
        """,
        "body_text": """
PPE GÜNLÜK İHLAL RAPORU
{date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GÜNLÜK ÖZET:
✓ Toplam Çalışan: {total_workers}
✗ İhlal Sayısı: {total_violations}
📈 İhlal Oranı: {violation_rate}%

{trend_alert}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ EN ÇOK İHLAL YAPAN ÇALIŞANLAR:

{top_violators_list}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detaylı rapor için: {dashboard_url}

Bu email otomatik olarak gönderilmiştir.
        """,
        "variables": ["date", "total_workers", "total_violations", "violation_rate",
                     "trend_alert", "top_violators_table", "top_violators_list", "dashboard_url"]
    },

    ScheduleType.WORKER_REMINDER: {
        "subject": "İş Güvenliği Hatırlatması - PPE Kullanımı",
        "body_html": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .header {{ background: #f59e0b; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; }}
        .reminder-box {{ background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }}
        .violations-list {{ background: #f3f4f6; padding: 15px; margin: 15px 0; }}
        .cta {{ background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>💌 İş Güvenliği Hatırlatması</h1>
    </div>

    <div class="content">
        <p>Merhaba <strong>{worker_name}</strong>,</p>

        <div class="reminder-box">
            <p><strong>⚠️ Bu hafta {violation_count} kez PPE ekipmanı eksik olarak tespit edildiniz.</strong></p>
        </div>

        <div class="violations-list">
            <h3>İhlal Detayları:</h3>
            {violations_breakdown}
        </div>

        <p>İş güvenliği ekipmanları sağlığınız için kritik önem taşımaktadır. Lütfen PPE kullanımına dikkat edelim.</p>

        <p>Herhangi bir ekipman eksikliği veya sorunuz varsa lütfen güvenlik departmanı ile iletişime geçin.</p>

        <a href="{contact_url}" class="cta">📞 Güvenlik Departmanı ile İletişime Geç</a>
    </div>

    <div class="footer">
        <p>Bu hatırlatma sağlığınız ve güvenliğiniz için gönderilmiştir.</p>
        <p>Sorularınız için: safety@company.com</p>
    </div>
</body>
</html>
        """,
        "body_text": """
💌 İŞ GÜVENLİĞİ HATIRLATMASI

Merhaba {worker_name},

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Bu hafta {violation_count} kez PPE ekipmanı eksik olarak tespit edildiniz.

İHLAL DETAYLARI:
{violations_breakdown}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

İş güvenliği ekipmanları sağlığınız için kritik önem taşımaktadır.
Lütfen PPE kullanımına dikkat edelim.

Herhangi bir ekipman eksikliği veya sorunuz varsa lütfen güvenlik
departmanı ile iletişime geçin.

İletişim: safety@company.com

Bu hatırlatma sağlığınız ve güvenliğiniz için gönderilmiştir.
        """,
        "variables": ["worker_name", "violation_count", "violations_breakdown", "contact_url"]
    },

    ScheduleType.CRITICAL_ALERT: {
        "subject": "🚨 ACİL: Kritik PPE İhlali Tespit Edildi",
        "body_html": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .header {{ background: #dc2626; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; }}
        .alert-box {{ background: #fee2e2; padding: 20px; border-left: 4px solid #dc2626; margin: 20px 0; }}
        .details {{ background: #f3f4f6; padding: 15px; margin: 15px 0; }}
        .detail-item {{ margin: 8px 0; }}
        .cta {{ background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 KRİTİK UYARI</h1>
        <p>Acil Müdahale Gerekiyor</p>
    </div>

    <div class="content">
        <div class="alert-box">
            <h2>⚠️ {worker_name} - Kritik İhlal Tespit Edildi</h2>
            <p><strong>{time_window}</strong> içinde <strong>{violation_count} ihlal</strong> gerçekleşti!</p>
        </div>

        <div class="details">
            <h3>Detaylar:</h3>
            <div class="detail-item"><strong>Çalışan:</strong> {worker_name}</div>
            <div class="detail-item"><strong>Lokasyon:</strong> {location}</div>
            <div class="detail-item"><strong>İhlal Tipi:</strong> {violation_type}</div>
            <div class="detail-item"><strong>Zaman:</strong> {timestamp}</div>
        </div>

        <p><strong style="color: #dc2626;">Lütfen hemen müdahale ediniz!</strong></p>

        <a href="{dashboard_url}" class="cta">🔍 Canlı Görüntüye Git</a>
    </div>
</body>
</html>
        """,
        "body_text": """
🚨 KRİTİK UYARI - ACİL MÜDAHALE GEREKİYOR

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ {worker_name} - Kritik İhlal Tespit Edildi

{time_window} içinde {violation_count} ihlal gerçekleşti!

DETAYLAR:
• Çalışan: {worker_name}
• Lokasyon: {location}
• İhlal Tipi: {violation_type}
• Zaman: {timestamp}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LÜTFEN HEMEN MÜDAHALE EDİNİZ!

Canlı görüntü: {dashboard_url}
        """,
        "variables": ["worker_name", "violation_count", "time_window", "location",
                     "violation_type", "timestamp", "dashboard_url"]
    }
}


class EmailTemplateService:
    """Service for managing and rendering email templates"""

    @staticmethod
    async def ensure_default_templates(db: AsyncSession):
        """
        Ensure default email templates exist in database
        Creates missing templates with default content
        """
        try:
            for schedule_type, template_data in DEFAULT_TEMPLATES.items():
                # Check if template exists
                result = await db.execute(
                    select(EmailTemplate).where(EmailTemplate.type == schedule_type)
                )
                existing = result.scalar_one_or_none()

                if not existing:
                    # Create new template
                    template = EmailTemplate(
                        type=schedule_type,
                        subject=template_data["subject"],
                        body_html=template_data["body_html"],
                        body_text=template_data["body_text"],
                        variables=template_data["variables"]
                    )
                    db.add(template)
                    logger.info(f"Created default template for {schedule_type.value}")

            await db.commit()
            logger.info("Default email templates ensured")

        except Exception as e:
            logger.error(f"Error ensuring default templates: {str(e)}", exc_info=True)
            await db.rollback()
            raise

    @staticmethod
    async def get_template(db: AsyncSession, schedule_type: ScheduleType) -> Optional[EmailTemplate]:
        """Get email template by type"""
        try:
            result = await db.execute(
                select(EmailTemplate).where(EmailTemplate.type == schedule_type)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting template: {str(e)}", exc_info=True)
            return None

    @staticmethod
    def render_template(template: EmailTemplate, variables: Dict[str, Any]) -> tuple[str, str, str]:
        """
        Render email template with variables

        Args:
            template: EmailTemplate object
            variables: Dictionary of variable values

        Returns:
            Tuple of (subject, html_body, text_body)
        """
        try:
            subject = template.subject.format(**variables)
            html_body = template.body_html.format(**variables)
            text_body = template.body_text.format(**variables)

            return subject, html_body, text_body

        except KeyError as e:
            logger.error(f"Missing template variable: {str(e)}")
            raise ValueError(f"Missing required template variable: {str(e)}")
        except Exception as e:
            logger.error(f"Error rendering template: {str(e)}", exc_info=True)
            raise

    @staticmethod
    def format_daily_summary_variables(
        date: str,
        total_workers: int,
        total_violations: int,
        violation_rate: float,
        top_violators: list,
        trend_info: Optional[str] = None,
        dashboard_url: str = "http://localhost:5173"
    ) -> Dict[str, Any]:
        """Format variables for daily summary email"""

        # Build top violators table (HTML)
        table_rows = ""
        for i, violator in enumerate(top_violators[:5], 1):
            table_rows += f"""
                <tr>
                    <td>{i}</td>
                    <td>{violator.get('name', 'Unknown')}</td>
                    <td>{violator.get('count', 0)}</td>
                    <td>{violator.get('type', 'N/A')}</td>
                </tr>
            """

        # Build top violators list (text)
        text_list = ""
        for i, violator in enumerate(top_violators[:5], 1):
            text_list += f"{i}. {violator.get('name', 'Unknown')} - {violator.get('count', 0)} ihlal ({violator.get('type', 'N/A')})\n"

        # Trend alert
        trend_alert_html = ""
        if trend_info:
            trend_alert_html = f'<div class="reminder-box" style="background: #fef3c7; padding: 15px; margin: 15px 0;">⚠️ {trend_info}</div>'

        return {
            "date": date,
            "total_workers": total_workers,
            "total_violations": total_violations,
            "violation_rate": f"{violation_rate:.1f}",
            "top_violators_table": table_rows or "<tr><td colspan='4'>İhlal yok</td></tr>",
            "top_violators_list": text_list or "İhlal yok",
            "trend_alert": trend_alert_html or "",
            "dashboard_url": dashboard_url
        }

    @staticmethod
    def format_worker_reminder_variables(
        worker_name: str,
        violation_count: int,
        violations_breakdown: list,
        contact_url: str = "mailto:safety@company.com"
    ) -> Dict[str, Any]:
        """Format variables for worker reminder email"""

        # Build violations breakdown (HTML)
        breakdown_html = "<ul>"
        for violation in violations_breakdown:
            breakdown_html += f"<li><strong>{violation.get('count', 0)}x</strong> {violation.get('type', 'N/A')}</li>"
        breakdown_html += "</ul>"

        # Build violations breakdown (text)
        breakdown_text = ""
        for violation in violations_breakdown:
            breakdown_text += f"• {violation.get('count', 0)}x {violation.get('type', 'N/A')}\n"

        return {
            "worker_name": worker_name,
            "violation_count": violation_count,
            "violations_breakdown": breakdown_html if violations_breakdown else "<p>Detay yok</p>",
            "contact_url": contact_url
        }

    @staticmethod
    def format_critical_alert_variables(
        worker_name: str,
        violation_count: int,
        time_window: str,
        location: str,
        violation_type: str,
        timestamp: str,
        dashboard_url: str = "http://localhost:5173"
    ) -> Dict[str, Any]:
        """Format variables for critical alert email"""

        return {
            "worker_name": worker_name,
            "violation_count": violation_count,
            "time_window": time_window,
            "location": location,
            "violation_type": violation_type,
            "timestamp": timestamp,
            "dashboard_url": dashboard_url
        }
