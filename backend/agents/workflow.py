"""
LangGraph Workflow: Orchestrates Agent 1 (Resume Parser) → Agent 2 (Brand Voice Generator)
Each node runs independently and captures its own output/errors.
"""
import json
from typing import TypedDict, Any, Optional
from langgraph.graph import StateGraph, END

from agents.resume_parser_agent import run_resume_parser
from agents.brand_voice_agent import run_brand_voice_agent


class PipelineState(TypedDict):
    """State passed through the LangGraph pipeline."""
    resume_path: str
    agent_results: list[dict[str, Any]]
    parsed_profile: Optional[dict]


async def resume_parser_node(state: PipelineState) -> PipelineState:
    """Node 1: Parse resume and extract structured data."""
    result = await run_resume_parser(state["resume_path"])

    agent_result = {
        "agent_name": "Resume Parser Agent",
        "agent_description": "Extracts personal info, experience, skills, education, and all details from your resume using AI",
        "status": result["status"],
        "output": result["output"],
        "error": result.get("error"),
    }

    state["agent_results"].append(agent_result)

    # Pass parsed profile to next agent if successful
    if result["status"] == "success" and result["output"]:
        state["parsed_profile"] = result["output"].get("parsed_profile", {})
    else:
        state["parsed_profile"] = None

    return state


async def brand_voice_node(state: PipelineState) -> PipelineState:
    """Node 2: Generate brand voice and persona from parsed profile."""
    if state["parsed_profile"] is None:
        agent_result = {
            "agent_name": "Brand Voice & Persona Agent",
            "agent_description": "Generates your professional identity, brand voice, and personal summary based on your profile",
            "status": "error",
            "output": None,
            "error": "Skipped: Resume parser did not produce valid output",
        }
    else:
        result = await run_brand_voice_agent(state["parsed_profile"])
        agent_result = {
            "agent_name": "Brand Voice & Persona Agent",
            "agent_description": "Generates your professional identity, brand voice, and personal summary based on your profile",
            "status": result["status"],
            "output": result["output"],
            "error": result.get("error"),
        }

    state["agent_results"].append(agent_result)
    return state


def build_pipeline() -> StateGraph:
    """Build the LangGraph pipeline with 2 agents."""
    workflow = StateGraph(PipelineState)

    # Add nodes
    workflow.add_node("resume_parser", resume_parser_node)
    workflow.add_node("brand_voice", brand_voice_node)

    # Define edges: resume_parser → brand_voice → END
    workflow.set_entry_point("resume_parser")
    workflow.add_edge("resume_parser", "brand_voice")
    workflow.add_edge("brand_voice", END)

    return workflow.compile()


async def run_pipeline(resume_path: str) -> list[dict[str, Any]]:
    """Run the full pipeline and return per-agent results."""
    pipeline = build_pipeline()

    initial_state: PipelineState = {
        "resume_path": resume_path,
        "agent_results": [],
        "parsed_profile": None,
    }

    final_state = await pipeline.ainvoke(initial_state)
    return final_state["agent_results"]
