"""Prerequisite processing pipeline: topic extraction, graph building, validation, and storage."""

from tutor.prerequisite_processing.graph_builder import (
    generate_prerequisite_graph,
)
from tutor.prerequisite_processing.pipeline import PrerequisiteGenerator
from tutor.prerequisite_processing.storage import save_prerequisites_to_mongodb
from tutor.prerequisite_processing.text_cleaning import (
    clean_extracted_text,
    get_safe_filename,
)
from tutor.prerequisite_processing.topic_extraction import (
    deduplicate_and_filter_topics,
    extract_candidate_topics_from_chunk,
    normalize_topic_name,
    parse_json_safely,
)
from tutor.prerequisite_processing.validation import (
    break_cycles,
    remove_transitive_redundancies,
    validate_and_sanitize_graph,
)

__all__ = [
    "PrerequisiteGenerator",
    "clean_extracted_text",
    "get_safe_filename",
    "parse_json_safely",
    "normalize_topic_name",
    "deduplicate_and_filter_topics",
    "extract_candidate_topics_from_chunk",
    "generate_prerequisite_graph",
    "break_cycles",
    "remove_transitive_redundancies",
    "validate_and_sanitize_graph",
    "save_prerequisites_to_mongodb",
]
