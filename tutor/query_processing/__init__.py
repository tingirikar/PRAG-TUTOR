"""Query processing pipeline: vector search, topic identification, prompt building, LLM generation."""

from tutor.query_processing.image_handler import ImageHandler
from tutor.query_processing.llm_provider import (
    call_llm_response,
    generate_local_response,
)
from tutor.query_processing.prompt_builder import build_dynamic_prompt
from tutor.query_processing.query_processor import QueryProcessor
from tutor.query_processing.response_generator import ResponseGenerator
from tutor.query_processing.topic_identifier import (
    get_all_prerequisites_data,
    get_documents_for_subject,
    get_prerequisites_for_subject,
    get_prerequisites_for_topic,
    identify_topic_from_rag,
    stem,
)
from tutor.query_processing.vector_search import (
    active_document_names,
    fetch_answer,
    is_active_document,
)

__all__ = [
    "QueryProcessor",
    "ImageHandler",
    "ResponseGenerator",
    "identify_topic_from_rag",
    "get_prerequisites_for_topic",
    "get_prerequisites_for_subject",
    "get_documents_for_subject",
    "get_all_prerequisites_data",
    "stem",
    "fetch_answer",
    "is_active_document",
    "active_document_names",
    "build_dynamic_prompt",
    "generate_local_response",
    "call_llm_response",
]
