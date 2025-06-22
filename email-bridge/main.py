# !/usr/bin/env python3
"""
Text2IaC Email Bridge - Monitors email and converts to infrastructure requests
"""

import os
import sys
import time
import json
import logging
import imaplib
import smtplib
import email
import requests
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/email_bridge.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('email_bridge')


@dataclass
class EmailConfig:
    """Email configuration settings"""
    imap_host: str
    smtp_host: str
    email_user: str
    email_pass: str
    api_url: str
    check_interval: int = 30

    @classmethod
    def from_env(cls) -> 'EmailConfig':
        """Create config from environment variables"""
        return cls(
            imap_host=os.getenv('IMAP_HOST', ''),
            smtp_host=os.getenv('SMTP_HOST', ''),
            email_user=os.getenv('EMAIL_USER', ''),
            email_pass=os.getenv('EMAIL_PASS', ''),
            api_url=os.getenv('TEXT2IAC_API_URL', 'http://localhost:3001'),
            check_interval=int(os.getenv('CHECK_INTERVAL', '30'))
        )


@dataclass
class InfrastructureRequest:
    """Parsed infrastructure request from email"""
    sender: str
    subject: str
    description: str
    environment: Optional[str] = None
    priority: Optional[str] = None
    requestor: Optional[str] = None
    timestamp: Optional[str] = None


