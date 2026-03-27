"""
LangGraph Workflow: Orchestrates Agent 1 (Resume Parser) → Agent 2 (Brand Voice Generator)
Each node runs independently and captures its own output/errors.
"""
import json
from typing import TypedDict, Any, Optional
from langgraph.graph import StateGraph, END

from agents.resume_parser_agent import run_resume_parser
from agents.brand_voice_agent import run_brand_voice_agent
from agents.influencer_agent import run_influencer_search
from agents.gap_analyzer_agent import run_gap_analysis
from agents.post_generator_agent import run_post_generation
from agents.email_reminder_agent import run_email_reminder


class PipelineState(TypedDict):
    """State passed through the LangGraph pipeline."""
    resume_path: str
    user_email: Optional[str]
    agent_results: list[dict[str, Any]]
    parsed_profile: Optional[dict]
    brand_voice: Optional[dict]
    selected_influencer: Optional[dict]
    gap_analysis: Optional[dict]
    post_generation_output: Optional[dict]


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
        
        if result["status"] == "success" and result["output"]:
            state["brand_voice"] = result["output"].get("brand_analysis", {})
        else:
            state["brand_voice"] = None

    state["agent_results"].append(agent_result)
    return state


async def influence_scout_node(state: PipelineState) -> PipelineState:
    """Node 3: Identify influencers and idols based on profile and brand voice."""
    if state["parsed_profile"] is None or state["brand_voice"] is None:
        agent_result = {
            "agent_name": "Influence & Idol Scout Agent",
            "agent_description": "Finds your industry idols and top LinkedIn influencers matching your professional domain",
            "status": "error",
            "output": None,
            "error": "Skipped: Previous agents did not produce sufficient data",
        }
    else:
        result = await run_influencer_search(state["parsed_profile"], state["brand_voice"])
        agent_result = {
            "agent_name": "Influence & Idol Scout Agent",
            "agent_description": "Finds your industry idols and top LinkedIn influencers matching your professional domain",
            "status": result["status"],
            "output": result["output"],
            "error": result.get("error"),
        }

        influencers = (result.get("output") or {}).get("influencers") or []
        state["selected_influencer"] = influencers[0] if influencers else None

    state["agent_results"].append(agent_result)
    return state


async def gap_analysis_node(state: PipelineState) -> PipelineState:
    """Node 4: Analyze user-influencer gap and create strategy."""
    if state["parsed_profile"] is None or state["brand_voice"] is None:
        agent_result = {
            "agent_name": "Gap Analysis & Content Strategist",
            "agent_description": "Identifies professional gaps and creates a custom strategy to match top influencers",
            "status": "error",
            "output": None,
            "error": "Skipped: Missing parsed profile or brand voice data",
        }
        state["gap_analysis"] = None
    elif state["selected_influencer"] is None:
        agent_result = {
            "agent_name": "Gap Analysis & Content Strategist",
            "agent_description": "Identifies professional gaps and creates a custom strategy to match top influencers",
            "status": "error",
            "output": None,
            "error": "Skipped: No influencers found from search query",
        }
        state["gap_analysis"] = None
    else:
        result = await run_gap_analysis(
            state["parsed_profile"],
            state["brand_voice"],
            state["selected_influencer"],
        )
        agent_result = {
            "agent_name": "Gap Analysis & Content Strategist",
            "agent_description": "Identifies professional gaps and creates a custom strategy to match top influencers",
            "status": result["status"],
            "output": result["output"],
            "error": result.get("error"),
        }

        if result["status"] == "success" and result["output"]:
            state["gap_analysis"] = result["output"]
        else:
            state["gap_analysis"] = None

    state["agent_results"].append(agent_result)
    return state


