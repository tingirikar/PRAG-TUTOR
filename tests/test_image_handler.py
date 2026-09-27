import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from image_handler import ImageHandler


def test_notes_mode_returns_only_note_images(tmp_path, monkeypatch):
    handler = ImageHandler(str(tmp_path), hf_api_key="test-key")
    document_image = {"url": "/images/relevant.png", "source": "document"}
    monkeypatch.setattr(handler, "generate_image", lambda topic, user_question: (_ for _ in ()).throw(AssertionError("AI should not run")))
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
    handler = ImageHandler(str(tmp_path), hf_api_key="test-key")
    monkeypatch.setattr(handler, "find_document_images", lambda matches, top_k: [])
    monkeypatch.setattr(handler, "generate_image", lambda topic, user_question: (_ for _ in ()).throw(AssertionError("AI should not run")))

    images = handler.get_images(
        matches=[],
        mode="notes",
    )

    assert images == []


def test_ai_mode_does_not_search_notes(tmp_path, monkeypatch):
    handler = ImageHandler(str(tmp_path), hf_api_key="test-key")
    fallback = {"url": "/images/generated/fallback.png", "source": "generated"}
    monkeypatch.setattr(handler, "generate_image", lambda topic, user_question: fallback)
    monkeypatch.setattr(handler, "find_document_images", lambda matches, top_k: (_ for _ in ()).throw(AssertionError("Notes should not run")))

    images = handler.get_images(
        matches=[],
        user_question="Explain binary search",
        topic="Binary Search",
        mode="ai",
    )

    assert images == [fallback]