class EmailBridge:
    """Main email bridge service"""

    def __init__(self, config: EmailConfig):
        self.config = config
        self.running = False
        self.last_check_time = None

        # Validate configuration
        if not all([config.imap_host, config.smtp_host, config.email_user, config.email_pass]):
            logger.warning("Email configuration incomplete. Email bridge will not start.")
            return

        logger.info(f"Email bridge initialized for {config.email_user}")

    def start(self) -> None:
        """Start monitoring emails"""
        if not self._is_configured():
            logger.error("Email not configured. Skipping email monitoring.")
            return

        logger.info("Starting email bridge monitoring...")
        self.running = True

        while self.running:
            try:
                self._check_emails()
                time.sleep(self.config.check_interval)
            except KeyboardInterrupt:
                logger.info("Received interrupt signal")
                break
            except Exception as e:
                logger.error(f"Error in email monitoring loop: {e}")
                time.sleep(60)  # Wait longer on error

        logger.info("Email bridge stopped")

    def stop(self) -> None:
        """Stop monitoring emails"""
        self.running = False

    def _is_configured(self) -> bool:
        """Check if email is properly configured"""
        return all([
            self.config.imap_host,
            self.config.smtp_host,
            self.config.email_user,
            self.config.email_pass
        ])

    def _check_emails(self) -> None:
        """Check for new emails and process infrastructure requests"""
        try:
            # Connect to IMAP server
            with imaplib.IMAP4_SSL(self.config.imap_host) as mail:
                mail.login(self.config.email_user, self.config.email_pass)
                mail.select('inbox')

                # Search for unread emails with TEXT2IAC in subject
                search_criteria = 'UNSEEN SUBJECT "[TEXT2IAC]"'
                status, messages = mail.search(None, search_criteria)

                if status != 'OK':
                    logger.warning(f"IMAP search failed: {status}")
                    return

                message_ids = messages[0].split()

                if not message_ids:
                    logger.debug("No new TEXT2IAC emails found")
                    return

                logger.info(f"Found {len(message_ids)} new TEXT2IAC emails")

                # Process each email
                for msg_id in message_ids:
                    try:
                        self._process_email(mail, msg_id)
                    except Exception as e:
                        logger.error(f"Error processing email {msg_id}: {e}")

        except Exception as e:
            logger.error(f"Error checking emails: {e}")

    def _process_email(self, mail: imaplib.IMAP4_SSL, msg_id: bytes) -> None:
        """Process a single email message"""
        try:
            # Fetch email message
            status, msg_data = mail.fetch(msg_id, '(RFC822)')
            if status != 'OK':
                logger.error(f"Failed to fetch email {msg_id}")
                return

            email_msg = email.message_from_bytes(msg_data[0][1])

            # Parse email into infrastructure request
            request = self._parse_email(email_msg)
            if not request:
                logger.warning(f"Failed to parse email from {email_msg['From']}")
                return

            logger.info(f"Processing infrastructure request from {request.sender}")

            # Send to Text2IaC API
            response = self._send_to_api(request)

            if response:
                # Send success response
                self._send_success_response(request, response)
                logger.info(f"Successfully processed request from {request.sender}")
            else:
                # Send error response
                self._send_error_response(request, "Failed to process infrastructure request")
                logger.error(f"Failed to process request from {request.sender}")

        except Exception as e:
            logger.error(f"Error processing email {msg_id}: {e}")

    def _parse_email(self, email_msg: email.message.EmailMessage) -> Optional[InfrastructureRequest]:
        """Parse email message into infrastructure request"""
        try:
            sender = email_msg['From']
            subject = email_msg['Subject'] or ''

            # Extract email body
            body = self._extract_email_body(email_msg)
            if not body:
                logger.warning(f"Empty email body from {sender}")
                return None

            # Parse environment and priority from email
            environment = self._extract_field(body, r'environment:\s*(\w+)', 'development')
            priority = self._extract_field(body, r'priority:\s*(\w+)', 'medium')

            # Clean up description (remove metadata fields)
            description = self._clean_description(body)

            return InfrastructureRequest(
                sender=sender,
                subject=subject,
                description=description,
                environment=environment,
                priority=priority,
                requestor=sender,
                timestamp=datetime.now().isoformat()
            )

        except Exception as e:
            logger.error(f"Error parsing email: {e}")
            return None

    def _extract_email_body(self, email_msg: email.message.EmailMessage) -> str:
        """Extract text body from email message"""
        body = ""

        if email_msg.is_multipart():
            for part in email_msg.walk():
                if part.get_content_type() == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        body += payload.decode('utf-8', errors='ignore')
        else:
            payload = email_msg.get_payload(decode=True)
            if payload:
                body = payload.decode('utf-8', errors='ignore')

        return body.strip()

    def _extract_field(self, text: str, pattern: str, default: str) -> str:
        """Extract field value using regex pattern"""
        match = re.search(pattern, text, re.IGNORECASE)
        return match.group(1).lower() if match else default

    def _clean_description(self, body: str) -> str:
        """Clean description by removing metadata fields"""
        # Remove common metadata patterns
        patterns = [
            r'environment:\s*\w+',
            r'priority:\s*\w+',
            r'requestor:\s*[\w@.-]+',
            r'timeline:\s*[^\n]+',
            r'expected\s+traffic:\s*[^\n]+',
        ]

        cleaned = body
        for pattern in patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

        # Clean up whitespace
        cleaned = re.sub(r'\n\s*\n', '\n\n', cleaned)
        return cleaned.strip()

    def _send_to_api(self, request: InfrastructureRequest) -> Optional[Dict]:
        """Send infrastructure request to Text2IaC API"""
        try:
            api_endpoint = f"{self.config.api_url}/api/generate"

            payload = {
                "description": request.description,
                "environment": request.environment,
                "priority": request.priority,
                "requestor": request.requestor,
                "source": "email",
                "metadata": {
                    "subject": request.subject,
                    "timestamp": request.timestamp
                }
            }

            headers = {
                'Content-Type': 'application/json',
                'X-API-Key': os.getenv('API_KEY', 'dev-api-key'),
                'User-Agent': 'Text2IaC-Email-Bridge/1.0'
            }

            logger.info(f"Sending request to API: {api_endpoint}")

            response = requests.post(
                api_endpoint,
                json=payload,
                headers=headers,
                timeout=30
            )

            if response.status_code in [200, 202]:
                return response.json()
            else:
                logger.error(f"API request failed: {response.status_code} - {response.text}")
                return None

        except requests.exceptions.Timeout:
            logger.error("API request timed out")
            return None
        except requests.exceptions.ConnectionError:
            logger.error("Failed to connect to API")
            return None
        except Exception as e:
            logger.error(f"Error sending request to API: {e}")
            return None

    def _send_success_response(self, request: InfrastructureRequest, api_response: Dict) -> None:
        """Send success email response"""
        try:
            # Create response email
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"✅ Infrastructure Request Processed: {api_response.get('name', 'Service')}"
            msg['From'] = self.config.email_user
            msg['To'] = request.sender

            # Create email content
            text_content = self._create_success_text(request, api_response)
            html_content = self._create_success_html(request, api_response)

            # Attach both text and HTML versions
            text_part = MIMEText(text_content, 'plain')
            html_part = MIMEText(html_content, 'html')

            msg.attach(text_part)
            msg.attach(html_part)

            # Send email
            self._send_email(msg)

        except Exception as e:
            logger.error(f"Error sending success response: {e}")

    def _send_error_response(self, request: InfrastructureRequest, error_message: str) -> None:
        """Send error email response"""
        try:
            msg = MIMEText(f"""
❌ Infrastructure Request Failed

Hello,

Your infrastructure request could not be processed due to the following error:

{error_message}

Original Request:
Subject: {request.subject}
Description: {request.description[:200]}...

Please check your request format and try again.

Example format:
Subject: [TEXT2IAC] My Service Name

Create a Node.js API with:
- PostgreSQL database
- Redis cache
- Monitoring setup
- Auto-scaling

Environment: production
Priority: high

---
Text2IaC Automation System
Support: support@company.com
""")

            msg['Subject'] = "❌ Infrastructure Request Error"
            msg['From'] = self.config.email_user
            msg['To'] = request.sender

            self._send_email(msg)

        except Exception as e:
            logger.error(f"Error sending error response: {e}")

    def _create_success_text(self, request: InfrastructureRequest, api_response: Dict) -> str:
        """Create plain text success response"""
        return f"""
✅ Infrastructure Request Processed Successfully!

Hello,

Your infrastructure request has been processed and is being deployed.

Service Details:
• Name: {api_response.get('name', 'Generated Service')}
• Status: {api_response.get('status', 'Processing')}
• Environment: {api_response.get('environment', 'development')}
• Request ID: {api_response.get('requestId', 'N/A')}

⏱️ ETA: {api_response.get('eta', '15 minutes')}

🔗 Track Progress:
• Status Page: {api_response.get('urls', {}).get('backstage_url', 'N/A')}
• Deployment: {api_response.get('urls', {}).get('argocd_url', 'N/A')}
• Monitoring: {api_response.get('urls', {}).get('grafana_url', 'N/A')}

Generated Components:
{chr(10).join('• ' + comp for comp in api_response.get('components', []))}

Next Steps:
{chr(10).join('• ' + step for step in api_response.get('next_steps', []))}

---
Text2IaC Automation System
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    def _create_success_html(self, request: InfrastructureRequest, api_response: Dict) -> str:
        """Create HTML success response"""
        components_html = ''.join(f'<li>{comp}</li>' for comp in api_response.get('components', []))
        next_steps_html = ''.join(f'<li>{step}</li>' for step in api_response.get('next_steps', []))

        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Infrastructure Request Processed</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #27ae60; color: white; padding: 20px; text-align: center; }}
        .content {{ background: #f9f9f9; padding: 20px; }}
        .links {{ background: #3498db; color: white; padding: 15px; }}
        .links a {{ color: white; text-decoration: none; }}
        .footer {{ background: #34495e; color: white; padding: 10px; text-align: center; font-size: 12px; }}
        ul {{ padding-left: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Infrastructure Request Processed!</h1>
        </div>

        <div class="content">
            <h2>Service Details</h2>
            <ul>
                <li><strong>Name:</strong> {api_response.get('name', 'Generated Service')}</li>
                <li><strong>Status:</strong> {api_response.get('status', 'Processing')}</li>
                <li><strong>Environment:</strong> {api_response.get('environment', 'development')}</li>
                <li><strong>Request ID:</strong> {api_response.get('requestId', 'N/A')}</li>
            </ul>

            <h2>⏱️ ETA: {api_response.get('eta', '15 minutes')}</h2>

            <h2>Generated Components</h2>
            <ul>{components_html}</ul>

            <h2>Next Steps</h2>
            <ol>{next_steps_html}</ol>
        </div>

        <div class="links">
            <h3>🔗 Track Progress</h3>
            <p>
                <a href="{api_response.get('urls', {}).get('backstage_url', '#')}">📊 Status Page</a> |
                <a href="{api_response.get('urls', {}).get('argocd_url', '#')}">⚡ Deployment</a> |
                <a href="{api_response.get('urls', {}).get('grafana_url', '#')}">📈 Monitoring</a>
            </p>
        </div>

        <div class="footer">
            Text2IaC Automation System<br>
            Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>
"""

    def _send_email(self, msg: MIMEText) -> None:
        """Send email via SMTP"""
        try:
            with smtplib.SMTP(self.config.smtp_host, 587) as server:
                server.starttls()
                server.login(self.config.email_user, self.config.email_pass)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {msg['To']}")

        except Exception as e:
            logger.error(f"Error sending email: {e}")


def health_check() -> Dict:
    """Simple health check endpoint"""
    return {
        "status": "healthy",
        "service": "text2iac-email-bridge",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }


def main():
    """Main entry point"""
    logger.info("Starting Text2IaC Email Bridge...")

    # Load configuration
    config = EmailConfig.from_env()

    # Create and start email bridge
    bridge = EmailBridge(config)

    try:
        bridge.start()
    except KeyboardInterrupt:
        logger.info("Shutting down email bridge...")
        bridge.stop()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
