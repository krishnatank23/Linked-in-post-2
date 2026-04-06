import asyncio
import os
import sys
from datetime import datetime
from datetime import timezone

from sqlalchemy import select

# Add the backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from env_config import load_backend_env
load_backend_env()

from database import init_db, async_session
from models import User, LinkedInPost
from scheduler import morning_post_generation_check


def should_force_today_schedule() -> bool:
    """Enable forced schedule override only when explicitly requested."""
    return "--force-today" in sys.argv


async def test_scheduler():
    print("=" * 60)
    print("Initializing database...")
    await init_db()

    print("\nCurrent user schedules:")
    async with async_session() as db:
        users = (await db.execute(select(User))).scalars().all()
        for u in users:
            print(f"  {u.email}")
            print(f"    Schedule : {u.posting_schedule}")
            print(f"    Has cache: profile={bool(u.parsed_profile_cache)} brand={bool(u.brand_voice_cache)}")
            print(f"    Last post: {u.last_automated_post_at}")

    if should_force_today_schedule():
        # Optional test mode: override all schedules to today's UTC day.
        today = datetime.now(timezone.utc).strftime("%A")
        print(f"\nForcing schedule to TODAY ({today}) for all users...")
        async with async_session() as db:
            users = (await db.execute(select(User))).scalars().all()
            for u in users:
                u.posting_schedule = [today]
                u.posting_time_utc = "11:00"
                u.last_automated_post_at = None
            await db.commit()
        print("Schedules updated.\n")
    else:
        print("\nUsing real user schedules (no force override).\n")

    print("=" * 60)
    print("Triggering morning_post_generation_check()...")
    print("=" * 60)
    await morning_post_generation_check()

    print("\n" + "=" * 60)
    print("Posts saved to linkedin_posts table:")
    print("=" * 60)
    async with async_session() as db:
        posts = (
            await db.execute(
                select(LinkedInPost)
                .order_by(LinkedInPost.created_at.desc())
                .limit(5)
            )
        ).scalars().all()

        if posts:
            for p in posts:
                print(f"  ID         : {p.id}")
                print(f"  User ID    : {p.user_id}")
                print(f"  Type       : {p.post_type}")
                print(f"  Email sent : {p.sent_to_email}")
                print(f"  Scheduled  : {p.scheduled_for}")
                print(f"  Content    : {p.content[:100]}...")
                print()
        else:
            print("  No posts found yet.")

if __name__ == "__main__":
    asyncio.run(test_scheduler())
