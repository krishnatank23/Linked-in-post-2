import os
import smtplib
import base64
import traceback
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email import encoders
from typing import Any
from dotenv import load_dotenv

load_dotenv()

FUNNY_REMINDER_MESSAGES = [
    "Post on LinkedIn today, please. 🚀",
    "Your audience awaits your post today. 🎯",
    "Share your LinkedIn post right now. ⚡",
    "Publish your LinkedIn update today, please. 💼",
    "Your next post needs daylight today. 🌞",
    "Post now and grow your network. 📈",
    "Don't delay your LinkedIn post today. ⏰",
    "Your content deserves to be seen. 👀",
    "Go post before your momentum fades. 🔥",
    "Hit publish on LinkedIn right now. ✅",
    "Your followers are waiting for you. 🤝",
    "Post once and stay top-of-mind. 🧠",
    "Time to post on LinkedIn today. 🕒",
    "Ship your post and spark conversations. 💬",
    "Small post, big professional impact today. 🌟",
    "Post today and thank yourself tomorrow. 🙌",
    "Ready content here, just press publish. 📲",
    "LinkedIn reminder: post it right now. 📣",
    "Stay consistent and share your post. 🔁",
    "One post today boosts your visibility. ✨",
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
) -> bool:
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
        True if sent successfully, False otherwise
    """
    try:
        # Load SERVICE ACCOUNT credentials from .env (admin/noreply account that sends emails)
        sender_email = os.getenv("EMAIL_SENDER", "").strip()
        sender_password = os.getenv("EMAIL_PASSWORD", "").strip()
        smtp_server = os.getenv("EMAIL_SMTP_SERVER", "smtp.office365.com").strip()
        smtp_port = int(os.getenv("EMAIL_SMTP_PORT", "587"))
        
        if not sender_email or not sender_password:
            return False
        
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
        
        return True
    except Exception as e:
        print(f"Email sending error: {str(e)}")
        return False


def _build_email_html(
    posts: list[dict[str, Any]],
    reminder_msg: str
) -> str:
    """Build HTML email content with posts and images."""
    import random
    
    # Short nudges below the main reminder
    fun_facts = [
        "Consistency wins when you post regularly. 🔁",
        "Your voice matters, post today please. 🎤",
        "Visibility grows when you publish consistently. 📈",
        "Show up and share insights today. 💡",
        "Strong careers need visible LinkedIn posts. 💼",
        "Momentum starts with one simple post. ⚡",
        "Keep posting and keep growing daily. 🌱",
        "Your network needs your perspective today. 👥",
        "Publish now and engage faster today. 💬",
    ]
    
    fun_fact = random.choice(fun_facts)
    
    posts_html = ""
    for idx, post in enumerate(posts, 1):
        post_type = post.get("type", "Post")
        content = post.get("content", "").replace("\n", "<br>")
        goal = post.get("goal", "")
        
        # Get image if available
        image_html = ""
        generated_image_b64 = post.get("generated_image_base64", "")
        if generated_image_b64 and generated_image_b64.strip():
            # Embed base64 image directly
            image_html = f'<div style="margin: 15px 0; text-align: center;"><img src="data:image/png;base64,{generated_image_b64}" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #ddd;"></div>'
        else:
            # Try reference images
            ref_images = post.get("reference_images", [])
            if ref_images:
                img_url = ref_images[0].get("image_url", "")
                if img_url:
                    image_html = f'<div style="margin: 15px 0; text-align: center;"><img src="{img_url}" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #ddd;"></div>'
        
        posts_html += f"""
        <div style="margin: 20px 0; padding: 15px; background: linear-gradient(135deg, #f8f9fa 0%, #e8f4f8 100%); border-left: 4px solid #0077b5; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h3 style="color: #0077b5; margin: 0 0 10px 0;">📌 Post #{idx}: {post_type}</h3>
            <div style="line-height: 1.6; color: #333; margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.6); border-radius: 3px;">
                {content}
            </div>
            {image_html}
            <p style="margin: 10px 0; color: #666; font-style: italic;">🎯 Goal: {goal}</p>
        </div>
        """
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f5f5 0%, #e8f4f8 100%); margin: 0; padding: 20px; }}
            .container {{ max-width: 650px; margin: 0 auto; background: white; padding: 35px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,119,181,0.1); border-top: 4px solid #0077b5; }}
            .header {{ text-align: center; margin-bottom: 35px; }}
            .header h1 {{ color: #0077b5; margin: 0; font-size: 32px; letter-spacing: -0.5px; }}
            .header-subtitle {{ color: #666; margin: 8px 0 0 0; font-size: 16px; font-style: italic; }}
            .header-emoji {{ font-size: 40px; margin-bottom: 15px; }}
            .reminder {{ background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); padding: 18px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107; box-shadow: 0 2px 8px rgba(255,193,7,0.2); }}
            .reminder p {{ color: #333; margin: 0; font-weight: 500; font-size: 16px; line-height: 1.5; }}
            .fun-fact {{ background: linear-gradient(135deg, #f0f8ff 0%, #e6f2ff 100%); padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #5dade2; color: #333; font-size: 14px; line-height: 1.6; }}
            .fun-fact p {{ margin: 0; }}
            .posts {{ margin: 25px 0; }}
            .posts-title {{ color: #0077b5; font-size: 18px; font-weight: 600; margin: 20px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e8f4f8; }}
            .cta-button {{ text-align: center; margin: 30px 0; }}
            .cta-button a {{ display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #0077b5 0%, #005a87 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; transition: transform 0.2s; box-shadow: 0 2px 8px rgba(0,119,181,0.3); }}
            .cta-button a:hover {{ transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,119,181,0.4); }}
            .mystery-divider {{ text-align: center; color: #999; margin: 20px 0; font-size: 12px; letter-spacing: 2px; }}
            .footer {{ text-align: center; margin-top: 35px; padding-top: 25px; border-top: 1px solid #ddd; color: #999; font-size: 11px; line-height: 1.8; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-emoji">🚀✨🎯</div>
                <h1>🎯 LinkedIn Post Reminder</h1>
                <p class="header-subtitle">"Your content awaits its destiny..."</p>
            </div>
            
            <div class="mystery-divider">✦ ✦ ✦</div>
            
            <div class="reminder">
                <p>💬 {reminder_msg}</p>
            </div>
            
            <div class="fun-fact">
                <p>{fun_fact}</p>
            </div>
            
            <div class="posts">
                <h2 class="posts-title">🎪 Your Generated Posts:</h2>
                {posts_html}
            </div>
            
            <div class="mystery-divider">✦ ✦ ✦</div>
            
            <div class="cta-button">
                <a href="https://www.linkedin.com" target="_blank">🚀 PUBLISH TO LINKEDIN NOW 🚀</a>
            </div>
            
            <div style="background: #f0f8ff; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; color: #555; font-size: 13px;">
                <p style="margin: 0 0 8px 0;"><strong>💡 Pro Tip:</strong> The best time to post is when your audience is most active!</p>
                <p style="margin: 0;"><strong>⚡ Bonus Tip:</strong> Engage with comments within the first hour = algorithm magic! 🎩✨</p>
            </div>
            
            <div class="footer">
                <p>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                <p><strong>BrandForge AI</strong> - Your Personal LinkedIn Content Studio</p>
                <p>Transforming Profiles into Powerhouses 💪 | One Post at a Time 📝</p>
                <p>© 2026 All rights reserved. Keep crushing it! 🔥</p>
                <p>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                <p style="margin-top: 10px; font-size: 10px; color: #bbb;">
                    <em>This email was generated by AI, but the strategy is all YOU.</em>
                </p>
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
        
        # Send email
        success = _send_email_smtp(
            recipient_email=user_email,
            subject="🚀 Your LinkedIn Posts Are Ready! [BrandForge AI]",
            html_body=html_body,
        )
        
        if not success:
            return {
                "status": "warning",
                "output": {
                    "posts_count": len(posts),
                    "email_sent": False,
                    "message": "Service account credentials not configured. Admin must set EMAIL_SENDER and EMAIL_PASSWORD in .env",
                },
                "error": "SERVICE ACCOUNT: EMAIL_SENDER or EMAIL_PASSWORD not configured in .env (admin config, not user)",
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
