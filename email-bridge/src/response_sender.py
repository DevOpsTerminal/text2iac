import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import formataddr, make_msgid, formatdate
from typing import Dict, List, Optional, Union, BinaryIO, Any
from pathlib import Path
import aiosmtplib
from jinja2 import Environment, FileSystemLoader

from ..core.config import settings
from ..models.email import Email, EmailStatus, EmailType
from ..schemas.email import EmailCreate, EmailAttachmentCreate
from ..db.session import async_session

logger = logging.getLogger(__name__)

class EmailResponseSender:
    """Handle sending email responses and notifications"""
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_use_tls = settings.SMTP_USE_TLS
        self.smtp_use_ssl = settings.SMTP_USE_SSL
        self.default_from = settings.EMAIL_FROM
        self.reply_to = settings.EMAIL_REPLY_TO or settings.EMAIL_FROM
        
        # Set up Jinja2 environment for email templates
        template_path = Path(__file__).parent.parent / "templates" / "emails"
        self.env = Environment(
            loader=FileSystemLoader(template_path),
            autoescape=True,
        )
    
    async def send_email(
        self,
        to_emails: Union[str, List[str]],
        subject: str,
        body: str,
        body_type: str = "plain",
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[Union[str, List[str]]] = None,
        bcc: Optional[Union[str, List[str]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        headers: Optional[Dict[str, str]] = None,
        template_name: Optional[str] = None,
        template_context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Send an email with optional HTML content and attachments
        
        Args:
            to_emails: Recipient email address(es)
            subject: Email subject
            body: Email body content
            body_type: 'plain' or 'html'
            from_email: Sender email address (defaults to settings.EMAIL_FROM)
            reply_to: Reply-to email address
            cc: CC recipient(s)
            bcc: BCC recipient(s)
            attachments: List of attachment dicts with 'filename' and 'data' keys
            headers: Additional email headers
            template_name: Optional template name to render
            template_context: Context data for template rendering
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        try:
            # Create email record in database
            email_data = await self._create_email_record(
                to_emails=to_emails,
                subject=subject,
                body=body,
                body_type=body_type,
                from_email=from_email,
                reply_to=reply_to,
                cc=cc,
                bcc=bcc,
                template_name=template_name,
                template_context=template_context,
            )
            
            # Render template if provided
            if template_name and template_context:
                subject, body = self._render_template(template_name, template_context)
            
            # Create MIME message
            msg = self._create_mime_message(
                to_emails=to_emails,
                subject=subject,
                body=body,
                body_type=body_type,
                from_email=from_email or self.default_from,
                reply_to=reply_to or self.reply_to,
                cc=cc,
                bcc=bcc,
                attachments=attachments,
                headers=headers,
                message_id=email_data.message_id,
            )
            
            # Send the email
            success = await self._send_smtp(msg)
            
            # Update email status
            await self._update_email_status(
                email_id=email_data.id,
                status=EmailStatus.SENT if success else EmailStatus.FAILED,
                error=None if success else "Failed to send email"
            )
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}", exc_info=True)
            
            # Update email status with error
            if 'email_data' in locals():
                await self._update_email_status(
                    email_id=email_data.id,
                    status=EmailStatus.FAILED,
                    error=str(e)
                )
            
            return False
    
    async def send_template_email(
        self,
        template_name: str,
        to_emails: Union[str, List[str]],
        subject: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[Union[str, List[str]]] = None,
        bcc: Optional[Union[str, List[str]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> bool:
        """Send an email using a template"""
        try:
            # Render the template
            subject_template, body_template = self._render_template(template_name, context or {})
            
            # Use provided subject or template subject
            final_subject = subject or subject_template or ""
            
            return await self.send_email(
                to_emails=to_emails,
                subject=final_subject,
                body=body_template,
                body_type="html",  # Assume templates are HTML by default
                from_email=from_email,
                reply_to=reply_to,
                cc=cc,
                bcc=bcc,
                attachments=attachments,
                headers=headers,
            )
            
        except Exception as e:
            logger.error(f"Error sending template email: {str(e)}", exc_info=True)
            return False
    
    def _render_template(
        self, template_name: str, context: Dict[str, Any]
    ) -> tuple[str, str]:
        """Render an email template with the given context"""
        try:
            # Try to load subject and body templates
            subject_template = self.env.get_template(f"{template_name}_subject.txt")
            body_template = self.env.get_template(f"{template_name}_body.html")
            
            # Render templates with context
            subject = subject_template.render(**context).strip()
            body = body_template.render(**context)
            
            return subject, body
            
        except Exception as e:
            logger.error(f"Error rendering template {template_name}: {str(e)}", exc_info=True)
            # Fall back to a simple template
            return (
                context.get("subject", ""),
                f"<p>Error rendering template: {str(e)}</p>"
            )
    
    async def _create_email_record(
        self,
        to_emails: Union[str, List[str]],
        subject: str,
        body: str,
        body_type: str,
        from_email: Optional[str],
        reply_to: Optional[str],
        cc: Optional[Union[str, List[str]]],
        bcc: Optional[Union[str, List[str]]],
        template_name: Optional[str] = None,
        template_context: Optional[Dict[str, Any]] = None,
    ) -> Email:
        """Create an email record in the database"""
        async with async_session() as session:
            # Normalize email addresses
            to_emails_list = [to_emails] if isinstance(to_emails, str) else to_emails
            cc_list = [cc] if isinstance(cc, str) else (cc or [])
            bcc_list = [bcc] if isinstance(bcc, str) else (bcc or [])
            
            # Create email record
            email_data = EmailCreate(
                message_id=f"<{make_msgid()}>",
                sender=from_email or self.default_from,
                recipients=",".join(to_emails_list),
                cc_recipients=",".join(cc_list) if cc_list else None,
                bcc_recipients=",".join(bcc_list) if bcc_list else None,
                subject=subject,
                body=body,
                content_type=f"text/{body_type}",
                status=EmailStatus.PENDING,
                email_type=EmailType.OUTGOING,
                metadata={
                    "template": template_name,
                    "template_context": template_context,
                    "reply_to": reply_to,
                },
            )
            
            # Save to database
            db_email = Email(**email_data.dict())
            session.add(db_email)
            await session.commit()
            await session.refresh(db_email)
            
            return db_email
    
    def _create_mime_message(
        self,
        to_emails: Union[str, List[str]],
        subject: str,
        body: str,
        body_type: str,
        from_email: str,
        reply_to: str,
        cc: Optional[Union[str, List[str]]],
        bcc: Optional[Union[str, List[str]]],
        attachments: Optional[List[Dict[str, Any]]],
        headers: Optional[Dict[str, str]],
        message_id: str,
    ) -> MIMEMultipart:
        """Create a MIME message with optional attachments"""
        # Normalize recipients
        to_emails_list = [to_emails] if isinstance(to_emails, str) else to_emails
        cc_list = [cc] if isinstance(cc, str) else (cc or [])
        bcc_list = [bcc] if isinstance(bcc, str) else (bcc or [])
        
        # Create message container
        msg = MIMEMultipart()
        
        # Set basic headers
        msg["From"] = formataddr((settings.EMAIL_SENDER_NAME, from_email))
        msg["To"] = ", ".join(to_emails_list)
        if cc_list:
            msg["Cc"] = ", ".join(cc_list)
        msg["Subject"] = subject
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = message_id
        msg["Reply-To"] = reply_to
        
        # Add custom headers if provided
        if headers:
            for key, value in headers.items():
                if key not in msg:
                    msg[key] = value
        
        # Attach the body
        msg.attach(MIMEText(body, body_type, "utf-8"))
        
        # Add attachments if any
        if attachments:
            self._add_attachments(msg, attachments)
        
        return msg
    
    def _add_attachments(
        self, msg: MIMEMultipart, attachments: List[Dict[str, Any]]
    ) -> None:
        """Add attachments to the email"""
        for attachment in attachments:
            try:
                filename = attachment.get("filename", "attachment.bin")
                content = attachment.get("data")
                content_type = attachment.get("content_type", "application/octet-stream")
                
                if not content:
                    logger.warning(f"Skipping empty attachment: {filename}")
                    continue
                
                # Create attachment
                part = MIMEApplication(content, Name=filename)
                
                # Add headers
                part["Content-Disposition"] = f'attachment; filename="{filename}"'
                part["Content-Type"] = content_type
                
                # Add to message
                msg.attach(part)
                
            except Exception as e:
                logger.error(f"Error adding attachment {filename}: {str(e)}", exc_info=True)
    
    async def _send_smtp(self, msg: MIMEMultipart) -> bool:
        """Send email using SMTP"""
        try:
            # Create SMTP client
            if self.smtp_use_ssl:
                client = aiosmtplib.SMTP_SSL(
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    timeout=30,
                )
            else:
                client = aiosmtplib.SMTP(
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    timeout=30,
                )
            
            # Connect to server
            await client.connect(
                hostname=self.smtp_host,
                port=self.smtp_port,
                use_tls=self.smtp_use_tls,
            )
            
            # Login if credentials provided
            if self.smtp_username and self.smtp_password:
                await client.login(self.smtp_username, self.smtp_password)
            
            # Send the message
            await client.send_message(msg)
            
            # Disconnect
            await client.quit()
            
            logger.info(f"Email sent successfully to {msg['To']}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}", exc_info=True)
            return False
    
    async def _update_email_status(
        self, email_id: str, status: EmailStatus, error: Optional[str] = None
    ) -> None:
        """Update email status in the database"""
        try:
            async with async_session() as session:
                # Get the email
                result = await session.execute(
                    select(Email).where(Email.id == email_id)
                )
                db_email = result.scalar_one_or_none()
                
                if db_email:
                    # Update status
                    db_email.status = status
                    
                    # Set error if provided
                    if error:
                        db_email.error = error
                    
                    # Set sent/processed timestamp if applicable
                    if status == EmailStatus.SENT:
                        db_email.sent_at = db_email.sent_at or datetime.utcnow()
                    elif status in [EmailStatus.PROCESSED, EmailStatus.FAILED]:
                        db_email.processed_at = db_email.processed_at or datetime.utcnow()
                    
                    # Save changes
                    session.add(db_email)
                    await session.commit()
                    
        except Exception as e:
            logger.error(f"Error updating email status: {str(e)}", exc_info=True)
            # Don't re-raise to avoid masking the original error

# Singleton instance
response_sender = EmailResponseSender()

# Helper functions for common email types

async def send_welcome_email(to_email: str, name: str) -> bool:
    """Send a welcome email to a new user"""
    return await response_sender.send_template_email(
        template_name="welcome",
        to_emails=to_email,
        context={"name": name, "email": to_email},
    )

async def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """Send a password reset email"""
    return await response_sender.send_template_email(
        template_name="password_reset",
        to_emails=to_email,
        context={"reset_link": reset_link, "email": to_email},
    )

async def send_notification_email(
    to_email: str, 
    subject: str, 
    message: str, 
    action_link: Optional[str] = None,
    action_text: Optional[str] = None,
) -> bool:
    """Send a generic notification email"""
    return await response_sender.send_template_email(
        template_name="notification",
        to_emails=to_email,
        subject=subject,
        context={
            "subject": subject,
            "message": message,
            "action_link": action_link,
            "action_text": action_text,
        },
    )
