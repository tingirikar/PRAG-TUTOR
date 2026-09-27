import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from image_handler import ImageHandler


def test_notes_mode_returns_only_note_images(tmp_path, monkeypatch):
    handler = ImageHandler(str(tmp_path))
    document_image = {"url": "/images/relevant.png", "source": "document"}
    monkeypatch.setattr(
        handler,
        "find_document_images",
        lambda matches, top_k: [document_image],
    )

    images = handler.get_images(
        matches=[],
        mode="notes",
    )

    assert images == [document_image]


def test_notes_mode_returns_empty_without_note_images(tmp_path, monkeypatch):
    handler = ImageHandler(str(tmp_path))
    monkeypatch.setattr(handler, "find_document_images", lambda matches, top_k: [])

    images = handler.get_images(
        matches=[],
        mode="notes",
    )

    assert images == []


def test_mermaid_mode_returns_empty_images(tmp_path):
    handler = ImageHandler(str(tmp_path))
    images = handler.get_images(
        matches=[{"metadata": {"document": "test.pdf"}}],
        user_question="Explain binary search",
        topic="Binary Search",
        mode="mermaid",
    )
    assert images == []


def test_none_mode_returns_empty_images(tmp_path):
    handler = ImageHandler(str(tmp_path))
    images = handler.get_images(
        matches=[{"metadata": {"document": "test.pdf"}}],
        user_question="Explain binary search",
        topic="Binary Search",
        mode="none",
    )
    assert images == []
