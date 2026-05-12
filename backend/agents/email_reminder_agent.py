import os
import smtplib
import traceback
from typing import Any

import requests
from dotenv import dotenv_values
from email import encoders
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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


def _clean_env_value(raw: str | None) -> str:
    value = (raw or "").strip()
    if len(value) >= 2 and ((value[0] == "'" and value[-1] == "'") or (value[0] == '"' and value[-1] == '"')):
        value = value[1:-1].strip()
    return value


def _send_email_smtp(
    recipient_email: str,
    subject: str,
    html_body: str,
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> tuple[bool, str | None]:
    """Send email via Outlook/Office365 SMTP."""
    try:
        load_backend_env()

        sender_email = _clean_env_value(os.getenv("EMAIL_SENDER"))
        sender_password = _clean_env_value(os.getenv("EMAIL_PASSWORD"))
        smtp_server = _clean_env_value(os.getenv("EMAIL_SMTP_SERVER")) or "smtp.office365.com"
        smtp_port_raw = _clean_env_value(os.getenv("EMAIL_SMTP_PORT")) or "587"

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

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = sender_email
        message["To"] = recipient_email
        message.attach(MIMEText(html_body, "html"))

        if attachments:
            for filename, file_bytes, mime_type in attachments:
                if mime_type.startswith("image/"):
                    img = MIMEImage(file_bytes, _subtype=mime_type.split("/")[1])
                    img.add_header("Content-Disposition", "attachment", filename=filename)
                    message.attach(img)
                else:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(file_bytes)
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", f"attachment; filename= {filename}")
                    message.attach(part)

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
    """Send email using Microsoft Graph with app-only auth."""
    try:
        load_backend_env()

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


def _build_email_html(posts: list[dict[str, Any]], reminder_msg: str) -> str:
    """Build HTML email content for legacy post output."""
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

    return f"""
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
                <p>{reminder_msg}</p>
            </div>
            <div class="posts">{posts_html}</div>
            <div class="footer">Automated Personal Branding Assistant</div>
        </div>
    </body>
    </html>
    """


def _build_prompt_email_html(prompt_output: dict[str, Any], reminder_msg: str) -> str:
    """Build HTML email content for the generated meta-prompt."""
    user_domain = prompt_output.get("user_domain", "Your Domain")
    posting_frequency = prompt_output.get("posting_frequency", "N/A")
    posting_schedule_days = prompt_output.get("posting_schedule_days", [])
    posting_time_utc = prompt_output.get("posting_time_utc", "N/A")
    main_prompt = prompt_output.get("post_generation_prompt", "")
    suggested_topics = prompt_output.get("suggested_post_topics", [])
    domain_trends = prompt_output.get("current_domain_trends", [])
    dos_and_donts = prompt_output.get("dos_and_donts", {})
    engagement_triggers = prompt_output.get("engagement_triggers", [])

    schedule_text = ", ".join(posting_schedule_days) if isinstance(posting_schedule_days, list) and posting_schedule_days else "N/A"

    def list_items(values: Any, color: str = "#333") -> str:
        if not isinstance(values, list):
            return ""
        return "".join(f"<li style='margin: 8px 0; color: {color};'>{item}</li>" for item in values if item)

    dos_list = []
    donts_list = []
    if isinstance(dos_and_donts, dict):
        dos_list = dos_and_donts.get("do", []) or dos_and_donts.get("dos", []) or []
        donts_list = dos_and_donts.get("don't", []) or dos_and_donts.get("donts", []) or []

    return f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }}
            .container {{ max-width: 720px; margin: 0 auto; background: white; padding: 28px; border-radius: 8px; border: 1px solid #ddd; }}
            .header {{ padding-bottom: 18px; border-bottom: 3px solid #0077b5; }}
            .header h1 {{ color: #0077b5; margin: 0; font-size: 26px; }}
            .header p {{ color: #666; margin: 8px 0 0 0; font-size: 14px; }}
            .section {{ margin-top: 24px; }}
            .section-title {{ color: #0077b5; font-size: 18px; font-weight: bold; margin-bottom: 10px; }}
            .stat-box {{ display: inline-block; background: #ecf0f1; padding: 12px 16px; margin: 6px 6px 0 0; border-radius: 6px; }}
            .stat-label {{ color: #7f8c8d; font-size: 12px; }}
            .stat-value {{ color: #0077b5; font-size: 16px; font-weight: bold; }}
            .prompt-box {{ background: #f8f9fa; padding: 16px; border-left: 4px solid #0077b5; border-radius: 6px; line-height: 1.6; color: #333; white-space: pre-wrap; word-wrap: break-word; }}
            .list-box {{ background: #fafafa; padding: 12px 16px; border-radius: 6px; }}
            .dos-donts {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
            .dos-column, .donts-column {{ padding: 12px; border-radius: 6px; }}
            .dos-column {{ background: #f0fdf4; border: 1px solid #86efac; }}
            .donts-column {{ background: #fef2f2; border: 1px solid #fca5a5; }}
            .footer {{ margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 12px; color: #777; }}
            .reminder {{ background: #fff3cd; padding: 12px; border-radius: 6px; margin-top: 10px; color: #856404; font-size: 13px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Your LinkedIn Post Generation Prompt</h1>
                <p>{reminder_msg}</p>
            </div>

            <div class="section">
                <div class="section-title">Posting Strategy</div>
                <div class="stat-box"><div class="stat-label">Domain</div><div class="stat-value">{user_domain}</div></div>
            </div>

            <div class="section">
                <div class="section-title">Post Generation Prompt</div>
                <div class="prompt-box">{main_prompt}</div>
            </div>

            <div class="section">
                <div class="section-title">Suggested Topics</div>
                <div class="list-box"><ul>{list_items(suggested_topics)}</ul></div>
            </div>

            <div class="section">
                <div class="section-title">Current Domain Trends</div>
                <div class="list-box"><ul>{list_items(domain_trends)}</ul></div>
            </div>

            <div class="section">
                <div class="section-title">Engagement Triggers</div>
                <div class="list-box"><ul>{list_items(engagement_triggers)}</ul></div>
            </div>

            <div class="reminder">
                Copy this prompt into ChatGPT, Claude, or your preferred AI to generate posts that match your voice and strategy.
            </div>

            <div class="footer">BrandForge AI • Your LinkedIn Content Strategy Partner</div>
        </div>
    </body>
    </html>
    """


async def run_email_reminder(user_email: str, post_generation_output: dict[str, Any]) -> dict[str, Any]:
    """Send either generated posts or the new generated prompt to the user's email."""
    try:
        if not user_email or not user_email.strip():
            return {
                "status": "error",
                "output": None,
                "error": "No user email provided",
            }

        generation_type = post_generation_output.get("generation_type", "posts")
        is_meta_prompt = generation_type == "meta_prompt"
        reminder_msg = _get_funny_reminder()

        if is_meta_prompt:
            prompt_output = post_generation_output
            if not prompt_output.get("post_generation_prompt"):
                return {
                    "status": "error",
                    "output": None,
                    "error": "No generated prompt found",
                }

            html_body = _build_prompt_email_html(prompt_output, reminder_msg)
            email_subject = "Your LinkedIn Post Generation Prompt [BrandForge AI]"
            result_output: dict[str, Any] = {
                "prompt_sent": True,
                "email_sent": True,
                "recipient": user_email,
                "domain": prompt_output.get("user_domain", "Unknown"),
                "posting_frequency": prompt_output.get("posting_frequency", "N/A"),
                "posting_schedule_days": prompt_output.get("posting_schedule_days", []),
                "reminder_message": reminder_msg,
                "message": f"Prompt email sent successfully to {user_email}",
            }
        else:
            posts = post_generation_output.get("posts", [])
            if not posts:
                return {
                    "status": "error",
                    "output": None,
                    "error": "No posts to send",
                }

            html_body = _build_email_html(posts, reminder_msg)
            email_subject = "Your LinkedIn Posts Are Ready [BrandForge AI]"
            result_output = {
                "posts_count": len(posts),
                "email_sent": True,
                "recipient": user_email,
                "reminder_message": reminder_msg,
                "message": f"Reminder email sent successfully to {user_email}",
            }

        success, send_error = _send_email_graph_app_only(
            recipient_email=user_email,
            subject=email_subject,
            html_body=html_body,
        )

        if not success and "Microsoft Graph app credentials missing" in (send_error or ""):
            success, send_error = _send_email_smtp(
                recipient_email=user_email,
                subject=email_subject,
                html_body=html_body,
            )

        if not success:
            result_output["email_sent"] = False
            result_output["message"] = f"Email delivery failed: {send_error}"
            return {
                "status": "warning",
                "output": result_output,
                "error": f"Email delivery failed: {send_error}",
            }

        return {
            "status": "success",
            "output": result_output,
            "error": None,
        }
    except Exception as e:
        return {
            "status": "error",
            "output": None,
            "error": f"Email reminder failed: {str(e)}\n{traceback.format_exc()}",
        }
