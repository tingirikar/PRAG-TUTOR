"""Text chunking utilities with sliding window and page span tracking."""

from typing import Any, Dict, List, Set, Tuple


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
    """Chunks raw text into segments of approximately chunk_size characters."""
    raw_lines = [line.strip() for line in text.split("\n") if line.strip()]
    chunks = []
    current_chunk = []
    current_len = 0

    for line in raw_lines:
        if len(line) < 4:
            continue
        if current_len + len(line) > chunk_size and current_chunk:
            chunk_str = " ".join(current_chunk)
            if len(chunk_str) >= 30:
                chunks.append(chunk_str)
            current_chunk = [line]
            current_len = len(line)
        else:
            current_chunk.append(line)
            current_len += len(line)

    if current_chunk:
        chunk_str = " ".join(current_chunk)
        if len(chunk_str) >= 30:
            chunks.append(chunk_str)

    return chunks


def chunk_text_with_pages(
    pages: List[Tuple[int, str]], chunk_size: int = 500
) -> List[Dict[str, Any]]:
    """Chunks text while tracking which page(s) each chunk came from.

    Args:
        pages: List of (page_number, page_text) tuples.
        chunk_size: Maximum characters per chunk.

    Returns:
        List of dicts: [{"text": "...", "page_numbers": [0, 1]}, ...]
    """
    chunks = []
    current_chunk_lines: List[str] = []
    current_chunk_pages: Set[int] = set()
    current_len = 0

    for page_num, page_text in pages:
        raw_lines = [line.strip() for line in page_text.split("\n") if line.strip()]
        for line in raw_lines:
            if len(line) < 4:
                continue
            if current_len + len(line) > chunk_size and current_chunk_lines:
                chunk_str = " ".join(current_chunk_lines)
                if len(chunk_str) >= 30:
                    chunks.append(
                        {
                            "text": chunk_str,
                            "page_numbers": sorted(current_chunk_pages),
                        }
                    )
                current_chunk_lines = [line]
                current_chunk_pages = {page_num}
                current_len = len(line)
            else:
                current_chunk_lines.append(line)
                current_chunk_pages.add(page_num)
                current_len += len(line)

    if current_chunk_lines:
        chunk_str = " ".join(current_chunk_lines)
        if len(chunk_str) >= 30:
            chunks.append(
                {
                    "text": chunk_str,
                    "page_numbers": sorted(current_chunk_pages),
                }
            )

    return chunks
