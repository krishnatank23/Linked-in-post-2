from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import asyncio
import os
import traceback

from database import get_db
from models import User, AgentOutput, LinkedInPost
from schemas import PipelineRequest, PipelineResponse, AgentResult, GapAnalysisRequest, GapAnalysisResponse, SaveResultRequest, GeneratePostsRequest, SendReminderRequest, SendPostEmailRequest
from agents.workflow import run_pipeline
from agents.gap_analyzer_agent import run_gap_analysis
from agents.post_generator_agent import run_post_generation
from agents.email_reminder_agent import run_email_reminder
from agents.groq_guard import set_current_user_context
from agents.runtime_status import get_status, clear_status
from env_config import load_backend_env
from path_resolver import resolve_resume_path, to_portable_resume_path


router = APIRouter(prefix="/api", tags=["pipeline"])
PIPELINE_TIMEOUT_SECONDS = int(os.getenv("PIPELINE_TIMEOUT_SECONDS", "600"))


def _ensure_groq_key() -> None:
    load_backend_env()
    groq_key = str(os.getenv("GROQ_API_KEY") or "").strip()
    if not groq_key:
        raise HTTPException(
            status_code=400,
            detail="GROQ_API_KEY is missing. Add it to backend/.env, restart the backend, and run the pipeline again.",
        )


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
    gap_analysis = gap_output.get("overall_gap_analysis") or gap_output.get("gap_analysis") or {}

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

    recommended_post_types = post_output.get("recommended_post_types") or []
    if not recommended_post_types:
        strategy = gap_output.get("overall_content_strategy") or gap_output.get("content_strategy") or {}
        schedule = strategy.get("proposed_schedule") or []
        for item in schedule:
            if isinstance(item, dict):
                post_type = str(item.get("post_type") or "").strip()
                if post_type and post_type not in recommended_post_types:
                    recommended_post_types.append(post_type)

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
        "recommended_post_types": recommended_post_types,
        "benchmark_influencer_count": selected_count,
        "gap_elements_count": gap_score,
        "rationale": rationale,
    }


def _unique_keep_order(items: list[str]) -> list[str]:
    unique = []
    for item in items:
        clean = str(item or "").strip()
        if clean and clean not in unique:
            unique.append(clean)
    return unique


def _build_overall_gap_summary(per_influencer_entries: list[dict]) -> dict:
    """Build a combined summary across all selected influencers."""
    profile_gaps = []
    authority_gaps = []
    engagement_gaps = []
    key_missing = []
    action_plan = []
    content_pillars = []
    proposed_schedule = []
    benchmarked = []

    for entry in per_influencer_entries:
        influencer = entry.get("influencer") or {}
        benchmarked.append({"title": influencer.get("title"), "link": influencer.get("link")})

        gap_out = entry.get("analysis") or {}
        gap = gap_out.get("gap_analysis") or {}
        strategy = gap_out.get("content_strategy") or {}

        if gap.get("profile_completeness_gap"):
            profile_gaps.append(gap["profile_completeness_gap"])
        if gap.get("content_authority_gap"):
            authority_gaps.append(gap["content_authority_gap"])
        if gap.get("engagement_gap"):
            engagement_gaps.append(gap["engagement_gap"])

        key_missing.extend(gap.get("key_missing_elements") or [])
        action_plan.extend(gap_out.get("action_plan") or [])
        content_pillars.extend(strategy.get("content_pillars") or [])
        for item in strategy.get("proposed_schedule") or []:
            if isinstance(item, dict):
                proposed_schedule.append(item)

    return {
        "benchmarked_influencers": benchmarked,
        "overall_gap_analysis": {
            "profile_completeness_gap": " ".join(profile_gaps[:3]) if profile_gaps else "Not enough data.",
            "content_authority_gap": " ".join(authority_gaps[:3]) if authority_gaps else "Not enough data.",
            "engagement_gap": " ".join(engagement_gaps[:3]) if engagement_gaps else "Not enough data.",
            "key_missing_elements": _unique_keep_order(key_missing)[:8],
        },
        "overall_content_strategy": {
            "content_pillars": _unique_keep_order(content_pillars)[:6],
            "proposed_schedule": proposed_schedule[:10],
            "tone_adjustment": "Align tone with selected influencer benchmarks while keeping your own authentic voice.",
        },
        "overall_action_plan": _unique_keep_order(action_plan)[:8],
    }


