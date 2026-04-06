import os
import smtplib
import base64
import traceback
import requests
from dotenv import dotenv_values
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email import encoders
from typing import Any
from env_config import load_backend_env

load_backend_env()

FUNNY_REMINDER_MESSAGES = [
    "Your LinkedIn posts are ready for review.",
    "The content generated for your profile is attached.",
    "LinkedIn strategy update: new posts generated.",
    "Your weekly LinkedIn content plan.",
    "Review your scheduled LinkedIn posts.",
]

def _get_funny_reminder() -> str:
    """Get a random funny reminder message."""
    import random
    return random.choice(FUNNY_REMINDER_MESSAGES)


def _send_email_smtp(
    recipient_email: str,
    subject: str,
    html_body: str,
    attachments: list[tuple[str, bytes, str]] = None
) -> tuple[bool, str | None]:
    """
    Send email via Outlook/Office365 SMTP.
    
    IMPORTANT: This uses a SERVICE ACCOUNT configured in .env, NOT the user's personal email.
    The SERVICE ACCOUNT (EMAIL_SENDER/EMAIL_PASSWORD) is an admin/noreply account that sends
    reminders TO the user's registered email (recipient_email).
    
    Architecture:
      EMAIL_SENDER (from .env)     ──sends to──→  recipient_email (user's registered email)
      Service/Admin account                      User from database
      (configured once globally)                 (auto from user registration)
    
    Args:
        recipient_email: User's registered email address (where reminder is sent)
        subject: Email subject
        html_body: HTML formatted email body
        attachments: List of (filename, file_bytes, mime_type) tuples
    
    Returns:
        (True, None) on success, (False, reason) on failure
    """
    try:
        # Always reload latest backend/.env so runtime updates are picked without full process restart.
        load_backend_env()

        def _clean_env_value(raw: str | None) -> str:
            value = (raw or "").strip()
            if len(value) >= 2 and ((value[0] == "'" and value[-1] == "'") or (value[0] == '"' and value[-1] == '"')):
                value = value[1:-1].strip()
            return value

        # Load SERVICE ACCOUNT credentials from .env (admin/noreply account that sends emails)
        sender_email = _clean_env_value(os.getenv("EMAIL_SENDER"))
        sender_password = _clean_env_value(os.getenv("EMAIL_PASSWORD"))
        smtp_server = _clean_env_value(os.getenv("EMAIL_SMTP_SERVER")) or "smtp.office365.com"
        smtp_port_raw = _clean_env_value(os.getenv("EMAIL_SMTP_PORT")) or "587"

        # Fallback read in case process env is stale for any reason.
        if not sender_email or not sender_password:
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            env_path = os.path.join(backend_dir, ".env")
            env_vals = dotenv_values(env_path)
            sender_email = sender_email or _clean_env_value(env_vals.get("EMAIL_SENDER"))
            sender_password = sender_password or _clean_env_value(env_vals.get("EMAIL_PASSWORD"))
            smtp_server = _clean_env_value(env_vals.get("EMAIL_SMTP_SERVER")) or smtp_server
            smtp_port_raw = _clean_env_value(env_vals.get("EMAIL_SMTP_PORT")) or smtp_port_raw

        try:
            smtp_port = int(smtp_port_raw)
        except Exception:
            smtp_port = 587
        
        if not sender_email or not sender_password:
            return False, "EMAIL_SENDER or EMAIL_PASSWORD is missing in backend/.env"
        
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = sender_email
        message["To"] = recipient_email
        
        # Attach HTML body
        html_part = MIMEText(html_body, "html")
        message.attach(html_part)
        
        # Attach files if provided
        if attachments:
            for filename, file_bytes, mime_type in attachments:
                if mime_type.startswith("image/"):
                    # Image attachment
                    img = MIMEImage(file_bytes, _subtype=mime_type.split("/")[1])
                    img.add_header("Content-Disposition", "attachment", filename=filename)
                    message.attach(img)
                else:
                    # Generic attachment
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(file_bytes)
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename= {filename}",
                    )
                    message.attach(part)
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipient_email, message.as_string())
        
        return True, None
    except Exception as e:
        error_text = str(e).strip() or "Unknown SMTP error"
        if "5.7.139" in error_text or "SmtpClientAuthentication is disabled" in error_text:
            error_text = (
                "Outlook SMTP AUTH is disabled for this Microsoft 365 tenant/mailbox. "
                "Enable Authenticated SMTP for the tenant and this mailbox, then retry."
            )
        print(f"Email sending error: {error_text}")
        return False, error_text


