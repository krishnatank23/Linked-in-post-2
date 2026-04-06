# Automated LinkedIn Post Scheduling System

## Overview

The system now automatically generates and sends LinkedIn posts based on the frequency recommendations from the Gap Analysis Agent. Once a user completes the initial pipeline, the system:

1. **Extracts posting schedule** from gap analysis (e.g., "Monday, Wednesday, Friday at 10:00 UTC")
2. **Generates unique posts** each time - ensuring new posts are different from previously generated ones
3. **Stores posts in database** with scheduled delivery times
4. **Automatically triggers** on scheduled days and times
5. **Sends emails** with the generated posts directly to the user

## How It Works

### Phase 1: Initial Pipeline (User Manual Trigger)

When a user uploads their resume and completes the full pipeline analysis:

```
Resume Upload → Parse Profile → Brand Voice → Influencer Scout → Gap Analysis → Post Generation → Email Reminder
                                                                          ↓
                                                            Extract Posting Schedule
                                                                          ↓
                                                    Save Schedule to User Record
                                                                          ↓
                                                    Generate Posts with Deduplication
                                                                          ↓
                                                   Store Posts in LinkedInPost Table
```

**Example Output:**
- **Posting Frequency:** `5 posts per week`
- **Schedule Days:** `["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]`
- **Posting Time:** `10:00` (UTC)
- **Generated Posts:** 5 unique posts stored with their scheduled dates

### Phase 2: Automated Scheduling (System-Triggered)

Every hour, the scheduler checks if any user has a scheduled posting time:

```
Scheduler (runs hourly)
    ↓
For each user:
    - Check if today is a scheduled day (e.g., Monday)
    - Check if current hour matches posting time (e.g., 10:00)
    - Check if not already posted today
    - Trigger automated pipeline if all conditions met
    ↓
Automated Pipeline (skips resume parsing)
    - Load cached profile and brand voice
    - Run Gap Analysis → Post Generation → Store Posts → Send Email
    ↓
Each generated post:
    - Stored in LinkedInPost table
    - Scheduled for future days based on posting_schedule_days
    - Sent to user email automatically
```

## Database Schema

### New Table: `linkedin_posts`

```python
class LinkedInPost(Base):
    __tablename__ = "linkedin_posts"
    
    id: int                      # Unique post ID
    user_id: int               # User who owns this post
    post_type: str             # Educational, Storytelling, etc.
    content: str               # Full post text
    goal: str                  # Purpose of the post
    scheduled_for: datetime    # When this post is scheduled to publish
    sent_to_email: bool        # Whether email has been sent
    created_at: datetime       # When the post was generated
```

### Updated User Table

Added fields for scheduling:
```python
posting_schedule: list         # e.g., ["Monday", "Thursday"]
posting_time_utc: str         # e.g., "10:00"
last_automated_post_at: datetime  # Last automated post timestamp
```

## Post Deduplication Logic

Each time posts are generated:

1. **Fetch previous posts** from the database for the user (last 10 posts)
2. **Include previous posts** in the LLM prompt with instruction to avoid repetition
3. **Generate completely different content** - different topics, angles, stories, and data points
4. **Vary post types** - alternate between Educational, Storytelling, Trend-based, Interactive, etc.

Example prompt addition:
```
PREVIOUSLY GENERATED POSTS (AVOID REPETITION):
- Type: Educational
  Content: "Tips for machine learning in production..."
- Type: Storytelling  
  Content: "My journey transitioning to AI..."

DEDUPLICATION REQUIREMENT:
- DO NOT repeat or paraphrase previously generated posts
- Each new post MUST be completely different in topic and angle
```

## API Endpoints

### 1. Get Posting Schedule
```http
GET /api/posting-schedule/{user_id}
```

**Response:**
```json
{
  "user_id": 1,
  "posting_schedule_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "posting_time_utc": "10:00",
  "last_automated_post_at": "2025-01-15T10:00:00Z",
  "next_scheduled_posts": [
    {
      "id": 1,
      "type": "Educational",
      "scheduled_for": "2025-01-20T10:00:00Z",
      "content_preview": "Tips for implementing machine learning...",
      "sent_to_email": false
    }
  ],
  "total_posts_count": 5
}
```

### 2. Get All Generated Posts
```http
GET /api/generated-posts/{user_id}?limit=50
```

**Response:**
```json
{
  "user_id": 1,
  "total_posts": 15,
  "posts": [
    {
      "id": 15,
      "type": "Educational",
      "content": "Full post content here...",
      "goal": "Bridge the gap in AI knowledge",
      "scheduled_for": "2025-01-20T10:00:00Z",
      "sent_to_email": false,
      "created_at": "2025-01-10T14:30:00Z"
    }
  ]
}
```

## Workflow Changes

### Original Pipeline
```
resume_parser → brand_voice → influence_scout → gap_analysis → post_generation → email_reminder
```

### Updated Pipeline (with database persistence)
```
resume_parser → brand_voice → influence_scout → gap_analysis → post_generation → save_posts_to_db → email_reminder
```

### Automated Pipeline (scheduled)
```
influence_scout → gap_analysis → post_generation → save_posts_to_db → email_reminder
(Uses cached profile and brand voice from previous analysis)
```

## Scheduler Configuration

The scheduler runs every hour using APScheduler with CronTrigger:

```python
# In scheduler.py
scheduler.add_job(automated_posting_job, CronTrigger(minute=0))
# Runs at the top of every hour (00:00, 01:00, 02:00, etc.)
```

**Scheduling Logic:**
1. Get current day and hour
2. For each user:
   - Check if `posting_schedule` contains today
   - Check if `posting_time_utc` hour matches current hour
   - Check if not already posted today (via `last_automated_post_at`)
   - Have cached profile and brand voice
   - If all pass: trigger automated pipeline

