"""Generates prerequisite relationships among candidate learning topics via LLM inference."""

import json
from typing import Callable, Dict, List

from tutor.prerequisite_processing.topic_extraction import parse_json_safely


def generate_prerequisite_graph(
    topics: List[str],
    doc_summary: str = "",
    call_llm_fn: Callable[[str, str], str] = None,
) -> Dict[str, List[str]]:
    """Prompts the LLM to infer educational prerequisites for each topic in the topic list.

    Enforces:
    - Only topics from the candidate list may be prerequisites.
    - 0 to 4 prerequisites max.
    - No self-dependencies.
    - Exact JSON format.
    """
    if not topics:
        return {}

    topics_json = json.dumps(topics, indent=2)

    prompt = f"""You are an educational prerequisite analysis system.

Analyze the supplied educational topics extracted from: {doc_summary or "Educational Document"}

Candidate Topics Set:
{topics_json}

CRITICAL RULES:
1. Prerequisite Definition:
   - For every topic, answer: "What does a learner genuinely need to understand BEFORE learning this topic?"
   - A related topic is NOT automatically a prerequisite.
     (e.g., Arrays and Linked Lists are both related data structures, but Arrays is NOT a prerequisite for Linked Lists).
2. Prerequisites Must Come From the Candidate Topics:
   - Only select prerequisites that exist EXACTLY in the candidate topics list above.
   - Do NOT invent external prerequisites.
3. Number of Prerequisites (0 to 4 max):
   - Foundational topics that do not require prior knowledge from this document MUST have 0 prerequisites ([]).
   - Use 1 prerequisite when one is sufficient.
   - Use 2 to 3 prerequisites when genuinely required.
   - 4 prerequisites only when strictly necessary. Never exceed 4 prerequisites.
   - DO NOT artificially add prerequisites.
4. No Self-Dependencies:
   - A topic CANNOT be its own prerequisite.
5. No Circular Dependencies:
   - If topic A is a prerequisite for topic B, then topic B cannot be a prerequisite for topic A.
6. Return Format:
    - Include every candidate topic exactly once as a key, even when its prerequisite list is empty.
    - Preserve candidate topic spelling exactly; do not create aliases or rename topics.
   Return ONLY valid JSON matching this exact structure:
{{
  "prerequisites": {{
    "Topic Name 1": [],
    "Topic Name 2": ["Topic Name 1"]
  }}
}}
"""
    response_text = call_llm_fn(
        prompt,
        "You are a strict educational prerequisite analysis system. Output only valid JSON.",
    )
    parsed = parse_json_safely(response_text)

    if (
        isinstance(parsed, dict)
        and "prerequisites" in parsed
        and isinstance(parsed["prerequisites"], dict)
    ):
        raw_graph = parsed["prerequisites"]
    elif isinstance(parsed, dict):
        raw_graph = parsed
    else:
        raw_graph = {}

    return raw_graph
