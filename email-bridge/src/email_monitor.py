import asyncio
import email
import logging
import aiosmtpd
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP, AuthResult, LoginPassword
from email.message import EmailMessage
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path

from ..core.config import settings
from .email_processor import EmailProcessor
from ..db.session import async_session

logger = logging.getLogger(__name__)

class EmailAuthChecker:
    """Handle SMTP authentication"""
    
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
    
    async def __call__(self, server: SMTP, session, envelope, mechanism, auth_data):
        if not (auth_data and hasattr(auth_data, 'login') and hasattr(auth_data, 'password')):
            return AuthResult(success=False, handled=False)
        
        username = auth_data.login.decode()
        password = auth_data.password.decode()
        
        if username == self.username and password == self.password:
            return AuthResult(success=True)
        
        logger.warning(f"Failed authentication attempt for user: {username}")
        return AuthResult(success=False, handled=True, message="535 Invalid credentials")

class EmailHandler:
    """Handle incoming emails"""
    
    def __init__(self):
        self.processor = EmailProcessor()
    
    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        if not address.endswith(f"@{settings.EMAIL_DOMAIN}"):
            return '550 Not relaying to that domain'
        envelope.rcpt_tos.append(address)
        return '250 OK'
    
    async def handle_DATA(self, server, session, envelope):
        try:
            # Parse the email
            msg = email.message_from_bytes(envelope.original_content, _class=EmailMessage)
            
            # Log basic info
            logger.info(
                f"Received email from {envelope.mail_from} to {envelope.rcpt_tos}"
                f" with subject: {msg.get('subject', 'No Subject')}"
            )
            
            # Process the email asynchronously
            async with async_session() as db:
                await self.processor.process_email(db, msg, envelope.mail_from, envelope.rcpt_tos)
            
            return '250 Message accepted for delivery'
            
        except Exception as e:
            logger.error(f"Error processing email: {str(e)}", exc_info=True)
            return '451 Requested action aborted: local error in processing'

class EmailMonitor:
    """Monitor and process incoming emails"""
    
    def __init__(self):
        self.controller: Optional[Controller] = None
        self.handler = EmailHandler()
        self.auth = EmailAuthChecker(
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD
        )
    
    async def start(self):
        """Start the email monitoring service"""
        logger.info("Starting email monitor...")
        
        # Create the controller with authentication
        self.controller = Controller(
            self.handler,
            hostname=settings.SMTP_LISTEN_ADDRESS,
            port=settings.SMTP_PORT,
            authenticator=self.auth,
            auth_required=True,
            auth_require_tls=False,
            decode_data=True,
        )
        
        # Start the server
        self.controller.start()
        logger.info(f"Email monitor started on {settings.SMTP_LISTEN_ADDRESS}:{settings.SMTP_PORT}")
    
    async def stop(self):
        """Stop the email monitoring service"""
        if self.controller:
            logger.info("Stopping email monitor...")
            self.controller.stop()
            logger.info("Email monitor stopped")
    
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()

async def start_email_monitor():
    """Start the email monitoring service"""
    monitor = EmailMonitor()
    await monitor.start()
    
    try:
        # Keep the service running
        while True:
            await asyncio.sleep(3600)  # Sleep for an hour
    except asyncio.CancelledError:
        logger.info("Shutting down email monitor...")
        await monitor.stop()
    except Exception as e:
        logger.error(f"Error in email monitor: {str(e)}", exc_info=True)
        await monitor.stop()
        raise
