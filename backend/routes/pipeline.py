from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import asyncio
import os
import traceback

from database import get_db
from models import User, AgentOutput
from schemas import PipelineRequest, PipelineResponse, AgentResult, GapAnalysisRequest, GapAnalysisResponse, SaveResultRequest, GeneratePostsRequest, SendReminderRequest
from agents.workflow import run_pipeline
from agents.gap_analyzer_agent import run_gap_analysis
from agents.post_generator_agent import run_post_generation
from agents.email_reminder_agent import run_email_reminder
from agents.groq_guard import set_current_user_context
from agents.runtime_status import get_status, clear_status


router = APIRouter(prefix="/api", tags=["pipeline"])
PIPELINE_TIMEOUT_SECONDS = int(os.getenv("PIPELINE_TIMEOUT_SECONDS", "600"))


def _normalize_selected_influencers(raw_influencer_data: dict | list[dict] | None) -> list[dict]:
    """Normalize and validate selected influencers payload from frontend."""
    if isinstance(raw_influencer_data, dict):
        selected_influencers = [raw_influencer_data]
    elif isinstance(raw_influencer_data, list):
        selected_influencers = [inf for inf in raw_influencer_data if isinstance(inf, dict)]
    else:
        selected_influencers = []

    valid_influencers = []
    for influencer in selected_influencers:
        influencer_link = str(influencer.get("link") or "").strip().lower()
        influencer_title = str(influencer.get("title") or "").strip()
        if influencer_title and "linkedin.com" in influencer_link:
            valid_influencers.append(influencer)
    return valid_influencers


