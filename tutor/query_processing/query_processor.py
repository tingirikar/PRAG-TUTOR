"""Query pre-processing and whitespace normalization for semantic embeddings."""

from typing import Any, Dict


class QueryProcessor:
    """Prepares user queries for sentence-transformer semantic embedding.

    Preserves natural language phrasing and stop words to ensure maximum
    bi-encoder embedding accuracy with
    sentence-transformers/all-MiniLM-L6-v2.
    """

    def process_query(self, query: str, level: str = "beginner") -> Dict[str, Any]:
        clean_query = " ".join(query.strip().split()) if query else ""
        return {"query": clean_query, "level": level}
