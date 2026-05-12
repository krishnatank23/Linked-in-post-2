import json

def dict_to_markdown_list(d, depth=0):
    """Recursively converts a dictionary to a dense Markdown bulleted list."""
    if not isinstance(d, dict) and not isinstance(d, list):
        return str(d)
        
    md = ""
    indent = "  " * depth
    
    if isinstance(d, dict):
        for k, v in d.items():
            clean_k = str(k).replace("_", " ").title()
            if isinstance(v, (dict, list)):
                if not v:
                    continue
                md += f"{indent}- **{clean_k}**:\n"
                md += dict_to_markdown_list(v, depth + 1)
            else:
                md += f"{indent}- **{clean_k}**: {v}\n"
    elif isinstance(d, list):
        for item in d:
            if isinstance(item, (dict, list)):
                md += dict_to_markdown_list(item, depth + 1)
            else:
                md += f"{indent}- {item}\n"
    return md

def format_profile_markdown_detailed(profile_data: dict) -> str:
    """Converts the massive resume JSON into a fully detailed Markdown string for Brand Voice agent."""
    if not profile_data:
        return "No profile data provided."
    md = "# DETAILED USER PROFILE\n"
    md += dict_to_markdown_list(profile_data)
    return md

def format_profile_markdown_short(profile_data: dict) -> str:
    """Extracts only the core summary from the resume JSON for Gap Analyzer and Post Generator to save tokens."""
    if not profile_data:
        return "No profile data provided."
    
    short_profile = {}
    for key in ["personal_info", "summary", "core_competencies", "skills", "current_role"]:
        if key in profile_data:
            short_profile[key] = profile_data[key]
            
    md = "# SHORT USER PROFILE SUMMARY\n"
    md += dict_to_markdown_list(short_profile)
    return md

def format_brand_voice_markdown(voice_data: dict) -> str:
    """Converts the brand voice JSON into a dense Markdown string."""
    if not voice_data:
        return "No brand voice data provided."
    md = "# BRAND VOICE & PERSONA\n"
    md += dict_to_markdown_list(voice_data)
    return md

def format_influencer_markdown(influencer_data: list | dict) -> str:
    """Converts influencer raw JSON into a highly compressed Markdown summary."""
    if not influencer_data:
        return "No influencer data provided."
    
    md = "# INFLUENCER DATA SUMMARY\n"
    if isinstance(influencer_data, dict):
        influencer_data = [influencer_data]
        
    for inf in influencer_data:
        name = inf.get("name") or inf.get("title") or "Unknown Influencer"
        md += f"\n## Influencer: {name}\n"
        
        # Only extract the most critical fields to save tokens
        critical_keys = ["manual_profile_text", "manual_post_samples", "content_pillars", "audience_demographic", "tone"]
        for k in critical_keys:
            if k in inf and inf[k]:
                clean_k = k.replace("_", " ").title()
                val = str(inf[k])
                # Truncate massive text blocks if they slipped through
                if len(val) > 1500:
                    val = val[:1500] + "... [truncated]"
                md += f"- **{clean_k}**: {val}\n"
    return md

def format_gap_analysis_markdown(gap_data: dict) -> str:
    """Converts the massive combined gap analysis JSON into a focused Markdown string."""
    if not gap_data:
        return "No gap analysis data provided."
        
    md = "# GAP ANALYSIS & STRATEGY SUMMARY\n"
    
    # Extract only the high-level strategy to pass to Post Generator (ignore raw influencer analyses)
    if "overall_gap_scores" in gap_data:
        md += "\n### Overall Match Scores\n"
        md += dict_to_markdown_list(gap_data["overall_gap_scores"])
        
    if "overall_gap_analysis" in gap_data:
        md += "\n### Identified Gaps\n"
        md += dict_to_markdown_list(gap_data["overall_gap_analysis"])
        
    if "overall_content_strategy" in gap_data:
        md += "\n### Content Strategy\n"
        md += dict_to_markdown_list(gap_data["overall_content_strategy"])
        
    if "overall_action_plan" in gap_data:
        md += "\n### Action Plan\n"
        md += dict_to_markdown_list(gap_data["overall_action_plan"])
        
    return md
