"""
Email Notification Service

Handles sending email notifications for violations and alerts.
Supports SMTP configuration and templated emails.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class EmailConfig:
    """Email configuration settings"""

    def __init__(
        self,
        smtp_host: str = "smtp.gmail.com",
        smtp_port: int = 587,
        smtp_user: str = "",
        smtp_password: str = "",
        from_email: str = "",
        from_name: str = "PPE Safety System",
        use_tls: bool = True,
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_email = from_email or smtp_user
        self.from_name = from_name
        self.use_tls = use_tls


class EmailService:
    """Service for sending email notifications"""

    def __init__(self, config: Optional[EmailConfig] = None):
        self.config = config or EmailConfig()
        # Strip whitespace and check if credentials are not empty
        smtp_user_raw = self.config.smtp_user or ""
        smtp_password_raw = self.config.smtp_password or ""
        smtp_user = smtp_user_raw.strip()
        smtp_password = smtp_password_raw.strip()
        self.enabled = bool(smtp_user and smtp_password)
        
        # Store stripped values back to config for use
        self.config.smtp_user = smtp_user
        self.config.smtp_password = smtp_password
        
        logger.info(f"EmailService initialized: smtp_user='{smtp_user}' (len={len(smtp_user)}), smtp_password={'***' if smtp_password else 'EMPTY'} (len={len(smtp_password)}), enabled={self.enabled}")

    def send_email(
        self,
        to_emails: List[str],
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> bool:
        """
        Send an email with HTML and optional text body.

        Args:
            to_emails: List of recipient email addresses
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text fallback (optional)
            attachments: List of attachments (optional)

        Returns:
            bool: True if sent successfully, False otherwise
        """
        if not self.enabled:
            logger.warning(f"Email service not configured - email not sent. smtp_user='{self.config.smtp_user}', smtp_password={'SET' if self.config.smtp_password else 'NOT SET'}, enabled={self.enabled}")
            return False

        if not to_emails:
            logger.warning("No recipient emails provided")
            return False

        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.config.from_name} <{self.config.from_email}>"
            msg['To'] = ', '.join(to_emails)
            msg['Date'] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S %z")

            # Add text and HTML parts
            if text_body:
                msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))

            # Add attachments if provided
            if attachments:
                for attachment in attachments:
                    self._add_attachment(msg, attachment)

            # Connect and send
            with smtplib.SMTP(self.config.smtp_host, self.config.smtp_port) as server:
                server.ehlo()  # Identify ourselves to the SMTP server
                if self.config.use_tls:
                    server.starttls()  # Secure the connection
                    server.ehlo()  # Re-identify after STARTTLS (required by RFC)
                server.login(self.config.smtp_user, self.config.smtp_password)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {len(to_emails)} recipients")
            return True

        except smtplib.SMTPAuthenticationError as e:
            error_msg = f"SMTP Authentication failed. Check your email and password. Error: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise Exception(error_msg) from e
        except smtplib.SMTPException as e:
            error_msg = f"SMTP error occurred: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise Exception(error_msg) from e
        except Exception as e:
            error_type = type(e).__name__
            error_msg = f"Failed to send email: {error_type}: {str(e) if str(e) else 'Unknown error'}"
            logger.error(error_msg, exc_info=True)
            raise Exception(error_msg) from e

    def _add_attachment(self, msg: MIMEMultipart, attachment: Dict[str, Any]):
        """Add an attachment to the email message"""
        try:
            filename = attachment.get('filename', 'attachment')
            content = attachment.get('content')
            content_type = attachment.get('content_type', 'application/octet-stream')

            if content_type.startswith('image/'):
                img = MIMEImage(content, _subtype=content_type.split('/')[-1])
                img.add_header('Content-Disposition', 'attachment', filename=filename)
                msg.attach(img)
            else:
                part = MIMEText(content, 'plain')
                part.add_header('Content-Disposition', 'attachment', filename=filename)
                msg.attach(part)

        except Exception as e:
            logger.error(f"Failed to add attachment: {str(e)}")

    def send_violation_alert(
        self,
        to_emails: List[str],
        violation_data: Dict[str, Any],
        snapshot_path: Optional[str] = None,
    ) -> bool:
        """
        Send a violation alert email.

        Args:
            to_emails: List of recipient email addresses
            violation_data: Violation information
            snapshot_path: Optional path to violation snapshot image

        Returns:
            bool: True if sent successfully
        """
        severity = violation_data.get('severity', 'medium').upper()
        camera_name = violation_data.get('camera_name', f"Camera #{violation_data.get('camera_id')}")
        missing_ppe = violation_data.get('missing_ppe', [])
        timestamp = violation_data.get('timestamp', datetime.now())

        # Format timestamp
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

        # Create subject
        subject = f"🚨 {severity} PPE Violation - {camera_name}"

        # Create HTML body
        html_body = self._create_violation_email_html(
            severity=severity,
            camera_name=camera_name,
            missing_ppe=missing_ppe,
            timestamp=timestamp,
            violation_id=violation_data.get('id'),
            confidence=violation_data.get('confidence', 0.0),
            location=violation_data.get('location', 'Unknown'),
        )

        # Create text fallback
        text_body = self._create_violation_email_text(
            severity=severity,
            camera_name=camera_name,
            missing_ppe=missing_ppe,
            timestamp=timestamp,
        )

        # Add snapshot as attachment if available
        attachments = []
        if snapshot_path and Path(snapshot_path).exists():
            try:
                with open(snapshot_path, 'rb') as f:
                    attachments.append({
                        'filename': 'violation_snapshot.jpg',
                        'content': f.read(),
                        'content_type': 'image/jpeg',
                    })
            except Exception as e:
                logger.error(f"Failed to load snapshot: {str(e)}")

        return self.send_email(
            to_emails=to_emails,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            attachments=attachments if attachments else None,
        )

    def _create_violation_email_html(
        self,
        severity: str,
        camera_name: str,
        missing_ppe: List[str],
        timestamp: datetime,
        violation_id: Optional[int] = None,
        confidence: float = 0.0,
        location: str = "Unknown",
    ) -> str:
        """Create HTML email body for violation alert"""

        # Severity colors
        severity_colors = {
            'CRITICAL': '#DC2626',
            'HIGH': '#F59E0B',
            'MEDIUM': '#F7B84B',
            'LOW': '#6B7280',
        }
        color = severity_colors.get(severity, '#6B7280')

        # Format PPE list
        ppe_labels = {
            'hard_hat': 'Hard Hat',
            'safety_vest': 'Safety Vest',
            'safety_glasses': 'Safety Glasses',
            'face_mask': 'Face Mask',
            'safety_boots': 'Safety Boots',
            'gloves': 'Gloves',
        }
        ppe_items = ''.join([
            f'<li style="margin: 5px 0;">{ppe_labels.get(ppe, ppe)}</li>'
            for ppe in missing_ppe
        ])

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background-color: {color}; padding: 30px; text-align: center;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                                        ⚠️ PPE VIOLATION DETECTED
                                    </h1>
                                </td>
                            </tr>

                            <!-- Severity Badge -->
                            <tr>
                                <td style="padding: 20px 30px; background-color: #f9fafb;">
                                    <div style="background-color: {color}; color: #ffffff; padding: 10px 20px; border-radius: 6px; display: inline-block; font-weight: 700; font-size: 14px;">
                                        {severity} SEVERITY
                                    </div>
                                </td>
                            </tr>

                            <!-- Details -->
                            <tr>
                                <td style="padding: 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                                                <strong style="color: #374151;">Camera:</strong>
                                                <span style="color: #6b7280; float: right;">{camera_name}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                                                <strong style="color: #374151;">Location:</strong>
                                                <span style="color: #6b7280; float: right;">{location}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                                                <strong style="color: #374151;">Time:</strong>
                                                <span style="color: #6b7280; float: right;">{timestamp.strftime('%B %d, %Y at %I:%M %p')}</span>
                                            </td>
                                        </tr>
                                        {f'''<tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                                                <strong style="color: #374151;">Violation ID:</strong>
                                                <span style="color: #6b7280; float: right;">#{violation_id}</span>
                                            </td>
                                        </tr>''' if violation_id else ''}
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                                                <strong style="color: #374151;">Confidence:</strong>
                                                <span style="color: #6b7280; float: right;">{confidence * 100:.1f}%</span>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Missing PPE -->
                                    <div style="margin-top: 30px;">
                                        <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px;">Missing PPE:</h3>
                                        <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
                                            {ppe_items}
                                        </ul>
                                    </div>

                                    <!-- Action Required -->
                                    <div style="margin-top: 30px; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                                        <p style="margin: 0; color: #92400e; font-weight: 600;">⚡ Action Required</p>
                                        <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
                                            Please review this violation and take appropriate corrective action immediately.
                                        </p>
                                    </div>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style="padding: 20px 30px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                                    <p style="margin: 0; color: #6b7280; font-size: 12px;">
                                        This is an automated alert from your PPE Safety Monitoring System
                                    </p>
                                    <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 11px;">
                                        © {datetime.now().year} PPE Safety System. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        return html

    def _create_violation_email_text(
        self,
        severity: str,
        camera_name: str,
        missing_ppe: List[str],
        timestamp: datetime,
    ) -> str:
        """Create plain text email body for violation alert"""

        ppe_labels = {
            'hard_hat': 'Hard Hat',
            'safety_vest': 'Safety Vest',
            'safety_glasses': 'Safety Glasses',
            'face_mask': 'Face Mask',
            'safety_boots': 'Safety Boots',
            'gloves': 'Gloves',
        }

        ppe_list = '\n'.join([f"  - {ppe_labels.get(ppe, ppe)}" for ppe in missing_ppe])

        text = f"""
        ⚠️ PPE VIOLATION DETECTED

        SEVERITY: {severity}

        Details:
        --------
        Camera: {camera_name}
        Time: {timestamp.strftime('%B %d, %Y at %I:%M %p')}

        Missing PPE:
        {ppe_list}

        ⚡ ACTION REQUIRED
        Please review this violation and take appropriate corrective action immediately.

        ---
        This is an automated alert from your PPE Safety Monitoring System
        """

        return text.strip()

    def send_daily_summary(
        self,
        to_emails: List[str],
        summary_data: Dict[str, Any],
    ) -> bool:
        """
        Send daily summary email.

        Args:
            to_emails: List of recipient email addresses
            summary_data: Summary statistics

        Returns:
            bool: True if sent successfully
        """
        subject = f"📊 Daily Safety Summary - {datetime.now().strftime('%B %d, %Y')}"

        html_body = self._create_summary_email_html(summary_data)
        text_body = self._create_summary_email_text(summary_data)

        return self.send_email(
            to_emails=to_emails,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

    def _create_summary_email_html(self, summary_data: Dict[str, Any]) -> str:
        """Create HTML email body for daily summary"""

        total_violations = summary_data.get('total_violations', 0)
        critical = summary_data.get('critical_violations', 0)
        high = summary_data.get('high_violations', 0)
        compliance_rate = summary_data.get('compliance_rate', 0.0)

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                            <tr>
                                <td style="background-color: #405189; padding: 30px; text-align: center;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 24px;">📊 Daily Safety Summary</h1>
                                    <p style="margin: 10px 0 0 0; color: #e5e7eb;">{datetime.now().strftime('%B %d, %Y')}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 30px;">
                                    <h2 style="color: #374151; font-size: 18px; margin: 0 0 20px 0;">Today's Statistics</h2>

                                    <table width="100%" cellpadding="10" cellspacing="0">
                                        <tr>
                                            <td style="background-color: #f9fafb; border-radius: 6px; padding: 15px;">
                                                <div style="font-size: 32px; font-weight: 700; color: #405189;">{total_violations}</div>
                                                <div style="color: #6b7280; font-size: 14px;">Total Violations</div>
                                            </td>
                                            <td width="20"></td>
                                            <td style="background-color: #fef3c7; border-radius: 6px; padding: 15px;">
                                                <div style="font-size: 32px; font-weight: 700; color: #d97706;">{critical + high}</div>
                                                <div style="color: #92400e; font-size: 14px;">Critical/High</div>
                                            </td>
                                        </tr>
                                    </table>

                                    <div style="margin-top: 20px; padding: 15px; background-color: #ecfdf5; border-radius: 6px;">
                                        <div style="font-size: 14px; color: #065f46; margin-bottom: 5px;">Compliance Rate</div>
                                        <div style="font-size: 32px; font-weight: 700; color: #059669;">{compliance_rate:.1f}%</div>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        return html

    def _create_summary_email_text(self, summary_data: Dict[str, Any]) -> str:
        """Create plain text email body for daily summary"""

        total = summary_data.get('total_violations', 0)
        critical = summary_data.get('critical_violations', 0)
        high = summary_data.get('high_violations', 0)
        compliance = summary_data.get('compliance_rate', 0.0)

        text = f"""
        📊 DAILY SAFETY SUMMARY
        {datetime.now().strftime('%B %d, %Y')}

        Today's Statistics:
        -------------------
        Total Violations: {total}
        Critical/High: {critical + high}
        Compliance Rate: {compliance:.1f}%

        ---
        PPE Safety Monitoring System
        """

        return text.strip()


# Global email service instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create the global email service instance"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service


def configure_email_service(config: EmailConfig):
    """Configure the global email service"""
    logger.info(f"Configuring email service: smtp_user='{config.smtp_user}', smtp_password={'***' if config.smtp_password else 'EMPTY'}")
    global _email_service
    _email_service = EmailService(config)
