import re
import logging
import email
import json
from typing import Dict, List, Optional, Any, Tuple
from email.message import Message
from datetime import datetime
import html2text
import httpx

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..core.config import settings
from ..models.email import Email, EmailStatus, EmailType, EmailAttachment
from ..schemas.email import EmailCreate, EmailAttachmentCreate
from ..services.template import EmailTemplateService
from ..services.api import APIClient
from ..utils.helpers import generate_id

logger = logging.getLogger(__name__)

class EmailProcessor:
    """Process incoming emails and trigger appropriate actions"""
    
    def __init__(self):
        self.template_service = EmailTemplateService()
        self.api_client = APIClient()
        self.html_converter = html2text.HTML2Text()
        self.html_converter.ignore_links = False
        self.html_converter.ignore_images = False
    
    async def process_email(
        self,
        db: AsyncSession,
        msg: Message,
        sender: str,
        recipients: List[str],
    ) -> Optional[Email]:
        """Process an incoming email"""
        try:
            # Extract email data
            subject = msg.get("Subject", "No Subject").strip()
            message_id = msg.get("Message-ID", generate_id())
            in_reply_to = msg.get("In-Reply-To")
            references = msg.get("References", "")
            
            # Get email body and content type
            body, content_type, attachments = self._extract_email_content(msg)
            
            # Determine email type
            email_type = self._determine_email_type(subject, body, sender, recipients)
            
            # Create email record
            email_data = EmailCreate(
                message_id=message_id,
                in_reply_to=in_reply_to,
                references=references,
                sender=sender,
                recipients=",".join(recipients),
                subject=subject,
                body=body,
                content_type=content_type,
                status=EmailStatus.RECEIVED,
                email_type=email_type,
                metadata={
                    "headers": dict(msg.items()),
                    "source_ip": "localhost",  # Would come from SMTP session in production
                },
            )
            
            # Save to database
            db_email = await self._save_email(db, email_data)
            
            # Process attachments
            if attachments:
                await self._process_attachments(db, db_email.id, attachments)
            
            # Process based on email type
            await self._route_email(db, db_email, email_type, body)
            
            return db_email
            
        except Exception as e:
            logger.error(f"Error processing email: {str(e)}", exc_info=True)
            # Try to save the error state
            try:
                if 'db_email' in locals() and db_email:
                    db_email.status = EmailStatus.FAILED
                    db_email.error = str(e)
                    db.add(db_email)
                    await db.commit()
            except Exception as db_error:
                logger.error(f"Error updating email status: {str(db_error)}", exc_info=True)
            
            return None
    
    def _extract_email_content(
        self, msg: Message
    ) -> Tuple[str, str, List[Dict[str, Any]]]:
        """Extract content and attachments from email"""
        body = ""
        content_type = "text/plain"
        attachments = []
        
        if msg.is_multipart():
            for part in msg.walk():
                content_disposition = part.get("Content-Disposition", "")
                content_type = part.get_content_type()
                
                # Skip multipart/* as they're just containers
                if part.get_content_maintype() == "multipart":
                    continue
                
                # Handle attachments
                if "attachment" in content_disposition.lower():
                    filename = part.get_filename()
                    if not filename:
                        # Generate a filename if not provided
                        ext = self._get_extension(content_type)
                        filename = f"attachment_{generate_id()}{ext}"
                    
                    attachment_data = part.get_payload(decode=True)
                    attachments.append({
                        "filename": filename,
                        "content_type": content_type,
                        "data": attachment_data,
                        "size": len(attachment_data),
                    })
                    continue
                
                # Get the email body
                if not body and content_type in ["text/plain", "text/html"]:
                    try:
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or "utf-8"
                        body = payload.decode(charset, errors="replace")
                        
                        # Convert HTML to plain text if needed
                        if content_type == "text/html":
                            body = self.html_converter.handle(body)
                        
                        content_type = content_type
                    except Exception as e:
                        logger.error(f"Error decoding email part: {str(e)}")
        else:
            # Not multipart - simple email
            try:
                payload = msg.get_payload(decode=True)
                charset = msg.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")
                content_type = msg.get_content_type()
                
                if content_type == "text/html":
                    body = self.html_converter.handle(body)
            except Exception as e:
                logger.error(f"Error decoding email: {str(e)}")
        
        return body, content_type, attachments
    
    def _get_extension(self, content_type: str) -> str:
        """Get file extension from content type"""
        extension_map = {
            "text/plain": ".txt",
            "text/html": ".html",
            "application/json": ".json",
            "application/pdf": ".pdf",
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "application/msword": ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "application/vnd.ms-excel": ".xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
            "application/vnd.ms-powerpoint": ".ppt",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
            "application/zip": ".zip",
            "application/x-rar-compressed": ".rar",
            "application/x-gzip": ".gz",
            "application/x-tar": ".tar",
        }
        
        return extension_map.get(content_type, ".bin")
    
    def _determine_email_type(
        self, subject: str, body: str, sender: str, recipients: List[str]
    ) -> EmailType:
        """Determine the type of email based on content and sender"""
        # Check for auto-replies
        auto_reply_indicators = [
            "auto-reply", "automatic reply", "auto reply", "autoreply",
            "out of office", "ooo", "vacation", "away", "annual leave",
            "automatic response", "auto response", "auto-response"
        ]
        
        subject_lower = subject.lower()
        body_lower = body.lower()
        
        for indicator in auto_reply_indicators:
            if indicator in subject_lower or indicator in body_lower:
                return EmailType.AUTO_REPLY
        
        # Check for delivery failures
        if any(term in subject_lower for term in ["delivery failed", "undeliverable", "returned mail"]):
            return EmailType.BOUNCE
        
        # Check for unsubscribe requests
        if "unsubscribe" in body_lower or "opt-out" in body_lower:
            return EmailType.UNSUBSCRIBE
        
        # Check for infrastructure requests
        if any(term in subject_lower for term in ["infra request", "infrastructure request"]):
            return EmailType.INFRA_REQUEST
        
        # Default to standard email
        return EmailType.STANDARD
    
    async def _save_email(
        self, db: AsyncSession, email_data: EmailCreate
    ) -> Email:
        """Save email to database"""
        db_email = Email(**email_data.dict())
        db.add(db_email)
        await db.commit()
        await db.refresh(db_email)
        return db_email
    
    async def _process_attachments(
        self, db: AsyncSession, email_id: str, attachments: List[Dict[str, Any]]
    ) -> None:
        """Process and save email attachments"""
        for attachment in attachments:
            try:
                attachment_data = EmailAttachmentCreate(
                    email_id=email_id,
                    filename=attachment["filename"],
                    content_type=attachment["content_type"],
                    size=attachment["size"],
                    storage_path=f"attachments/{email_id}/{attachment['filename']}",
                    metadata={
                        "original_filename": attachment["filename"],
                    },
                )
                
                db_attachment = EmailAttachment(**attachment_data.dict())
                db.add(db_attachment)
                
                # In a production environment, you would save the file to a storage service here
                # e.g., AWS S3, Google Cloud Storage, or a local filesystem
                # For now, we'll just log it
                logger.info(
                    f"Would save attachment {attachment['filename']} "
                    f"({attachment['size']} bytes) to {db_attachment.storage_path}"
                )
                
            except Exception as e:
                logger.error(f"Error processing attachment: {str(e)}", exc_info=True)
        
        await db.commit()
    
    async def _route_email(
        self, db: AsyncSession, email: Email, email_type: EmailType, body: str
    ) -> None:
        """Route email based on its type"""
        try:
            if email_type == EmailType.INFRA_REQUEST:
                await self._handle_infra_request(db, email, body)
            elif email_type == EmailType.UNSUBSCRIBE:
                await self._handle_unsubscribe(db, email)
            else:
                # Default handling for standard emails
                await self._handle_standard_email(db, email)
            
            email.status = EmailStatus.PROCESSED
            
        except Exception as e:
            logger.error(f"Error routing email: {str(e)}", exc_info=True)
            email.status = EmailStatus.FAILED
            email.error = str(e)
        
        email.processed_at = datetime.utcnow()
        db.add(email)
        await db.commit()
    
    async def _handle_infra_request(
        self, db: AsyncSession, email: Email, body: str
    ) -> None:
        """Handle infrastructure request emails"""
        try:
            # Extract request details from email
            request_data = self._parse_infra_request(email.subject, body, email.sender)
            
            # Call the API to create the infrastructure request
            response = await self.api_client.create_infrastructure_request(
                request_data, 
                user_email=email.sender
            )
            
            # Update email with the request ID
            email.metadata = email.metadata or {}
            email.metadata["infra_request_id"] = response.get("id")
            email.metadata["api_response"] = response
            
            # Send confirmation email
            await self._send_confirmation_email(email, response)
            
        except Exception as e:
            logger.error(f"Error processing infrastructure request: {str(e)}", exc_info=True)
            raise
    
    def _parse_infra_request(
        self, subject: str, body: str, sender: str
    ) -> Dict[str, Any]:
        """Parse infrastructure request from email content"""
        # This is a simplified example - in a real app, you might use NLP or more sophisticated parsing
        request_data = {
            "title": subject,
            "description": body,
            "requestor_email": sender,
            "priority": "normal",
            "environment": "development",
            "metadata": {
                "source": "email",
                "original_subject": subject,
            },
        }
        
        # Extract priority from subject/body
        priority_terms = {
            "high": ["urgent", "asap", "high priority", "blocking"],
            "low": ["low priority", "when you can", "not urgent"],
        }
        
        for priority, terms in priority_terms.items():
            if any(term in body.lower() or term in subject.lower() for term in terms):
                request_data["priority"] = priority
                break
        
        # Extract environment if mentioned
        env_terms = {
            "production": ["prod", "production", "live"],
            "staging": ["staging", "pre-prod", "preprod"],
        }
        
        for env, terms in env_terms.items():
            if any(term in body.lower() or term in subject.lower() for term in terms):
                request_data["environment"] = env
                break
        
        return request_data
    
    async def _handle_unsubscribe(self, db: AsyncSession, email: Email) -> None:
        """Handle unsubscribe requests"""
        # In a real app, you would update the user's preferences in your database
        logger.info(f"Processing unsubscribe request from {email.sender}")
        
        # Send confirmation email
        await self._send_unsubscribe_confirmation(email)
    
    async def _handle_standard_email(self, db: AsyncSession, email: Email) -> None:
        """Handle standard emails (forward to appropriate team, etc.)"""
        logger.info(f"Processing standard email from {email.sender}")
        
        # In a real app, you might:
        # 1. Forward to a support ticketing system
        # 2. Notify the appropriate team
        # 3. Send an auto-response
        
        # For now, just log it
        logger.info(f"Received standard email from {email.sender}: {email.subject}")
    
    async def _send_confirmation_email(
        self, email: Email, request_data: Dict[str, Any]
    ) -> None:
        """Send confirmation email for infrastructure request"""
        try:
            template = await self.template_service.get_template("infra_request_confirmation")
            
            # Format template with request data
            context = {
                "request_id": request_data.get("id", ""),
                "title": request_data.get("title", ""),
                "description": request_data.get("description", ""),
                "status": request_data.get("status", "received"),
                "priority": request_data.get("priority", "normal"),
                "environment": request_data.get("environment", "development"),
                "created_at": request_data.get("created_at", datetime.utcnow().isoformat()),
                "user_email": email.sender,
            }
            
            subject, body = self.template_service.render(template, context)
            
            # In a real app, you would use your email sending service here
            logger.info(f"Would send confirmation email to {email.sender} with subject: {subject}")
            
        except Exception as e:
            logger.error(f"Error sending confirmation email: {str(e)}", exc_info=True)
    
    async def _send_unsubscribe_confirmation(self, email: Email) -> None:
        """Send confirmation of unsubscribe request"""
        try:
            template = await self.template_service.get_template("unsubscribe_confirmation")
            
            context = {
                "email": email.sender,
                "unsubscribe_date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            }
            
            subject, body = self.template_service.render(template, context)
            
            # In a real app, you would use your email sending service here
            logger.info(f"Would send unsubscribe confirmation to {email.sender}")
            
        except Exception as e:
            logger.error(f"Error sending unsubscribe confirmation: {str(e)}", exc_info=True)
