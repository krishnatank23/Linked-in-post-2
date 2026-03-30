from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import asyncio
import os
import traceback

from database import get_db
from models import User, AgentOutput
from schemas import (
    PipelineRequest, PipelineResponse, AgentResult,
    GapAnalysisRequest, GapAnalysisResponse, SaveResultRequest,
    GeneratePostsRequest, SendReminderRequest,
    StepResumeParserRequest, StepBrandVoiceRequest, StepInfluencerScoutRequest, StepResponse,
)
from agents.resume_parser_agent import run_resume_parser
from agents.brand_voice_agent import run_brand_voice_agent
from agents.influencer_agent import run_influencer_search
from agents.workflow import run_pipeline
from agents.gap_analyzer_agent import run_gap_analysis
from agents.post_generator_agent import run_post_generation
from agents.email_reminder_agent import run_email_reminder
from agents.groq_guard import set_current_user_context
from agents.runtime_status import get_status, clear_status


router = APIRouter(prefix="/api", tags=["pipeline"])
PIPELINE_TIMEOUT_SECONDS = int(os.getenv("PIPELINE_TIMEOUT_SECONDS", "600"))


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
        
        # Timeout guard for end-to-end pipeline execution, including throttled image generation.
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


# ──────────────────────────────────────────────────────────────────────────────
# Step-by-Step Pipeline Endpoints (Wizard Flow)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/pipeline/step/resume-parser", response_model=StepResponse)
async def step_resume_parser(request: StepResumeParserRequest, db: AsyncSession = Depends(get_db)):
    """Step 1: Run only the Resume Parser agent."""
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.resume_path:
        raise HTTPException(status_code=400, detail="No resume uploaded for this user")

    # Clear previous agent outputs for a fresh run
    prev_outputs = await db.execute(select(AgentOutput).where(AgentOutput.user_id == user.id))
    for output in prev_outputs.scalars().all():
        await db.delete(output)
    await db.commit()

    try:
        set_current_user_context(user.id)
        clear_status(user.id)

        ar = await asyncio.wait_for(
            run_resume_parser(user.resume_path),
            timeout=PIPELINE_TIMEOUT_SECONDS,
        )

        agent_output = AgentOutput(
            user_id=user.id,
            agent_name="Resume Parser Agent",
            agent_description="Extracts personal info, experience, skills, education, and all details from your resume using AI",
            status=ar["status"],
            output_data=ar.get("output"),
            error_message=ar.get("error"),
        )
        db.add(agent_output)
        await db.flush()

        # Cache parsed profile on user
        if ar.get("status") == "success" and ar.get("output"):
            user.parsed_profile_cache = ar["output"].get("parsed_profile")
            user.cache_updated_at = datetime.utcnow()

        await db.commit()

        return StepResponse(
            message="Resume parsed successfully" if ar["status"] == "success" else "Resume parsing failed",
            result=AgentResult(
                id=agent_output.id,
                agent_name=agent_output.agent_name,
                agent_description=agent_output.agent_description or "",
                status=ar["status"],
                output=ar.get("output"),
                error=ar.get("error"),
            ),
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Resume parsing timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {str(e)}")
    finally:
        set_current_user_context(None)
        clear_status(user.id)


@router.post("/pipeline/step/brand-voice", response_model=StepResponse)
async def step_brand_voice(request: StepBrandVoiceRequest, db: AsyncSession = Depends(get_db)):
    """Step 2: Run only the Brand Voice agent using parsed profile from step 1."""
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        set_current_user_context(user.id)
        clear_status(user.id)

        ar = await asyncio.wait_for(
            run_brand_voice_agent(request.parsed_profile),
            timeout=PIPELINE_TIMEOUT_SECONDS,
        )

        agent_output = AgentOutput(
            user_id=user.id,
            agent_name="Brand Voice & Persona Agent",
            agent_description="Generates your professional identity, brand voice, and personal summary based on your profile",
            status=ar["status"],
            output_data=ar.get("output"),
            error_message=ar.get("error"),
        )
        db.add(agent_output)
        await db.flush()

        # Cache brand voice on user
        if ar.get("status") == "success" and ar.get("output"):
            user.brand_voice_cache = ar["output"].get("brand_analysis")
            user.cache_updated_at = datetime.utcnow()

        await db.commit()

        return StepResponse(
            message="Brand voice generated successfully" if ar["status"] == "success" else "Brand voice generation failed",
            result=AgentResult(
                id=agent_output.id,
                agent_name=agent_output.agent_name,
                agent_description=agent_output.agent_description or "",
                status=ar["status"],
                output=ar.get("output"),
                error=ar.get("error"),
            ),
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Brand voice generation timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brand voice generation failed: {str(e)}")
    finally:
        set_current_user_context(None)
        clear_status(user.id)


@router.post("/pipeline/step/influencer-scout", response_model=StepResponse)
async def step_influencer_scout(request: StepInfluencerScoutRequest, db: AsyncSession = Depends(get_db)):
    """Step 3: Run only the Influencer Scout agent using profile + brand voice."""
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        set_current_user_context(user.id)
        clear_status(user.id)

        ar = await asyncio.wait_for(
            run_influencer_search(request.parsed_profile, request.brand_voice),
            timeout=PIPELINE_TIMEOUT_SECONDS,
        )

        agent_output = AgentOutput(
            user_id=user.id,
            agent_name="Influence & Idol Scout Agent",
            agent_description="Finds your industry idols and top LinkedIn influencers matching your professional domain",
            status=ar["status"],
            output_data=ar.get("output"),
            error_message=ar.get("error"),
        )
        db.add(agent_output)
        await db.flush()
        await db.commit()

        return StepResponse(
            message="Influencer search completed" if ar["status"] == "success" else "Influencer search failed",
            result=AgentResult(
                id=agent_output.id,
                agent_name=agent_output.agent_name,
                agent_description=agent_output.agent_description or "",
                status=ar["status"],
                output=ar.get("output"),
                error=ar.get("error"),
            ),
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Influencer search timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Influencer search failed: {str(e)}")
    finally:
        set_current_user_context(None)
        clear_status(user.id)


@router.post("/pipeline/gap-analysis", response_model=GapAnalysisResponse)
async def perform_gap_analysis(request: GapAnalysisRequest, db: AsyncSession = Depends(get_db)):
    """Analyze the gap between a user and selected influencer(s)."""
    # Enforce explicit influencer selection before running gap analysis.
    raw_influencer_data = request.influencer_data
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

    if not valid_influencers:
        raise HTTPException(
            status_code=400,
            detail="Please select at least one valid influencer from the list before running gap analysis."
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

    # 5. Run Gap Analysis & Post Generation Agents
    try:
        # Run Gap Analysis
        ar_gap = await run_gap_analysis(profile_data, brand_voice, influencer_payload)
        
        results = [
            AgentResult(
                agent_name="Gap Analysis & Content Strategist",
                agent_description="Identifies professional gaps and provides a custom LinkedIn content plan",
                status=ar_gap["status"],
                output=ar_gap["output"],
                error=ar_gap.get("error"),
            )
        ]
        
        return GapAnalysisResponse(
            message="Gap analysis completed successfully. Strategy is ready for review.",
            results=results
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
