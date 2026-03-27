# 📧 Email Reminder Agent - Setup Guide

## ⚡ Quick Answer: "Why Do I Need Email Credentials?"

**You don't!** Only the admin who owns the system needs to set up credentials ONCE.

### Architecture:

```
REGULAR USER:
  ✅ Registers with email: john@gmail.com
  ✅ Signs in
  ✅ Generates LinkedIn posts
  ✅ Receives reminder in their inbox
  ❌ Never provides password
  ❌ Never configures anything

ADMIN/SYSTEM OWNER:
  ✅ Sets up SERVICE ACCOUNT in .env (once)
  ✅ Example: noreply@company.com + password
  ✅ All users' reminders are sent from this account
  ✅ Only admin needs to know these credentials
```

### Email Flow:

```
┌─────────────────────────────────────────────────────────────┐
│ User Registration                                             │
├─────────────────────────────────────────────────────────────┤
│ Username: john                                                │
│ Email: john@gmail.com  ← stored in database                  │
│ Password: ••••••••     ← hashed, NOT used for email          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Pipeline Runs (No User Action Needed)                        │
├─────────────────────────────────────────────────────────────┤
│ Agent 7: Email Reminder                                       │
│   - Reads user email from database: john@gmail.com           │
│   - Reads service account from .env: noreply@company.com     │
│   - Sends email FROM noreply@company.com TO john@gmail.com   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ John's Inbox                                                  │
├─────────────────────────────────────────────────────────────┤
│ From: noreply@company.com                                     │
│ To: john@gmail.com                                            │
│ Subject: 🚀 Your LinkedIn Posts Are Ready!                    │
│ [Posts + Images + Funny Reminder]                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Point:** User's email (john@gmail.com) comes from registration database. Service account credentials (noreply credentials) are configured once in .env by admin.

---

## The Confusion (Explained)

### ❌ Wrong Understanding:
> "Why do you need my email and password to send me a reminder?"

You don't. We need a **service** account, not your personal account.

### ✅ Right Understanding:
> "Admin sets up a service account (noreply@company.com) to send reminders to all users' registered emails."

This way:
- Users never provide credentials
- All reminders come from the same official account
- Credentials can be changed without affecting users
- More secure than using personal email accounts

---

## Setup (Admin Only)

### Option 1: Use Your Outlook as Service Account (Easiest)

If you're self-hosting or it's a single-user system:

```env
# backend/.env
EMAIL_SENDER=your-outlook@outlook.com
EMAIL_PASSWORD=your-app-password
EMAIL_SMTP_SERVER=smtp.office365.com
EMAIL_SMTP_PORT=587
```

### Option 2: Create a Separate Service Account (Recommended)

Create a new Outlook account specifically for sending:

1. Go to [outlook.office.com](https://outlook.office.com)
2. Click "Create free account"
3. Create noreply-like email: `yourapp-reminders@outlook.com`
4. Set a strong password
5. Enable 2FA and create App Password (see below)
6. Use THOSE credentials in .env:

```env
EMAIL_SENDER=yourapp-reminders@outlook.com
EMAIL_PASSWORD=16-char-app-password
EMAIL_SMTP_SERVER=smtp.office365.com
EMAIL_SMTP_PORT=587
```

**Benefits:**
- Users see "Professional Reminders" not your personal email
- Easy to disable/suspend if needed
- Clear separation of concerns

### Option 3: Company Email (Enterprise)

If using corporate Outlook:

```env
EMAIL_SENDER=noreply@yourcompany.com
EMAIL_PASSWORD=corporate-app-password
```

Ask your IT department for:
- A noreply/system account,password
- App password if 2FA enabled

---

## Getting the App Password (Office365/2FA)

### Step 1: Enable 2-Factor Authentication

1. Go to [account.microsoft.com/security](https://account.microsoft.com/security)
2. Click "Security settings"
3. Enable "Two-step verification"

### Step 2: Generate App Password

1. Return to [account.microsoft.com/security](https://account.microsoft.com/security)
2. Find "App passwords" (only appears if 2FA is enabled)
3. Select "Mail" and "Windows"
4. Microsoft generates a 16-character password
5. Copy and paste into `.env`:

```env
EMAIL_PASSWORD=abcd1234efgh5678
```

---

## Testing

After configuring `backend/.env`:

```bash
cd backend
python run_full_pipeline.py
```

Check your inbox (or the user's inbox if testing with different email):

- **From:** Service account (EMAIL_SENDER)
- **To:** User's registered email
- **Subject:** 🚀 Your LinkedIn Posts Are Ready!
- **Content:** Posts + Images + Funny Reminder

---

## Frontend User Experience

### Users See:
- Register → Enter their email
- Sign in
- Generate posts
- Agent 7 sends reminder to their inbox
- ✅ No credentials needed

### Admin Sees:
- .env configured with service account
- All user reminders sent from that account
- Full visibility and control

---

## Troubleshooting

### "Email credentials not configured"

**Means:** `EMAIL_SENDER` or `EMAIL_PASSWORD` missing in `.env`

**Fix:** 
1. Create service account (Outlook: yourapp@outlook.com)
2. Generate App Password
3. Add to `.env`

### Email Not Arriving

1. ✅ Check EMAIL_SENDER and EMAIL_PASSWORD are correct
2. ✅ Verify service account SMTP is enabled
3. ✅ Check user's spam folder
4. ✅ Check that user's registration email is correct
5. ✅ Verify SMTP server: `smtp.office365.com:587`

### "Authentication failed"

1. ✅ Ensure app password (not account password) if using 2FA
2. ✅ Copy the 16-char password exactly (spaces matter)
3. ✅ Account isn't locked - test login at outlook.office.com first

---

## Security Best Practices

🔒 **Never:**
- Commit `.env` to git (already in .gitignore)
- Use personal account credentials
- Share credentials in messages/emails

🔓 **Do:**
- Create dedicated service account for sending
- Use App Passwords (more secure than account password)
- Rotate credentials periodically
- Use environment variables in production (Azure Key Vault, etc.)

---

## Architecture Summary

| Component | Owner | Purpose | Security |
|-----------|-------|---------|----------|
| User email | User (stored in DB) | WHERE reminder is sent | No credentials exposed |
| Service account | Admin (in .env) | WHO sends reminder | Credentials secured in .env |
| SMTP server | Outlook | HOW email is sent | TLS/SSL encrypted |

---

## For Users (What They See)

Users never need to do anything except provide their email during registration:

1. ✅ Register: `john@gmail.com`
2. ✅ Sign in
3. ✅ Generate LinkedIn posts
4. ✅ Pipeline runs → reminder email to `john@gmail.com`
5. ✅ Check inbox for "Your LinkedIn Posts Are Ready!"

No passwords. No configuration. No credentials. **Ever.**

---

## Questions?

- **"Why a service account?"** → Keep user credentials private
- **"Can I use my email?"** → Yes, if it's a personal app
- **"Is this secure?"** → Yes, credentials are in `.env` which is not committed
- **"What if credentials leak?"** → Easy to revoke/change just the service account

For detailed security setup, see `.env` configuration comments.


## Email Content

The email includes:

### Header Section
- Title: "🎯 LinkedIn Post Reminder"
- Subtitle: "Your content is ready to shine!"

### Funny Reminder Message
One of these messages is randomly selected:

- 🚀 Hey! Time to shine on LinkedIn! Your killer content is ready—don't let it gather dust!
- ⏰ Ding ding! Your LinkedIn post is waiting for you. Go make some impact! 💼
- 🔥 Your content is HOT and ready to roll! Your audience is waiting. Let's gooo!
- 💡 Don't ghost your LinkedIn audience! Your post is ready to drop. Go viral! 🌟
- 📱 Your post is dressed up and ready to impress. Time to hit that publish button! 🎯
- ✨ Remember: Consistency wins on LinkedIn! Your content is locked and loaded. 🚀
- 🎬 Plot twist: Your next viral post is right here. Ready to make LinkedIn magic? ✨

### Post Cards
Each post is displayed with:
- **Post Type** (Educational, Storytelling, Funny, Trend-based, Interactive)
- **Content** (with emojis already integrated)
- **Generated Image** (if available, embedded as inline image)
- **Fallback Images** (if Gemini didn't generate, uses web-sourced images)
- **Goal** (what the post aims to achieve on LinkedIn)

### Call-to-Action
- Direct link to LinkedIn to publish posts
- Footer with branding and copyright

## Troubleshooting

### Email Not Received

**Problem:** "Email credentials not configured. See .env file."
- **Solution:** Make sure `EMAIL_SENDER` and `EMAIL_PASSWORD` are filled in `.env`

**Problem:** Agent shows "warning" status and email_sent=false
- **Solution:** Verify your Outlook email and password are correct
- Ensure you're using an **App Password** if you have 2FA enabled (not your regular password)

**Problem:** SMTP connection timeout
- **Solution:** Confirm you're using `smtp.office365.com` and port `587`
- Check your internet connection
- Verify Outlook account is accessible

### Email Has Wrong Formatting

The email is sent in HTML format. If your email client doesn't support HTML:
- The email should still be readable in plain text
- Try opening it in Outlook web (outlook.office.com) for better formatting

### Images Not Showing in Email

**Inline Generated Images:** Should appear inline if Gemini successfully generated them

**Fallback Web Images:** Reference images from Serper/DuckDuckGo are embedded as clickable cards

If neither appears:
- Check that Agent 5 (Post Generator) ran successfully
- Check that Agent 6 (Image Generation) ran
- Verify web images or generation attempts were made

## Security Notes

🔒 **Important Security Practices:**

1. **Never commit credentials to git:**
   - Add `.env` to `.gitignore` (it should already be there)
   - Keep your App Password private

2. **Use App Password instead of account password:**
   - Safer if your credentials are ever exposed
   - Can be revoked from Microsoft Account dashboard
   - Limits access to email only

3. **Consider using environment variables in production:**
   - Instead of .env file, use your platform's secret management (Azure Key Vault, etc.)

## Integration with Pipeline

The Email Reminder Agent is **Agent 7** in the 7-agent pipeline:

```
Agent 1: Resume Parser
    ↓
