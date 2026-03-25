from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from database import get_db
from models import User, AgentOutput
from schemas import PipelineRequest, PipelineResponse, AgentResult
from agents.workflow import run_pipeline

router = APIRouter(prefix="/api", tags=["pipeline"])


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

    # Run the LangGraph pipeline
    agent_results = await run_pipeline(user.resume_path)

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

        response_results.append(AgentResult(
            agent_name=ar["agent_name"],
            agent_description=ar.get("agent_description", ""),
            status=ar["status"],
            output=ar.get("output"),
            error=ar.get("error"),
        ))

    await db.commit()

    return PipelineResponse(
        message="Pipeline execution completed",
        results=response_results,
    )


@router.get("/pipeline/results/{user_id}", response_model=PipelineResponse)
async def get_pipeline_results(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get the latest pipeline results for a user."""
    result = await db.execute(
        select(AgentOutput)
        .where(AgentOutput.user_id == user_id)
        .order_by(AgentOutput.created_at.asc())
    )
    outputs = result.scalars().all()

    if not outputs:
        raise HTTPException(status_code=404, detail="No pipeline results found")

    results = [
        AgentResult(
            agent_name=o.agent_name,
            agent_description=o.agent_description or "",
            status=o.status,
            output=o.output_data,
            error=o.error_message,
        )
        for o in outputs
    ]

    return PipelineResponse(message="Results retrieved", results=results)
