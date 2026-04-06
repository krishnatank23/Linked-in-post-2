import asyncio
from datetime import datetime
import traceback
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from database import async_session
from models import User, AgentOutput
from agents.groq_guard import set_current_user_context
from agents.runtime_status import clear_status

scheduler = AsyncIOScheduler()


async def morning_post_generation_check():
    """
    Runs at 11:00 AM UTC every day.
    Checks all users and generates posts for those whose posting_schedule includes today.
    
    This is a proactive check to ensure posts are generated early in the day for users
    who are scheduled to post today at any time.
    """
    try:
        now = datetime.utcnow()
        current_day = now.strftime("%A")  # e.g. "Monday"
        
        print(f"\n{'='*70}")
        print(f"[MORNING CHECK] Starting daily post generation check at {now.isoformat()}")
        print(f"[MORNING CHECK] Today is {current_day}")
        print(f"{'='*70}\n")

        async with async_session() as db:
            result = await db.execute(select(User))
            users = result.scalars().all()
            
            users_needing_posts = []
            
            # First pass: Identify which users need posts today
            for user in users:
                try:
                    # 1. Check if user has a schedule configured
                    if not user.posting_schedule or not isinstance(user.posting_schedule, list):
                        continue
                    
                    # 2. Check if today is a scheduled posting day
                    if current_day not in user.posting_schedule:
                        continue
                    
                    # 3. Check if user has cached data
                    if not user.parsed_profile_cache or not user.brand_voice_cache:
                        print(f"[MORNING CHECK] WARN User {user.email} needs posts today but missing cached data. Skipping.")
                        continue

                    # 4. Ensure we have saved gap analysis for post-only automated generation.
                    gap_result = await db.execute(
                        select(AgentOutput)
                        .where(
                            AgentOutput.user_id == user.id,
                            AgentOutput.agent_name == "Gap Analysis & Content Strategist",
                            AgentOutput.status == "success",
                        )
                        .order_by(AgentOutput.created_at.desc())
                        .limit(1)
                    )
                    latest_gap = gap_result.scalar_one_or_none()
                    if not latest_gap or not latest_gap.output_data:
                        print(f"[MORNING CHECK] WARN User {user.email} missing saved gap analysis. Run influencer selection + gap analysis once.")
                        continue
                    
                    users_needing_posts.append(user)
                    print(f"[MORNING CHECK] OK User {user.email} needs posts today (scheduled: {user.posting_schedule} @ {user.posting_time_utc})")
                    
                except Exception as e:
                    print(f"[MORNING CHECK ERROR] Failed to check user: {e}")
                    continue
            
            # Report findings
            print(f"\n[MORNING CHECK] Found {len(users_needing_posts)} user(s) needing posts today")
            
            if not users_needing_posts:
                print(f"[MORNING CHECK] No users found needing posts today. Exiting gracefully.\n")
                return
            
            # Second pass: Generate posts for each user needing them
            successful_generations = 0
            failed_generations = 0
            
            for user in users_needing_posts:
                try:
                    print(f"\n[MORNING CHECK] Generating posts for user: {user.email}")
                    
                    set_current_user_context(user.id)
                    clear_status(user.id)
                    
                    # Fetch latest saved gap analysis and run post-generation-only automation.
                    gap_result = await db.execute(
                        select(AgentOutput)
                        .where(
                            AgentOutput.user_id == user.id,
                            AgentOutput.agent_name == "Gap Analysis & Content Strategist",
                            AgentOutput.status == "success",
                        )
                        .order_by(AgentOutput.created_at.desc())
                        .limit(1)
                    )
                    latest_gap = gap_result.scalar_one_or_none()
                    if not latest_gap or not latest_gap.output_data:
                        print(f"[MORNING CHECK] FAIL Skipping {user.email}: no cached gap analysis found at runtime.")
                        failed_generations += 1
                        continue

                    # Import here to avoid circular import during module initialization.
                    from agents.workflow import run_automated_post_only_pipeline

                    # Execute post-generation-only automated pipeline with cached strategy data.
                    results = await run_automated_post_only_pipeline(
                        user.parsed_profile_cache,
                        user.brand_voice_cache,
                        latest_gap.output_data,
                        user.email,
                        user.id
                    )
                    
                    # Check for success
                    post_gen_result = next(
                        (r for r in results if "LinkedIn Post Generator" in r.get("agent_name", "")),
                        None
                    )
                    email_result = next(
                        (r for r in results if "Email Reminder Agent" in r.get("agent_name", "")),
                        None
                    )
                    
                    post_ok = bool(post_gen_result and post_gen_result.get("status") == "success")
                    email_ok = bool(email_result and email_result.get("status") == "success")

                    if post_ok and email_ok:
                        print(f"[MORNING CHECK] OK Posts generated and email sent for {user.email}")
                        successful_generations += 1
                    else:
                        if not post_ok:
                            print(f"[MORNING CHECK] FAIL Post generation failed for {user.email}")
                        if not email_ok:
                            email_msg = None
                            if email_result:
                                email_msg = email_result.get("error") or (email_result.get("output") or {}).get("message")
                            print(f"[MORNING CHECK] FAIL Email reminder failed for {user.email}: {email_msg or 'Unknown error'}")
                        failed_generations += 1
                    
                    # Update last_automated_post_at
                    user.last_automated_post_at = datetime.utcnow()
                    await db.commit()
                    
                except Exception as e:
                    print(f"[MORNING CHECK ERROR] Failed to generate posts for user {user.email}: {e}")
                    traceback.print_exc()
                    failed_generations += 1
                    
                finally:
                    set_current_user_context(None)
                    clear_status(user.id)
            
            # Summary
            print(f"\n{'='*70}")
            print(f"[MORNING CHECK] SUMMARY")
            print(f"[MORNING CHECK] Total users needing posts today: {len(users_needing_posts)}")
            print(f"[MORNING CHECK] Successfully generated: {successful_generations}")
            print(f"[MORNING CHECK] Failed: {failed_generations}")
            print(f"[MORNING CHECK] Check completed at {datetime.utcnow().isoformat()}")
            print(f"{'='*70}\n")
    
    except Exception as e:
        print(f"[MORNING CHECK SYSTEM ERROR] {e}")
        traceback.print_exc()


def start_scheduler():
    """Initialize and start the background scheduler."""
    # Single daily job: Run at 11:00 AM UTC every day
    # Checks all users and generates posts for those who need to post today
    scheduler.add_job(morning_post_generation_check, CronTrigger(hour=11, minute=0))
    
    scheduler.start()
    print("[SCHEDULER] Scheduler started. Daily post generation check runs at 11:00 AM UTC.")
