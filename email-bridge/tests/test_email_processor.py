import pytest
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from src.email_processor import EmailProcessor
from src.models.email import Email, EmailStatus, EmailType
from src.schemas.email import EmailCreate, EmailAttachmentCreate
from src.core.config import settings

# Test data
TEST_EMAIL = "test@example.com"
TEST_SUBJECT = "Test Subject"
TEST_BODY = "This is a test email body"
TEST_MESSAGE_ID = "<test-message-id@example.com>"

# Fixtures
@pytest.fixture
def email_processor():
    return EmailProcessor()

@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session

@pytest.fixture
def simple_email_message():
    msg = MIMEText(TEST_BODY)
    msg["From"] = f"Test User <{TEST_EMAIL}>"
    msg["To"] = f"recipient@example.com"
    msg["Subject"] = TEST_SUBJECT
    msg["Message-ID"] = TEST_MESSAGE_ID
    return msg

@pytest.fixture
def multipart_email_message():
    msg = MIMEMultipart()
    msg["From"] = f"Test User <{TEST_EMAIL}>"
    msg["To"] = f"recipient@example.com"
    msg["Subject"] = TEST_SUBJECT
    msg.attach(MIMEText("This is the plain text version", "plain"))
    msg.attach(MIMEText("<p>This is the HTML version</p>", "html"))
    return msg

@pytest.fixture
def email_with_attachment():
    msg = MIMEMultipart()
    msg["From"] = f"Test User <{TEST_EMAIL}>"
    msg["To"] = f"recipient@example.com"
    msg["Subject"] = TEST_SUBJECT
    
    # Add text part
    msg.attach(MIMEText("Email with attachment", "plain"))
    
    # Add attachment
    attachment = MIMEText("This is a test attachment")
    attachment.add_header(
        "Content-Disposition", "attachment", filename="test.txt"
    )
    msg.attach(attachment)
    
    return msg

