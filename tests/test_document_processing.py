import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from document_processing import DocumentProcessor


def make_processor():
    processor = DocumentProcessor.__new__(DocumentProcessor)
    processor.pdf_dir = ""
    processor.index = None
    return processor


def test_chunk_text_ignores_short_lines_and_keeps_meaningful_text():
    processor = make_processor()
    text = "A\nBinary search trees organize values efficiently.\nEach node has a left and right child."

    chunks = processor.chunk_text(text, chunk_size=500)

    assert len(chunks) == 1
    assert "Binary search trees" in chunks[0]
    assert "Each node" in chunks[0]


def test_chunk_text_splits_large_content():
    processor = make_processor()
    text = "\n".join([
        "First section explains arrays and their indexed access.",
        "Second section explains linked lists and pointer traversal.",
        "Third section explains stacks and last in first out behavior.",
    ])

    chunks = processor.chunk_text(text, chunk_size=75)

    assert len(chunks) >= 2
    assert all(len(chunk) >= 30 for chunk in chunks)