async def post_generation_node(state: PipelineState) -> PipelineState:
    """Node 5: Generate ready-to-post LinkedIn content."""
    if state["parsed_profile"] is None or state["brand_voice"] is None or state["gap_analysis"] is None:
        agent_result = {
            "agent_name": "LinkedIn Post Generator",
            "agent_description": "Generates ready-to-publish posts tailored to your gap-analysis strategy",
            "status": "error",
            "output": None,
            "error": "Skipped: Gap analysis did not complete successfully",
        }
    else:
        result = await run_post_generation(
            state["parsed_profile"],
            state["brand_voice"],
            state["gap_analysis"],
        )
        agent_result = {
            "agent_name": "LinkedIn Post Generator",
            "agent_description": "Generates ready-to-publish posts tailored to your gap-analysis strategy",
            "status": result["status"],
            "output": result["output"],
            "error": result.get("error"),
        }

        if result["status"] == "success" and result["output"]:
            state["post_generation_output"] = result["output"]
        else:
            state["post_generation_output"] = None

    state["agent_results"].append(agent_result)
    return state



async def email_reminder_node(state: PipelineState) -> PipelineState:
    """Node 7: Send email reminder with generated posts to user."""
    # Skip if no email or no posts were generated
    if not state.get("user_email") or state.get("post_generation_output") is None:
        agent_result = {
            "agent_name": "Email Reminder Agent",
            "agent_description": "Sends email reminder with LinkedIn posts and images to user's Outlook",
            "status": "skipped",
            "output": None,
            "error": "Skipped: No email provided or no posts generated",
        }
    else:
        result = await run_email_reminder(
            state.get("user_email"),
            state.get("post_generation_output", {}),
        )
        agent_result = {
            "agent_name": "Email Reminder Agent",
            "agent_description": "Sends email reminder with LinkedIn posts and images to user's Outlook",
            "status": result["status"],
            "output": result["output"],
            "error": result.get("error"),
        }
    
    state["agent_results"].append(agent_result)
    return state


def build_pipeline() -> StateGraph:
    """Build the LangGraph pipeline with first 3 agents only."""
    workflow = StateGraph(PipelineState)

    # Add nodes
    workflow.add_node("resume_parser", resume_parser_node)
    workflow.add_node("brand_voice", brand_voice_node)
    workflow.add_node("influence_scout", influence_scout_node)

    # Define edges: resume_parser → brand_voice → influence_scout → END
    workflow.set_entry_point("resume_parser")
    workflow.add_edge("resume_parser", "brand_voice")
    workflow.add_edge("brand_voice", "influence_scout")
    workflow.add_edge("influence_scout", END)

    return workflow.compile()


async def run_pipeline(resume_path: str, user_email: str = None) -> list[dict[str, Any]]:
    """Run the full pipeline and return per-agent results."""
    pipeline = build_pipeline()

    initial_state: PipelineState = {
        "resume_path": resume_path,
        "user_email": user_email,
        "agent_results": [],
        "parsed_profile": None,
        "brand_voice": None,
        "selected_influencer": None,
        "gap_analysis": None,
        "post_generation_output": None,
    }

    final_state = await pipeline.ainvoke(initial_state)
    return final_state["agent_results"]


def build_automated_pipeline() -> StateGraph:
    """Build the LangGraph pipeline for automated scheduled runs (skips agents 1 & 2)."""
    workflow = StateGraph(PipelineState)

    # Add nodes starting from Agent 3
    workflow.add_node("influence_scout", influence_scout_node)
    workflow.add_node("gap_analysis", gap_analysis_node)
    workflow.add_node("post_generation", post_generation_node)
    workflow.add_node("email_reminder", email_reminder_node)

    # Define edges: influence_scout → gap_analysis → post_generation → email_reminder → END
    workflow.set_entry_point("influence_scout")
    workflow.add_edge("influence_scout", "gap_analysis")
    workflow.add_edge("gap_analysis", "post_generation")
    workflow.add_edge("post_generation", "email_reminder")
    workflow.add_edge("email_reminder", END)

    return workflow.compile()


async def run_automated_pipeline(parsed_profile: dict, brand_voice: dict, user_email: str) -> list[dict[str, Any]]:
    """Run the automated scheduled pipeline using cached profile and brand voice."""
    pipeline = build_automated_pipeline()

    initial_state: PipelineState = {
        "resume_path": "",
        "user_email": user_email,
        "agent_results": [],
        "parsed_profile": parsed_profile,
        "brand_voice": brand_voice,
        "selected_influencer": None,
        "gap_analysis": None,
        "post_generation_output": None,
    }

    final_state = await pipeline.ainvoke(initial_state)
    return final_state["agent_results"]