def _send_email_graph_app_only(
    recipient_email: str,
    subject: str,
    html_body: str,
) -> tuple[bool, str | None]:
    """Send email using Microsoft Graph with app-only (client credentials) auth."""
    try:
        load_backend_env()

        def _clean_env_value(raw: str | None) -> str:
            value = (raw or "").strip()
            if len(value) >= 2 and ((value[0] == "'" and value[-1] == "'") or (value[0] == '"' and value[-1] == '"')):
                value = value[1:-1].strip()
            return value

        tenant_id = _clean_env_value(os.getenv("GRAPH_TENANT_ID"))
        client_id = _clean_env_value(os.getenv("GRAPH_CLIENT_ID"))
        client_secret = _clean_env_value(os.getenv("GRAPH_CLIENT_SECRET"))
        sender = _clean_env_value(os.getenv("GRAPH_SENDER_EMAIL")) or _clean_env_value(os.getenv("EMAIL_SENDER"))

        if not tenant_id or not client_id or not client_secret or not sender:
            return False, (
                "Microsoft Graph app credentials missing. Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID, "
                "GRAPH_CLIENT_SECRET, and GRAPH_SENDER_EMAIL (or EMAIL_SENDER)."
            )

        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        token_payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }

        token_resp = requests.post(token_url, data=token_payload, timeout=20)
        if token_resp.status_code >= 400:
            return False, f"Graph token request failed: {token_resp.status_code} {token_resp.text[:300]}"

        access_token = token_resp.json().get("access_token")
        if not access_token:
            return False, "Graph token response did not include access_token"

        send_url = f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail"
        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_body,
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": recipient_email,
                        }
                    }
                ],
            },
            "saveToSentItems": "true",
        }

        send_resp = requests.post(
            send_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        if send_resp.status_code >= 400:
            message = send_resp.text[:400]
            if "Access is denied" in message or "Insufficient privileges" in message:
                return False, (
                    "Graph sendMail permission missing. Grant admin consent for Mail.Send (Application) "
                    f"and ensure sender mailbox exists. Graph response: {send_resp.status_code} {message}"
                )
            return False, f"Graph sendMail failed: {send_resp.status_code} {message}"

        return True, None
    except Exception as e:
        return False, f"Graph email error: {str(e)}"


def _build_email_html(
    posts: list[dict[str, Any]],
    reminder_msg: str
) -> str:
    """Build HTML email content with posts and images."""
    posts_html = ""
    for idx, post in enumerate(posts, 1):
        post_type = post.get("type", "Post")
        content = post.get("content", "").replace("\n", "<br>")
        goal = post.get("goal", "")
        
        posts_html += f"""
        <div class="post-box">
            <h3 class="post-title">Post #{idx}: {post_type}</h3>
            <div style="line-height: 1.6; color: #333;">
                {content}
            </div>
            <p style="margin-top: 10px; color: #666; font-size: 13px;">Goal: {goal}</p>
        </div>
        """
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 4px; border: 1px solid #ddd; }}
            .header {{ padding-bottom: 20px; border-bottom: 2px solid #0077b5; }}
            .header h1 {{ color: #333; margin: 0; font-size: 24px; }}
            .posts {{ margin-top: 20px; }}
            .post-box {{ margin-bottom: 20px; padding: 15px; background: #fafafa; border: 1px solid #eee; }}
            .post-title {{ color: #0077b5; margin-top: 0; }}
            .footer {{ margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #777; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>LinkedIn Content Ready</h1>
            </div>
            
            <div class="posts">
                {posts_html}
            </div>
            
            <div class="footer">
                Automated Personal Branding Assistant
            </div>
        </div>
    </body>
    </html>
    """
    
    return html_body


async def run_email_reminder(
    user_email: str,
    post_generation_output: dict[str, Any]
) -> dict[str, Any]:
    """
    Agent 7: Send email reminder with generated posts and images to user's Outlook.
    
    FLOW:
    1. User registers with their email (e.g., john@gmail.com) → stored in database
    2. Admin configures SERVICE ACCOUNT in .env (e.g., noreply@company.com + password)
    3. When pipeline runs, EMAIL REMINDER AGENT:
       - Takes user's registered email from database (john@gmail.com)
       - Uses service account credentials from .env to SEND email
       - Email arrives in user's inbox from service account
    
    User DOES NOT provide credentials - only admin configures .env once!
    
    Args:
        user_email: User's registered email address (from database, auto-passed from registration)
        post_generation_output: Output from post generation agent containing posts
    
    Returns:
        Agent result dict with status, output, and error
    """
    try:
        if not user_email or not user_email.strip():
            return {
                "status": "error",
                "output": None,
                "error": "No user email provided",
            }
        
        posts = post_generation_output.get("posts", [])
        if not posts:
            return {
                "status": "error",
                "output": None,
                "error": "No posts to send",
            }
        
        # Get funny reminder message
        reminder_msg = _get_funny_reminder()
        
        # Build HTML email
        html_body = _build_email_html(posts, reminder_msg)
        
        # Prefer Microsoft Graph app-only (no mailbox password). Fall back to SMTP if Graph isn't configured.
        success, send_error = _send_email_graph_app_only(
            recipient_email=user_email,
            subject="Your LinkedIn Posts Are Ready [BrandForge AI]",
            html_body=html_body,
        )

        if not success and "Microsoft Graph app credentials missing" in (send_error or ""):
            success, send_error = _send_email_smtp(
                recipient_email=user_email,
                subject="Your LinkedIn Posts Are Ready [BrandForge AI]",
                html_body=html_body,
            )
        
        if not success:
            return {
                "status": "warning",
                "output": {
                    "posts_count": len(posts),
                    "email_sent": False,
                    "message": f"Email delivery failed: {send_error}",
                },
                "error": f"Email delivery failed: {send_error}",
            }
        
        return {
            "status": "success",
            "output": {
                "posts_count": len(posts),
                "email_sent": True,
                "recipient": user_email,
                "reminder_message": reminder_msg,
                "message": f"Reminder email sent successfully to {user_email}",
            },
            "error": None,
        }
    except Exception as e:
        return {
            "status": "error",
            "output": None,
            "error": f"Email reminder failed: {str(e)}\n{traceback.format_exc()}",
        }
