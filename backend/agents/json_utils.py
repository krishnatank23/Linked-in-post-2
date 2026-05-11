import ast
import json
import re
from typing import Any


def _strip_code_fences(text: str) -> str:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    if cleaned.lower().startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


def _extract_balanced_payload(text: str) -> str:
    cleaned = _strip_code_fences(text)
    if not cleaned:
        return cleaned

    openings = [(cleaned.find("{"), "{", "}"), (cleaned.find("["), "[", "]")]
    openings = [(idx, open_char, close_char) for idx, open_char, close_char in openings if idx != -1]
    if not openings:
        return cleaned

    start_index, open_char, close_char = min(openings, key=lambda item: item[0])
    depth = 0
    start = None
    for idx in range(start_index, len(cleaned)):
        char = cleaned[idx]
        if char == open_char:
            if depth == 0:
                start = idx
            depth += 1
        elif char == close_char and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                return cleaned[start:idx + 1].strip()

    return cleaned


def parse_llm_json_content(content: str) -> Any:
    """Parse common LLM JSON formatting noise into a Python object."""
    extracted = _extract_balanced_payload(content)
    candidates = [extracted]
    candidates.append(re.sub(r",\s*([}\]])", r"\1", extracted))

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    python_like = extracted
    if not python_like:
        return None

    python_like = re.sub(r"\bnull\b", "None", python_like, flags=re.IGNORECASE)
    python_like = re.sub(r"\btrue\b", "True", python_like, flags=re.IGNORECASE)
    python_like = re.sub(r"\bfalse\b", "False", python_like, flags=re.IGNORECASE)
    python_like = re.sub(r",\s*([}\]])", r"\1", python_like)
    
    try:
        return ast.literal_eval(python_like)
    except (SyntaxError, ValueError):
        # If even literal_eval fails, return the raw extracted text as a fallback 
        # or let the caller handle the fact it's not a dict/list.
        return extracted