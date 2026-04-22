import os
import json
import traceback
from typing import Any

import requests

from env_config import load_backend_env

load_backend_env()


def _normalize_linkedin_url(raw_url: str) -> str:
    url = (raw_url or "").strip()
    if not url:
        raise ValueError("No LinkedIn URL provided")

    if url.startswith("http://") or url.startswith("https://"):
        return url

    if url.startswith("www."):
        return f"https://{url}"

    if url.startswith("linkedin.com/"):
        return f"https://{url}"

    return f"https://www.linkedin.com/{url.lstrip('/')}"


def _load_phantombuster_url(request_url: str | None = None) -> str:
    configured = (
        request_url
        or os.getenv("PHANTOMBUSTER_SCRAPER_URL")
        or os.getenv("PHANTOMBUSTER_WEBHOOK_URL")
        or os.getenv("LINKEDIN_SCRAPING_URL")
        or os.getenv("LINKEDIN_SCRAPING_WEBHOOK_URL")
        or ""
    ).strip()
    if not configured:
        raise ValueError(
            "PhantomBuster scraper URL is missing. Set PHANTOMBUSTER_SCRAPER_URL or LINKEDIN_SCRAPING_URL in backend/.env, or send phantombuster_url in the request."
        )
    return configured


def _load_phantombuster_api_key() -> str:
    return (
        os.getenv("LINKEDIN_SCRAPING_API_KEY")
        or os.getenv("PHANTOMBUSTER_API_KEY")
        or os.getenv("PHANTOMBUSTER_KEY")
        or ""
    ).strip()


async def run_linkedin_post_scraper(
    selected_url: str,
    phantombuster_url: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    """Forward the selected LinkedIn URL to a PhantomBuster webhook/agent endpoint."""
    try:
        normalized_url = _normalize_linkedin_url(selected_url)
        scrape_endpoint = _load_phantombuster_url(phantombuster_url)
        api_key = _load_phantombuster_api_key()

        payload = {
            "selected_url": normalized_url,
            "linkedin_url": normalized_url,
            "user_email": user_email,
            "source": "PostPilot AI",
        }

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["X-Phantombuster-Key"] = api_key

        response = requests.post(
            scrape_endpoint,
            json=payload,
            headers=headers,
            timeout=120,
        )

        response_text = response.text.strip()
        response_data: Any
        try:
            response_data = response.json()
        except Exception:
            response_data = response_text

        if response.status_code >= 400:
            return {
                "status": "error",
                "output": None,
                "error": f"PhantomBuster scrape failed: {response.status_code} {response_text[:400]}",
            }

        return {
            "status": "success",
            "output": {
                "selected_url": normalized_url,
                "phantombuster_url": scrape_endpoint,
                "scrape_response": response_data,
                "raw_response": response_text,
            },
            "error": None,
        }
    except Exception as e:
        return {
            "status": "error",
            "output": None,
            "error": f"LinkedIn post scraping failed: {str(e)}\n{traceback.format_exc()}",
        }