Agent 2: Brand Voice Generator
    ↓
Agent 3: Influencer Scout
    ↓
Agent 4: Gap Analysis
    ↓
Agent 5: Post Generator
    ↓
Agent 6: Image Generator
    ↓
Agent 7: Email Reminder ← You are here
```

The email agent:
- ✅ **Never blocks the pipeline** if email fails (non-blocking)
- ✅ **Skips gracefully** if no user email or posts available
- ✅ **Shows status** (success/warning/skipped) in the UI
- ✅ **Includes helpful message** if credentials not configured

## API Details

### Email Reminder Agent Function Signature

```python
async def run_email_reminder(
    user_email: str,
    post_generation_output: dict[str, Any]
) -> dict[str, Any]
```

**Parameters:**
- `user_email`: User's registered email (from login/registration)
- `post_generation_output`: Output dict from Agent 5 containing posts

**Return:** Agent result dict with status, output (email metadata), and error

### Email Configuration Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `EMAIL_SENDER` | Outlook email to send from | (required) | `user@outlook.com` |
| `EMAIL_PASSWORD` | App password for Outlook | (required) | `abcd1234efgh5678` |
| `EMAIL_SMTP_SERVER` | SMTP server address | `smtp.office365.com` | `smtp.office365.com` |
| `EMAIL_SMTP_PORT` | SMTP port | `587` | `587` |

## Future Enhancements

Ideas for extending the email reminder:

- [ ] Scheduling: Send emails at specific times (morning reminder, weekly digest)
- [ ] Personalization: Use user's brand colors in email template
- [ ] Batch export: Package posts + images as ZIP file in email
- [ ] Email templates: Different templates for different audience types
- [ ] Unsubscribe option: Allow users to opt-out of reminders
- [ ] Calendar integration: Add posts to calendar events with reminders

---

**Questions or issues?** Check the backend error logs in `pipeline_error.log`