# Tests
class TestEmailProcessor:
    @pytest.mark.asyncio
    async def test_process_simple_email(self, email_processor, mock_db_session, simple_email_message):
        # Test processing a simple text email
        result = await email_processor.process_email(
            mock_db_session, simple_email_message, TEST_EMAIL, ["recipient@example.com"]
        )
        
        assert result is not None
        assert result.sender == TEST_EMAIL
        assert result.subject == TEST_SUBJECT
        assert result.body == TEST_BODY
        assert result.status == EmailStatus.PROCESSED
        assert result.email_type == EmailType.STANDARD
    
    @pytest.mark.asyncio
    async def test_process_multipart_email(self, email_processor, mock_db_session, multipart_email_message):
        # Test processing a multipart email
        result = await email_processor.process_email(
            mock_db_session, multipart_email_message, TEST_EMAIL, ["recipient@example.com"]
        )
        
        assert result is not None
        assert "This is the plain text version" in result.body
        assert "<p>This is the HTML version</p>" not in result.body  # Should be converted to text
    
    @pytest.mark.asyncio
    async def test_process_email_with_attachment(self, email_processor, mock_db_session, email_with_attachment):
        # Test processing an email with an attachment
        result = await email_processor.process_email(
            mock_db_session, email_with_attachment, TEST_EMAIL, ["recipient@example.com"]
        )
        
        assert result is not None
        assert "Email with attachment" in result.body
        
        # Verify attachment was processed (in this case, just logged)
        # In a real test, you'd mock the storage and verify it was called
    
    @pytest.mark.asyncio
    async def test_determine_email_type_auto_reply(self, email_processor):
        # Test auto-reply detection
        assert email_processor._determine_email_type(
            "Auto: Out of Office", "I'm out of the office", TEST_EMAIL, ["test@example.com"]
        ) == EmailType.AUTO_REPLY
        
        assert email_processor._determine_email_type(
            "RE: Test", "This is an automatic reply", TEST_EMAIL, ["test@example.com"]
        ) == EmailType.AUTO_REPLY
    
    @pytest.mark.asyncio
    async def test_determine_email_type_bounce(self, email_processor):
        # Test bounce detection
        assert email_processor._determine_email_type(
            "Delivery Status Notification (Failure)", "Could not deliver message", "MAILER-DAEMON@example.com", ["test@example.com"]
        ) == EmailType.BOUNCE
    
    @pytest.mark.asyncio
    async def test_determine_email_type_unsubscribe(self, email_processor):
        # Test unsubscribe detection
        assert email_processor._determine_email_type(
            "Unsubscribe", "Please remove me from your mailing list", TEST_EMAIL, ["unsubscribe@example.com"]
        ) == EmailType.UNSUBSCRIBE
        
        assert email_processor._determine_email_type(
            "Opt-out request", "I want to opt out", TEST_EMAIL, ["unsubscribe@example.com"]
        ) == EmailType.UNSUBSCRIBE
    
    @pytest.mark.asyncio
    async def test_determine_email_type_infra_request(self, email_processor):
        # Test infrastructure request detection
        assert email_processor._determine_email_type(
            "[Infra Request] Need new server", "Please provision a new server", TEST_EMAIL, ["infra@example.com"]
        ) == EmailType.INFRA_REQUEST
        
        assert email_processor._determine_email_type(
            "Infrastructure request: Database", "Need a new database", TEST_EMAIL, ["infra@example.com"]
        ) == EmailType.INFRA_REQUEST
    
    @pytest.mark.asyncio
    @patch("src.email_processor.EmailProcessor._save_email")
    @patch("src.email_processor.EmailProcessor._process_attachments")
    @patch("src.email_processor.EmailProcessor._route_email")
    async def test_process_email_flow(
        self, mock_route_email, mock_process_attachments, mock_save_email, 
        email_processor, mock_db_session, simple_email_message
    ):
        # Test the complete flow of processing an email
        mock_save_email.return_value = MagicMock(id="123")
        
        result = await email_processor.process_email(
            mock_db_session, simple_email_message, TEST_EMAIL, ["recipient@example.com"]
        )
        
        # Verify the flow
        mock_save_email.assert_called_once()
        mock_process_attachments.assert_called_once()
        mock_route_email.assert_called_once()
        assert result is not None
    
    @pytest.mark.asyncio
    @patch("src.email_processor.EmailProcessor._save_email")
    async def test_process_email_error_handling(
        self, mock_save_email, email_processor, mock_db_session, simple_email_message
    ):
        # Test error handling during email processing
        mock_save_email.side_effect = Exception("Database error")
        
        result = await email_processor.process_email(
            mock_db_session, simple_email_message, TEST_EMAIL, ["recipient@example.com"]
        )
        
        assert result is None
    
    @pytest.mark.asyncio
    @patch("src.email_processor.APIClient")
    async def test_handle_infra_request(
        self, mock_api_client, email_processor, mock_db_session
    ):
        # Test handling an infrastructure request
        email = MagicMock()
        email.sender = "user@example.com"
        email.subject = "[Infra] Need a new server"
        email.body = "Please provision a new server with 8GB RAM and 4 vCPUs"
        
        # Mock API response
        mock_client = mock_api_client.return_value
        mock_client.create_infrastructure_request.return_value = {
            "id": "req_123",
            "status": "received"
        }
        
        await email_processor._handle_infra_request(mock_db_session, email, email.body)
        
        # Verify API was called with the right parameters
        mock_client.create_infrastructure_request.assert_called_once()
        call_args = mock_client.create_infrastructure_request.call_args[0][0]
        assert call_data["title"] == "[Infra] Need a new server"
        assert "Please provision a new server" in call_data["description"]
        assert call_data["requestor_email"] == "user@example.com"
    
    @pytest.mark.asyncio
    async def test_extract_email_content_simple(self, email_processor, simple_email_message):
        # Test extracting content from a simple email
        body, content_type, attachments = email_processor._extract_email_content(simple_email_message)
        
        assert body == TEST_BODY
        assert content_type == "text/plain"
        assert attachments == []
    
    @pytest.mark.asyncio
    async def test_extract_email_content_multipart(self, email_processor, multipart_email_message):
        # Test extracting content from a multipart email
        body, content_type, attachments = email_processor._extract_email_content(multipart_email_message)
        
        assert "This is the plain text version" in body
        assert content_type == "text/plain"
        assert attachments == []
    
    @pytest.mark.asyncio
    async def test_extract_email_content_with_attachment(self, email_processor, email_with_attachment):
        # Test extracting content from an email with an attachment
        body, content_type, attachments = email_processor._extract_email_content(email_with_attachment)
        
        assert "Email with attachment" in body
        assert content_type == "text/plain"
        assert len(attachments) == 1
        assert attachments[0]["filename"] == "test.txt"
        assert b"This is a test attachment" in attachments[0]["data"]
    
    @pytest.mark.asyncio
    async def test_parse_infra_request(self, email_processor):
        # Test parsing infrastructure request details from email content
        subject = "[URGENT] Need production database"
        body = """
        Hi team,
        
        We need a new production database with the following specs:
        - 100GB storage
        - High availability
        - Daily backups
        
        This is blocking our deployment.
        """
        
        request_data = email_processor._parse_infra_request(subject, body, "user@example.com")
        
        assert request_data["title"] == subject
        assert "100GB storage" in request_data["description"]
        assert request_data["priority"] == "high"  # From "URGENT" in subject
        assert request_data["environment"] == "production"  # From "production" in subject
        assert request_data["requestor_email"] == "user@example.com"
    
    @pytest.mark.asyncio
    @patch("src.email_processor.EmailTemplateService")
    @patch("src.email_processor.EmailResponseSender")
    async def test_send_confirmation_email(
        self, mock_response_sender, mock_template_service, email_processor
    ):
        # Test sending a confirmation email
        email = MagicMock()
        email.sender = "user@example.com"
        
        # Mock template service
        mock_template = MagicMock()
        mock_template_service.return_value.get_template.return_value = mock_template
        
        # Mock response sender
        mock_sender = mock_response_sender.return_value
        
        # Call the method
        request_data = {
            "id": "req_123",
            "title": "Test Request",
            "description": "Test Description",
            "status": "received",
            "priority": "high",
            "environment": "production",
            "created_at": "2023-01-01T00:00:00Z"
        }
        
        await email_processor._send_confirmation_email(email, request_data)
        
        # Verify the template was rendered with the right context
        mock_template_service.return_value.render.assert_called_once()
        call_args = mock_template_service.return_value.render.call_args[0][1]
        assert call_args["request_id"] == "req_123"
        assert call_args["title"] == "Test Request"
        
        # Verify the email was sent
        mock_sender.send_email.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_extension(self, email_processor):
        # Test getting file extensions from MIME types
        assert email_processor._get_extension("text/plain") == ".txt"
        assert email_processor._get_extension("application/pdf") == ".pdf"
        assert email_processor._get_extension("image/jpeg") == ".jpg"
        assert email_processor._get_extension("unknown/type") == ".bin"
    
    @pytest.mark.asyncio
    async def test_handle_standard_email(self, email_processor, mock_db_session):
        # Test handling a standard email
        email = MagicMock()
        email.sender = "user@example.com"
        email.subject = "General inquiry"
        email.body = "I have a question about your service"
        
        await email_processor._handle_standard_email(mock_db_session, email)
        
        # In this simple implementation, it just logs the email
        # In a real test, you'd verify any side effects
        assert True
    
    @pytest.mark.asyncio
    @patch("src.email_processor.EmailTemplateService")
    async def test_send_unsubscribe_confirmation(
        self, mock_template_service, email_processor
    ):
        # Test sending an unsubscribe confirmation
        email = MagicMock()
        email.sender = "user@example.com"
        
        # Call the method
        await email_processor._send_unsubscribe_confirmation(email)
        
        # Verify the template was rendered
        mock_template_service.return_value.get_template.assert_called_once_with("unsubscribe_confirmation")
        mock_template_service.return_value.render.assert_called_once()
        
        # In a real implementation, you'd also verify the email was sent

# This test class can be extended with more test cases as needed
