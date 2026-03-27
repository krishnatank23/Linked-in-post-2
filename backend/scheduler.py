import asyncio
from datetime import datetime
import traceback
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from database import async_session
from models import User
from agents.workflow import run_automated_pipeline
from agents.groq_guard import set_current_user_context
from agents.runtime_status import clear_status

scheduler = AsyncIOScheduler()

async def automated_posting_job():
    """
    Checks if any user needs an automated post today at this hour.
    """
    try:
        now = datetime.utcnow()
        current_day = now.strftime("%A") # e.g. "Monday"
        current_hour = now.strftime("%H") # e.g. "14"
        
        print(f"[SCHEDULER] Checking automated post schedule. Day: {current_day}, Hour: {current_hour}")

        async with async_session() as db:
            result = await db.execute(select(User))
            users = result.scalars().all()
            
            for user in users:
                try:
                    # 1. Check if user has a schedule configured
                    if not user.posting_schedule or not isinstance(user.posting_schedule, list):
                        continue
                        
                    # 2. Check if today is a scheduled day
                    if current_day not in user.posting_schedule:
                        continue
                        
                    # 3. Check if it's the right hour (if configured)
                    if user.posting_time_utc:
                        scheduled_hour = user.posting_time_utc.split(":")[0]
                        if scheduled_hour != current_hour:
                            continue
                            
                    # 4. Check if we already posted today for this user
                    if user.last_automated_post_at and user.last_automated_post_at.date() == now.date():
                        continue
                        
                    # 5. Check if user has cached data needed for the automated pipeline
                    if not user.parsed_profile_cache or not user.brand_voice_cache:
                        print(f"[SCHEDULER] User {user.email} missing cached profile/brand voice. Skipping.")
                        continue
                    
                    print(f"[SCHEDULER] Triggering automated pipeline for user: {user.email}")
                    
                    set_current_user_context(user.id)
                    clear_status(user.id)
                    
                    # Execute automated pipeline
                    results = await run_automated_pipeline(
                        user.parsed_profile_cache,
                        user.brand_voice_cache,
                        user.email
                    )
                    
                    # Update last automated post timestamp
                    user.last_automated_post_at = datetime.utcnow()
                    await db.commit()
                    print(f"[SCHEDULER] Successfully completed automated pipeline for user {user.email}")
                    
                except Exception as e:
                    print(f"[SCHEDULER ERROR] Failed automated pipeline for user {user.email}: {e}")
                    traceback.print_exc()
                finally:
                    set_current_user_context(None)
                    clear_status(user.id)

    except Exception as e:
        print(f"[SCHEDULER SYSTEM ERROR] {e}")
        traceback.print_exc()


def start_scheduler():
    """Initialize and start the background scheduler."""
    # Run at the top of every hour
    scheduler.add_job(automated_posting_job, CronTrigger(minute=0))
    scheduler.start()
    print("[SCHEDULER] Scheduler started. Checking for automated posts every hour.")