## Post Generation Process (Automated)

When scheduler triggers:

```python
# Get user's cached data
parsed_profile = user.parsed_profile_cache
brand_voice = user.brand_voice_cache

# Fetch previous posts for deduplication
previous_posts = db.query(LinkedInPost).filter_by(user_id=user.id).limit(10)

# Run post generation with deduplication
posts = await run_post_generation(
    user_profile=parsed_profile,
    brand_voice=brand_voice,
    gap_analysis=cached_gap_analysis,
    previous_posts=previous_posts  # New parameter for uniqueness
)

# Store each post with calculated scheduled_for date
for idx, post in enumerate(posts):
    scheduled_day = posting_schedule_days[idx % len(posting_schedule_days)]
    scheduled_date = calculate_next_occurrence(scheduled_day, posting_time_utc)
    
    LinkedInPost(
        user_id=user.id,
        post_type=post['type'],
        content=post['content'],
        goal=post['goal'],
        scheduled_for=scheduled_date,
        sent_to_email=False
    ).save()

# Send email with all posts
await send_email_to_user(user.email, posts)
```

## Example Timeline

**Monday, 1/20/2025 - User completes initial pipeline:**
- Gap Analysis recommends: 5 posts/week on Mon, Tue, Wed, Thu, Fri at 10:00 UTC
- System generates 5 unique posts
- Posts scheduled:
  - Post 1: Monday 1/20 @ 10:00 UTC
  - Post 2: Tuesday 1/21 @ 10:00 UTC
  - Post 3: Wednesday 1/22 @ 10:00 UTC
  - Post 4: Thursday 1/23 @ 10:00 UTC
  - Post 5: Friday 1/24 @ 10:00 UTC
- Email sent to user with all 5 posts

**Tuesday, 1/21/2025 @ 09:00 UTC:**
- Scheduler checks: Is it Tuesday? Yes. Is it 10:00? No. Skip.

**Tuesday, 1/21/2025 @ 10:00 UTC:**
- Scheduler checks: Is it Tuesday? Yes. Is it 10:00? Yes. Already posted? No.
- System runs automated pipeline
- Since it's the scheduled time for Tuesday, new posts are generated
- New posts are unique and different from the ones generated on Monday
- Email is sent with the new posts

**Example of uniqueness:**
- **Monday Posts:** Focus on AI trends, machine learning tips, industry insights
- **Tuesday Posts:** Focus on personal stories, career journey, skills development
- **Wednesday Posts:** Focus on thought leadership, vision for the future
- **Thursday Posts:** Focus on industry analysis, competitive positioning
- **Friday Posts:** Focus on community engagement, collaboration opportunities

## Error Handling

The scheduler is robust and handles errors gracefully:

```python
try:
    # Check and trigger for each user
    ...
except Exception as e:
    print(f"[SCHEDULER ERROR] Failed for user {user.email}: {e}")
    traceback.print_exc()
    # Continue to next user, don't crash the scheduler
```

Missing data scenarios:
- No posting_schedule configured → Skip user, wait for manual configuration
- No cached profile/brand voice → Skip user, wait for initial pipeline
- Already posted today → Skip until next scheduled day
- LLM generation error → Log error, mark as failed, user can retry manually

## Future Enhancements

1. **Manual Schedule Configuration** - Allow users to set custom posting days/times
2. **Post Variations** - Generate multiple versions of same post for A/B testing
3. **Analytics Integration** - Track post performance and adjust schedule accordingly
4. **Timezone Support** - Change from UTC to user's local timezone
5. **Content Calendar** - Visual calendar of scheduled posts
6. **Manual Post Adjustment** - Allow users to edit generated posts before sending
7. **LinkedIn Direct Publishing** - Auto-post to LinkedIn instead of email-only

## Testing the System

### Manual Testing

1. **Complete initial pipeline** with your resume
2. **Check posting schedule:**
   ```bash
   GET /api/posting-schedule/{your_user_id}
   ```
3. **View generated posts:**
   ```bash
   GET /api/generated-posts/{your_user_id}
   ```
4. **Wait for scheduled time** or manually trigger scheduler for testing
5. **Check email** for automated posts
6. **Verify posts are unique** by comparing content from different days

### Database Verification

```sql
-- Check user's posting schedule
SELECT id, email, posting_schedule, posting_time_utc, last_automated_post_at 
FROM users WHERE id = 1;

-- Check generated posts
SELECT id, post_type, scheduled_for, sent_to_email, created_at 
FROM linkedin_posts WHERE user_id = 1 
ORDER BY created_at DESC;

-- Count posts by user
SELECT user_id, COUNT(*) as total_posts 
FROM linkedin_posts 
GROUP BY user_id;
```

## Troubleshooting

**Q: Posts aren't being generated automatically**
- Check: Is `posting_schedule` set? (Should not be NULL)
- Check: Is `posting_time_utc` set? (Should be like "10:00")
- Check: Does user have `parsed_profile_cache` and `brand_voice_cache`?
- Check: Scheduler is running (see backend logs)

**Q: Getting duplicate posts**
- This shouldn't happen with deduplication logic
- If it does, check previous_posts fetch in `run_post_generation()`
- Increase the fetch limit if needed (currently 10 previous posts)

**Q: Different time than expected**
- System uses UTC times
- Check your local timezone conversion
- Email timestamp shows UTC, convert to your timezone

**Q: Posts too similar to each other**
- The LLM might not be following deduplication rules
- Check the gap_analysis data for variety in recommended topics
- Run manual post generation with different gap_analysis strategies
