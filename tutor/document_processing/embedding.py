"""Embedding generation utilities using SentenceTransformer with progress callbacks."""

from typing import Any, Callable, Dict, List, Optional, Tuple

from tutor.config import get_embedding_model
from tutor.document_processing.chunking import chunk_text, chunk_text_with_pages


def generate_embeddings(
    text: str,
    model=None,
) -> Tuple[List[str], Any]:
    """Generates embeddings for raw text by chunking it first."""
    if model is None:
        model = get_embedding_model()
    if model is None:
        raise RuntimeError("Embedding model is not available.")

    chunks = chunk_text(text)
    if not chunks:
        chunks = [text[:500]] if text.strip() else ["General course content"]
    embeddings = model.encode(chunks)
    return chunks, embeddings


def generate_embeddings_with_pages(
    pages: List[Tuple[int, str]],
    model=None,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> Tuple[List[Dict[str, Any]], List[Any]]:
    """Generates embeddings with page tracking for multi-modal support, batched with progress."""
    if model is None:
        model = get_embedding_model()
    if model is None:
        raise RuntimeError("Embedding model is not available.")

    chunk_data = chunk_text_with_pages(pages)
    if not chunk_data:
        full_text = " ".join(text for _, text in pages)
        chunk_data = [
            {
                "text": full_text[:500] if full_text.strip() else "General course content",
                "page_numbers": [0],
            }
        ]

    texts = [c["text"] for c in chunk_data]
    total_texts = len(texts)
    batch_size = 32
    all_embeddings = []

    for i in range(0, total_texts, batch_size):
        batch = texts[i : i + batch_size]
        emb_batch = model.encode(batch)
        all_embeddings.extend(emb_batch)
        if progress_callback:
            done_count = min(i + batch_size, total_texts)
            progress_callback(done_count, total_texts)

    return chunk_data, all_embeddings