@router.post("/pipeline/run", response_model=PipelineResponse)
async def run_agent_pipeline(request: PipelineRequest, db: AsyncSession = Depends(get_db)):
    """Run the full agentic AI pipeline for a given user."""
    _ensure_groq_key()

    # Get user and resume path
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.resume_path:
        raise HTTPException(status_code=400, detail="No resume uploaded for this user")

    try:
        resolved_resume_path = resolve_resume_path(user.resume_path)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=400,
            detail=(
                "Resume file not found on this server. Please re-upload your resume from the UI "
                f"and run the pipeline again. Details: {str(e)}"
            ),
        )

    # One-time migration: normalize persisted path to a portable relative path.
    portable_resume_path = to_portable_resume_path(resolved_resume_path)
    if user.resume_path != portable_resume_path:
        user.resume_path = portable_resume_path
        await db.commit()

    # Clear previous agent outputs for this user
    prev_outputs = await db.execute(select(AgentOutput).where(AgentOutput.user_id == user.id))
    for output in prev_outputs.scalars().all():
        await db.delete(output)
    await db.commit()

    # Run the LangGraph pipeline with timeout protection
    try:
        print(f"[PIPELINE] Starting pipeline for user {request.user_id} with resume: {resolved_resume_path}")
        set_current_user_context(user.id)
        clear_status(user.id)
        
        # Timeout guard for end-to-end pipeline execution.
        try:
            agent_results = await asyncio.wait_for(run_pipeline(resolved_resume_path, user.email), timeout=PIPELINE_TIMEOUT_SECONDS)
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
                if "Influence & Idol Scout Agent" in ar.get("agent_name", ""):
                    # Influencers are persisted in AgentOutput; update cache timestamp for strategy freshness.
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

    # 5. Run post-selection chain: one analysis per selected influencer, then overall summary and recommendation.
    try:
        per_influencer_analysis = []
        per_influencer_errors = []

        for influencer in valid_influencers:
            ar_gap = await run_gap_analysis(profile_data, brand_voice, influencer)
            if ar_gap.get("status") == "success" and ar_gap.get("output"):
                per_influencer_analysis.append({"influencer": influencer, "analysis": ar_gap.get("output")})
            else:
                per_influencer_errors.append({
                    "influencer": influencer,
                    "error": ar_gap.get("error") or "Gap analysis failed for this influencer.",
                })

        if not per_influencer_analysis:
            raise HTTPException(
                status_code=500,
                detail="Gap analysis failed for all selected influencers. Please try again with different selections."
            )

        combined_gap_output = _build_overall_gap_summary(per_influencer_analysis)
        combined_gap_output["per_influencer_analysis"] = per_influencer_analysis
        combined_gap_output["analysis_errors"] = per_influencer_errors

        recommendation_output = _build_posting_recommendation(
            combined_gap_output,
            influencer_payload,
            None,
        )

        # Persist combined gap-analysis result for downstream step gating.
        db.add(AgentOutput(
            user_id=user.id,
            agent_name="Gap Analysis & Content Strategist",
            agent_description="Identifies professional gaps and provides per-influencer and overall improvement strategy",
            status="success",
            output_data=combined_gap_output,
            error_message=None,
        ))

        # Persist recommendation as an agent output for auditability.
        db.add(AgentOutput(
            user_id=user.id,
            agent_name="Posting Frequency Recommendation Agent",
            agent_description="Recommends personalized weekly posting cadence based on gap depth and selected influencers",
            status="success",
            output_data=recommendation_output,
            error_message=None,
        ))
        await db.commit()

        results = [
            AgentResult(
                agent_name="Gap Analysis & Content Strategist",
                agent_description="Identifies professional gaps and provides per-influencer and overall improvement strategy",
                status="success",
                output=combined_gap_output,
                error=None,
            ),
            AgentResult(
                agent_name="Posting Frequency Recommendation Agent",
                agent_description="Recommends personalized weekly posting cadence based on gap depth and selected influencers",
                status="success",
                output=recommendation_output,
                error=None,
            ),
        ]

        return GapAnalysisResponse(
            message="Gap analysis completed for selected influencers. Review strategy, then generate posts in the next step.",
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
            
            # Update user schedule if present, but keep the posting time fixed at 11:00 AM UTC.
            out_data = ar_posts.get("output", {})
            if "posting_schedule_days" in out_data:
                user.posting_schedule = out_data["posting_schedule_days"]
            user.posting_time_utc = "11:00"
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

        if ar_email.get("status") != "success":
            detail = ar_email.get("error") or ar_email.get("output", {}).get("message") or "Email delivery failed"
            raise HTTPException(status_code=502, detail=detail)

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
        if isinstance(e, HTTPException):
            raise
        import traceback
        print(f"Reminder email error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Reminder email failed: {str(e)}")


@router.post("/pipeline/send-post-email", response_model=GapAnalysisResponse)
async def send_post_email(request: SendPostEmailRequest, db: AsyncSession = Depends(get_db)):
    """Send generated LinkedIn posts to the user's registered Outlook email."""
    user_result = await db.execute(select(User).where(User.id == request.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    posts_payload = request.posts_data or {}
    posts = posts_payload.get("posts") if isinstance(posts_payload, dict) else None
    if not isinstance(posts, list) or not posts:
        raise HTTPException(status_code=400, detail="No generated posts found to send")

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
            detail="Generate posts after influencer selection and gap analysis before sending email.",
        )

    try:
        ar_email = await run_email_reminder(user.email, posts_payload)

        if ar_email.get("status") != "success":
            detail = ar_email.get("error") or ar_email.get("output", {}).get("message") or "Email delivery failed"
            raise HTTPException(status_code=502, detail=detail)

        db.add(AgentOutput(
            user_id=user.id,
            agent_name="LinkedIn Post Delivery Agent",
            agent_description="Sends generated LinkedIn posts to the user's registered Outlook inbox",
            status=ar_email["status"],
            output_data=ar_email.get("output"),
            error_message=ar_email.get("error"),
        ))
        await db.commit()

        return GapAnalysisResponse(
            message="Generated posts sent to registered email successfully",
            results=[
                AgentResult(
                    agent_name="LinkedIn Post Delivery Agent",
                    agent_description="Sends generated LinkedIn posts to the user's registered Outlook inbox",
                    status=ar_email["status"],
                    output=ar_email.get("output"),
                    error=ar_email.get("error"),
                )
            ],
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        import traceback
        print(f"Post delivery email error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Post delivery email failed: {str(e)}")


@router.get("/posting-schedule/{user_id}")
async def get_posting_schedule(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get the user's automated posting schedule and next scheduled posts."""
    try:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get next 10 scheduled posts
        posts_result = await db.execute(
            select(LinkedInPost)
            .where(LinkedInPost.user_id == user_id)
            .order_by(LinkedInPost.scheduled_for)
            .limit(10)
        )
        scheduled_posts = posts_result.scalars().all()
        
        schedule_info = {
            "user_id": user_id,
            "posting_schedule_days": user.posting_schedule or [],
            "posting_time_utc": user.posting_time_utc or "10:00",
            "last_automated_post_at": user.last_automated_post_at.isoformat() if user.last_automated_post_at else None,
            "next_scheduled_posts": [
                {
                    "id": post.id,
                    "type": post.post_type,
                    "scheduled_for": post.scheduled_for.isoformat() if post.scheduled_for else None,
                    "content_preview": post.content[:100] + "..." if len(post.content) > 100 else post.content,
                    "sent_to_email": post.sent_to_email,
                }
                for post in scheduled_posts
            ],
            "total_posts_count": len(scheduled_posts),
        }
        
        return schedule_info
    except Exception as e:
        import traceback
        print(f"Get posting schedule error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to get posting schedule: {str(e)}")


@router.get("/generated-posts/{user_id}")
async def get_generated_posts(user_id: int, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Get all generated posts for a user with full content."""
    try:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get all posts ordered by creation date
        posts_result = await db.execute(
            select(LinkedInPost)
            .where(LinkedInPost.user_id == user_id)
            .order_by(LinkedInPost.created_at.desc())
            .limit(limit)
        )
        posts = posts_result.scalars().all()
        
        posts_data = [
            {
                "id": post.id,
                "type": post.post_type,
                "content": post.content,
                "goal": post.goal,
                "scheduled_for": post.scheduled_for.isoformat() if post.scheduled_for else None,
                "sent_to_email": post.sent_to_email,
                "created_at": post.created_at.isoformat(),
            }
            for post in posts
        ]
        
        return {
            "user_id": user_id,
            "total_posts": len(posts_data),
            "posts": posts_data,
        }
    except Exception as e:
        import traceback
        print(f"Get generated posts error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to get generated posts: {str(e)}")


@router.get("/pipeline/saved-posts/{user_id}")
async def get_saved_posts(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get all saved LinkedIn posts for a user."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(LinkedInPost)
        .where(LinkedInPost.user_id == user_id)
        .order_by(LinkedInPost.created_at.desc())
    )
    posts = result.scalars().all()

    return {
        "posts": [
            {
                "id": p.id,
                "type": p.post_type,
                "content": p.content,
                "goal": p.goal,
                "scheduled_for": p.scheduled_for.isoformat() if p.scheduled_for else None,
                "sent_to_email": p.sent_to_email,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in posts
        ],
        "total": len(posts),
    }
