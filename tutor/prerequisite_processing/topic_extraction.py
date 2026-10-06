"""Candidate topic extraction from textbook excerpts, name normalization, and deduplication."""

import json
import logging
import re
from typing import Any, Callable, Dict, List

logger = logging.getLogger(__name__)


def parse_json_safely(text: str) -> Any:
    """Extracts and parses JSON from text, handling markdown code fences and minor syntax anomalies."""
    text = text.strip()
    # Find json block inside ```json ... ``` or ``` ... ```
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1).strip()

    # If text still contains non-json wrappers, find outermost { ... } or [ ... ]
    if not (text.startswith("{") or text.startswith("[")):
        bracket_match = re.search(r"([\{\[][\s\S]*[\}\]])", text)
        if bracket_match:
            text = bracket_match.group(1).strip()

    # Try direct json parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Attempt basic repairs: remove trailing commas before } or ]
    repaired = re.sub(r",\s*([\}\]])", r"\1", text)
    try:
        return json.loads(repaired)
    except Exception:
        pass

    # Attempt repair for truncated JSON by closing open quotes and braces
    try:
        last_quote = text.rfind('"')
        if last_quote > 0:
            trimmed = text[: last_quote + 1]
            open_braces = max(0, trimmed.count("{") - trimmed.count("}"))
            open_brackets = max(0, trimmed.count("[") - trimmed.count("]"))
            repaired_trunc = trimmed + ("]" * open_brackets) + ("}" * open_braces)
            return json.loads(repaired_trunc)
    except Exception:
        pass

    logger.warning("Failed to parse JSON response safely.")
    return None


def normalize_topic_name(topic: str) -> str:
    """Normalizes topic names: strips numbering, trims extra punctuation, and standardizes casing."""
    t = topic.strip()
    # Remove leading numbering like "1. ", "1.2 ", "Unit 1: ", "Chapter 2 - "
    t = re.sub(
        r"^(unit\s+[ivx\d]+|chapter\s+\d+|\d+(\.\d+)*)\s*[:\-\.]?\s*",
        "",
        t,
        flags=re.IGNORECASE,
    ).strip()
    # Strip remaining leading punctuation/dashes
    t = t.lstrip(":-. ").strip()
    # Remove trailing periods or colons
    t = re.sub(r"[:\.]+$", "", t).strip()
    # Collapse multiple whitespace
    t = re.sub(r"\s+", " ", t)
    return t


def deduplicate_and_filter_topics(
    raw_topics: List[str], max_topics: int = 35
) -> List[str]:
    """Normalizes and deduplicates candidate topics while preserving high coverage and filtering noise words."""
    noise_set = {
        "introduction",
        "overview",
        "summary",
        "conclusion",
        "table of contents",
        "index",
        "syllabus",
        "unit",
        "chapter",
        "exercise",
        "exercises",
        "references",
        "appendix",
        "author",
        "authors",
        "title",
        "s.no",
        "question",
        "questions",
        "solution",
        "solutions",
        "example",
        "examples",
        "notes",
    }

    normalized_map: Dict[str, str] = {}
    for raw in raw_topics:
        norm = normalize_topic_name(raw)
        if not norm or len(norm) < 2:
            continue
        lower = norm.lower()
        if lower in noise_set:
            continue

        matched_key = None
        if lower in normalized_map:
            matched_key = lower
        elif lower.endswith("s") and lower[:-1] in normalized_map:
            matched_key = lower[:-1]
        elif lower + "s" in normalized_map:
            matched_key = lower + "s"

        if matched_key:
            existing = normalized_map[matched_key]
            if len(norm) < len(existing) or (norm.istitle() and not existing.istitle()):
                normalized_map[matched_key] = norm
        else:
            normalized_map[lower] = norm

    final_topics = list(normalized_map.values())
    if len(final_topics) > max_topics:
        final_topics = sorted(
            final_topics, key=lambda t: (len(t.split()), len(t)), reverse=True
        )[:max_topics]
    return sorted(final_topics)


def extract_candidate_topics_from_chunk(
    chunk_text: str, call_llm_fn: Callable[[str, str], str]
) -> List[str]:
    """Extracts candidate educational concepts from a text chunk via LLM."""
    prompt = f"""Analyze the educational document excerpt below and identify all important learning topics and core concepts covered.

STRICT GUIDELINES:
1. High Coverage of Core Topics: Include major concepts, methods, algorithms, theories, techniques, and substantive learning subtopics.
2. NO Trivial Micro-Topics: Do NOT extract syntax details, variable declarations, coding examples, trivial exercises, page numbers, author names, course codes, or administrative headings (e.g., exclude "Array Declaration", "Array Syntax", "Example 1", "Unit 1", "S.No", "Summary").
3. Return ONLY a valid JSON array of clean, concise topic strings.

Document Excerpt:
----------------------------------------
{chunk_text[:7000]}
----------------------------------------

Return format:
["Topic Name 1", "Topic Name 2", ...]
"""
    response_text = call_llm_fn(
        prompt,
        "You are an expert curriculum topic extraction engine. Output only valid JSON arrays.",
    )
    parsed = parse_json_safely(response_text)
    if isinstance(parsed, list):
        return [
            str(item).strip()
            for item in parsed
            if isinstance(item, (str, int)) and str(item).strip()
        ]
    return []