async def _get_latest_influencer_candidates(db: AsyncSession, user_id: int) -> list[dict]:
    """Get influencer candidates from latest successful Influence Scout output."""
    result = await db.execute(
        select(AgentOutput)
        .where(
            AgentOutput.user_id == user_id,
            AgentOutput.agent_name == "Influence & Idol Scout Agent",
            AgentOutput.status == "success",
        )
        .order_by(AgentOutput.created_at.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    if not latest or not latest.output_data:
        return []
    return latest.output_data.get("influencers") or []


def _build_posting_recommendation(
    gap_output: dict | None,
    influencer_payload: dict,
    post_output: dict | None,
) -> dict:
    """Create a clear posting recommendation summary based on gap + selected influencers."""
    gap_output = gap_output or {}
    post_output = post_output or {}
    gap_analysis = gap_output.get("gap_analysis") or {}

    if "selected_influencers" in influencer_payload:
        selected_count = len(influencer_payload.get("selected_influencers") or [])
    else:
        selected_count = 1

    missing_elements = gap_analysis.get("key_missing_elements") or []
    gap_score = len(missing_elements)

    # Dynamic recommendation by gap depth + benchmark breadth.
    recommended_posts_per_week = 3
    if gap_score >= 5 or selected_count >= 5:
        recommended_posts_per_week = 5
    elif gap_score >= 3 or selected_count >= 3:
        recommended_posts_per_week = 4

    suggested_days = post_output.get("posting_schedule_days") or []
    posting_time = post_output.get("posting_time_utc") or "14:00"

    if not suggested_days:
        fallback_days_map = {
            3: ["Monday", "Wednesday", "Friday"],
            4: ["Monday", "Tuesday", "Thursday", "Saturday"],
            5: ["Monday", "Tuesday", "Wednesday", "Friday", "Saturday"],
        }
        suggested_days = fallback_days_map.get(recommended_posts_per_week, ["Monday", "Wednesday", "Friday"])

    frequency_text = post_output.get("posting_frequency") or f"{recommended_posts_per_week} times per week"

    rationale = (
        f"Based on {selected_count} selected influencer(s) and {gap_score} identified gap element(s), "
        f"the recommended cadence is {recommended_posts_per_week} posts per week. "
        f"This frequency balances authority-building speed with consistency for your current gap level."
    )

    return {
        "posting_frequency": frequency_text,
        "recommended_posts_per_week": recommended_posts_per_week,
        "recommended_days": suggested_days,
        "recommended_time_utc": posting_time,
        "benchmark_influencer_count": selected_count,
        "gap_elements_count": gap_score,
        "rationale": rationale,
    }


@router.post("/pipeline/run", response_model=PipelineResponse)
async def run_agent_pipeline(request: PipelineRequest, db: AsyncSession = Depends(get_db)):
    """Run the full agentic AI pipeline for a given user."""
    # Get user and resume path
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.resume_path:
        raise HTTPException(status_code=400, detail="No resume uploaded for this user")

    # Clear previous agent outputs for this user
    prev_outputs = await db.execute(select(AgentOutput).where(AgentOutput.user_id == user.id))
    for output in prev_outputs.scalars().all():
        await db.delete(output)
    await db.commit()

    # Run the LangGraph pipeline with timeout protection
    try:
        print(f"[PIPELINE] Starting pipeline for user {request.user_id} with resume: {user.resume_path}")
        set_current_user_context(user.id)
        clear_status(user.id)
        
        # Timeout guard for end-to-end pipeline execution.
        try:
            agent_results = await asyncio.wait_for(run_pipeline(user.resume_path, user.email), timeout=PIPELINE_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            error_msg = f"Pipeline execution timed out after {PIPELINE_TIMEOUT_SECONDS} seconds. The LLM service may be slow or unavailable."
            print(f"[PIPELINE ERROR] {error_msg}")
            raise HTTPException(status_code=408, detail=error_msg)

        print(f"[PIPELINE] Pipeline completed with {len(agent_results)} results")

        # Save agent outputs to database
        response_results = []
        for ar in agent_results:
            agent_output = AgentOutput(
                user_id=user.id,
                agent_name=ar["agent_name"],
                agent_description=ar.get("agent_description", ""),
                status=ar["status"],
                output_data=ar.get("output"),
                error_message=ar.get("error"),
            )
            db.add(agent_output)
            await db.flush() # To get the ID

            # Persist early-stage outputs at user-level for revisit and reuse.
            if ar.get("status") == "success" and ar.get("output"):
                if "Resume Parser" in ar.get("agent_name", ""):
                    user.parsed_profile_cache = ar["output"].get("parsed_profile")
                    user.cache_updated_at = datetime.utcnow()
                if "Brand Voice" in ar.get("agent_name", ""):
                    user.brand_voice_cache = ar["output"].get("brand_analysis")
                    user.cache_updated_at = datetime.utcnow()
                if "LinkedIn Post Generator" in ar.get("agent_name", ""):
                    out_data = ar.get("output", {})
                    if "posting_schedule_days" in out_data:
                        user.posting_schedule = out_data["posting_schedule_days"]
                    if "posting_time_utc" in out_data:
                        user.posting_time_utc = out_data["posting_time_utc"]
                    user.cache_updated_at = datetime.utcnow()

            response_results.append(AgentResult(
                id=agent_output.id,
                agent_name=ar["agent_name"],
                agent_description=ar.get("agent_description", ""),
                status=ar["status"],
                output=ar.get("output"),
                error=ar.get("error"),
                is_saved=False
            ))

        await db.commit()

        return PipelineResponse(
            message="Pipeline execution completed",
            results=response_results,
        )
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error in pipeline: {str(e)}\n{traceback.format_exc()}"
        print(f"[PIPELINE ERROR] {error_msg}")
        with open("pipeline_error.log", "a") as f:
            f.write(f"\n--- ERROR at {datetime.now()} ---\n{error_msg}\n")
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")
    finally:
        set_current_user_context(None)
        clear_status(user.id)


@router.get("/pipeline/live-status/{user_id}")
async def get_pipeline_live_status(user_id: int):
    """Live status for user-facing UI while pipeline is running (rate-limit/retry visibility)."""
    return get_status(user_id)


@router.get("/pipeline/results/{user_id}", response_model=PipelineResponse)
async def get_pipeline_results(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get the latest pipeline results for a user."""
    try:
        result = await db.execute(
            select(AgentOutput)
            .where(AgentOutput.user_id == user_id)
            .order_by(AgentOutput.created_at.asc())
        )
        outputs = result.scalars().all()

        if not outputs:
            return PipelineResponse(
                message="No pipeline results found yet",
                results=[]
            )

        results = [
            AgentResult(
                id=o.id,
                agent_name=o.agent_name,
                agent_description=o.agent_description or "",
                status=o.status,
                output=o.output_data,
                error=o.error_message,
                is_saved=o.is_saved
            )
            for o in outputs
        ]
        return PipelineResponse(message="Results retrieved", results=results)
    except Exception as e:
        print(f"[ERROR] Failed to get pipeline results for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve results: {str(e)}")


@router.post("/pipeline/save-result")
async def save_agent_result(request: SaveResultRequest, db: AsyncSession = Depends(get_db)):
    """Toggle the saved status of an agent result."""
    stmt = select(AgentOutput).where(
        AgentOutput.user_id == request.user_id,
        AgentOutput.agent_name == request.agent_name
    ).order_by(AgentOutput.created_at.desc()).limit(1)
    
    result = await db.execute(stmt)
    output = result.scalar_one_or_none()
    
    if not output:
        raise HTTPException(status_code=404, detail="Result not found")
        
    output.is_saved = request.save
    await db.commit()
    
    return {"message": "Output saved to profile" if request.save else "Output removed from saved"}


@router.post("/pipeline/gap-analysis", response_model=GapAnalysisResponse)
async def perform_gap_analysis(request: GapAnalysisRequest, db: AsyncSession = Depends(get_db)):
    """Analyze the gap between a user and selected influencer(s)."""
    # Enforce explicit human-in-the-loop influencer selection before running gap analysis.
    valid_influencers = _normalize_selected_influencers(request.influencer_data)

    if not valid_influencers:
        raise HTTPException(
            status_code=400,
            detail="Please select at least one valid influencer from the list before running gap analysis."
        )

    # Enforce that selected influencers must come from latest generated influencer list.
    available_candidates = await _get_latest_influencer_candidates(db, request.user_id)
    available_links = {
        str(item.get("link") or "").strip().lower()
        for item in available_candidates
        if isinstance(item, dict)
    }
    selected_links = {
        str(item.get("link") or "").strip().lower()
        for item in valid_influencers
    }

    if not available_links:
        raise HTTPException(
            status_code=400,
            detail="Run pipeline analysis first to generate influencer list, then select influencer(s) and continue."
        )

    if not selected_links.issubset(available_links):
        raise HTTPException(
            status_code=400,
            detail="Selected influencer is not from the latest generated list. Please select from shown results and retry."
        )

    influencer_payload = (
        valid_influencers[0]
        if len(valid_influencers) == 1
        else {"selected_influencers": valid_influencers, "selection_count": len(valid_influencers)}
    )

    # 1. Get user and their existing outputs (for profile/brand voice)
    user_result = await db.execute(select(User).where(User.id == request.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Prefer cached profile/brand voice from user record.
    profile_data = user.parsed_profile_cache
    brand_voice = user.brand_voice_cache

    # 3. Fallback: Get latest outputs for profile and brand voice from agent outputs
    output_result = await db.execute(select(AgentOutput).where(AgentOutput.user_id == user.id))
    outputs = output_result.scalars().all()

    for o in outputs:
        if not profile_data and "Resume Parser" in o.agent_name:
            profile_data = o.output_data.get("parsed_profile") if o.output_data else None
        if not brand_voice and "Brand Voice" in o.agent_name:
            brand_voice = o.output_data.get("brand_analysis") if o.output_data else None

    # 4. Backfill caches if we recovered from historical outputs
    cache_updated = False
    if profile_data and not user.parsed_profile_cache:
        user.parsed_profile_cache = profile_data
        cache_updated = True
    if brand_voice and not user.brand_voice_cache:
        user.brand_voice_cache = brand_voice
        cache_updated = True
    if cache_updated:
        user.cache_updated_at = datetime.utcnow()
        await db.commit()

    if not profile_data or not brand_voice:
        raise HTTPException(
            status_code=400, 
            detail="User must run full pipeline analysis before gap analysis"
        )

    # 5. Run post-selection chain: Gap Analysis -> Posting Recommendation -> Post Generation
    try:
        # Run Gap Analysis
        ar_gap = await run_gap_analysis(profile_data, brand_voice, influencer_payload)

        # Persist gap-analysis result for downstream step gating.
        db.add(AgentOutput(
            user_id=user.id,
            agent_name="Gap Analysis & Content Strategist",
            agent_description="Identifies professional gaps and provides a custom LinkedIn content plan",
            status=ar_gap["status"],
            output_data=ar_gap.get("output"),
            error_message=ar_gap.get("error"),
        ))
        await db.commit()

        results = [
            AgentResult(
                agent_name="Gap Analysis & Content Strategist",
                agent_description="Identifies professional gaps and provides a custom LinkedIn content plan",
                status=ar_gap["status"],
                output=ar_gap["output"],
                error=ar_gap.get("error"),
            )
        ]

        if ar_gap["status"] != "success" or not ar_gap.get("output"):
            return GapAnalysisResponse(
                message="Gap analysis completed but downstream steps were skipped due to gap-analysis failure.",
                results=results,
            )

        # Run Post Generation immediately after successful gap analysis.
        ar_posts = await run_post_generation(profile_data, brand_voice, ar_gap["output"])

        recommendation_output = _build_posting_recommendation(
            ar_gap.get("output"),
            influencer_payload,
            ar_posts.get("output"),
        )

        # Persist recommendation as an agent output for auditability.
        db.add(AgentOutput(
            user_id=user.id,
            agent_name="Posting Frequency Recommendation Agent",
            agent_description="Recommends personalized weekly posting cadence based on gap depth and selected influencers",
            status="success",
            output_data=recommendation_output,
            error_message=None,
        ))

        results.append(
            AgentResult(
                agent_name="Posting Frequency Recommendation Agent",
                agent_description="Recommends personalized weekly posting cadence based on gap depth and selected influencers",
                status="success",
                output=recommendation_output,
                error=None,
            )
        )

        # Persist post generation output and user posting schedule.
        db.add(AgentOutput(
            user_id=user.id,
            agent_name="LinkedIn Post Generator",
            agent_description="Generates humanized and trend-based LinkedIn posts ready to share",
            status=ar_posts["status"],
            output_data=ar_posts.get("output"),
            error_message=ar_posts.get("error"),
        ))

        if ar_posts["status"] == "success":
            out_data = ar_posts.get("output") or {}
            if "posting_schedule_days" in out_data:
                user.posting_schedule = out_data["posting_schedule_days"]
            if "posting_time_utc" in out_data:
                user.posting_time_utc = out_data["posting_time_utc"]
            user.cache_updated_at = datetime.utcnow()

        await db.commit()

        results.append(
            AgentResult(
                agent_name="LinkedIn Post Generator",
                agent_description="Generates humanized and trend-based LinkedIn posts ready to share",
                status=ar_posts["status"],
                output=ar_posts.get("output"),
                error=ar_posts.get("error"),
            )
        )

        return GapAnalysisResponse(
            message="Post-selection pipeline completed: gap analysis, posting recommendation, and post generation are ready.",
            results=results,
        )
    except Exception as e:
        import traceback
        print(f"Gap analysis error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Gap analysis failed: {str(e)}")


@router.post("/pipeline/generate-posts", response_model=GapAnalysisResponse)
async def generate_posts_from_strategy(request: GeneratePostsRequest, db: AsyncSession = Depends(get_db)):
    """Generate posts based on an approved gap analysis strategy (no email sent here)."""
    # 1. Get user and their existing outputs (for profile/brand voice)
    user_result = await db.execute(select(User).where(User.id == request.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile_data = user.parsed_profile_cache
    brand_voice = user.brand_voice_cache

    if not profile_data or not brand_voice:
        raise HTTPException(
            status_code=400, 
            detail="User must run full pipeline analysis before generating posts"
        )

    # Enforce HITL order: user must complete gap analysis step first.
    latest_gap = await db.execute(
        select(AgentOutput)
        .where(
            AgentOutput.user_id == user.id,
            AgentOutput.agent_name == "Gap Analysis & Content Strategist",
            AgentOutput.status == "success",
        )
        .order_by(AgentOutput.created_at.desc())
        .limit(1)
    )
    if latest_gap.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=400,
            detail="Please select influencer(s) and complete gap analysis before generating posts."
        )

    try:
        results = []
        
        # Run Post Generator
        ar_posts = await run_post_generation(profile_data, brand_voice, request.gap_analysis_data)
        
        post_agent_result = AgentResult(
            agent_name="LinkedIn Post Generator",
            agent_description="Generates humanized and trend-based LinkedIn posts ready to share",
            status=ar_posts["status"],
            output=ar_posts["output"],
            error=ar_posts.get("error"),
        )

        if ar_posts["status"] == "success":
            db.add(AgentOutput(
                user_id=user.id,
                agent_name="LinkedIn Post Generator",
                agent_description="Generates humanized and trend-based LinkedIn posts ready to share",
                status=ar_posts["status"],
                output_data=ar_posts.get("output"),
                error_message=ar_posts.get("error"),
            ))
            # Append Post Generator result first
            results.append(post_agent_result)
            
            # Update user schedule if present
            out_data = ar_posts.get("output", {})
            if "posting_schedule_days" in out_data:
                user.posting_schedule = out_data["posting_schedule_days"]
            if "posting_time_utc" in out_data:
                user.posting_time_utc = out_data["posting_time_utc"]
            user.cache_updated_at = datetime.utcnow()
            await db.commit()

        return GapAnalysisResponse(
            message="Post generation completed successfully",
            results=results
        )
    except Exception as e:
        import traceback
        print(f"Gap analysis error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Gap analysis failed: {str(e)}")


@router.post("/pipeline/send-reminder", response_model=GapAnalysisResponse)
async def send_reminder_email(request: SendReminderRequest, db: AsyncSession = Depends(get_db)):
    """Send reminder email manually after user reviews generated posts."""
    user_result = await db.execute(select(User).where(User.id == request.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    posts_payload = request.posts_data or {}
    posts = posts_payload.get("posts") if isinstance(posts_payload, dict) else None
    if not isinstance(posts, list) or not posts:
        raise HTTPException(status_code=400, detail="No generated posts found to send")

    # Enforce HITL order: reminder requires successful post generation first.
    latest_posts = await db.execute(
        select(AgentOutput)
        .where(
            AgentOutput.user_id == user.id,
            AgentOutput.agent_name == "LinkedIn Post Generator",
            AgentOutput.status == "success",
        )
        .order_by(AgentOutput.created_at.desc())
        .limit(1)
    )
    if latest_posts.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=400,
            detail="Generate posts after influencer selection and gap analysis before sending reminder."
        )

    try:
        ar_email = await run_email_reminder(user.email, posts_payload)
        return GapAnalysisResponse(
            message="Reminder email action completed",
            results=[
                AgentResult(
                    agent_name="Email Reminder Agent",
                    agent_description="Sends email reminder with LinkedIn posts and images to user's Outlook",
                    status=ar_email["status"],
                    output=ar_email["output"],
                    error=ar_email.get("error"),
                )
            ],
        )
    except Exception as e:
        import traceback
        print(f"Reminder email error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Reminder email failed: {str(e)}")
