import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from user_view import QueryProcessor


@pytest.fixture
def processor():
    return QueryProcessor()


def test_process_query_removes_stop_words_and_preserves_level(processor):
    result = processor.process_query("How does the stack work?", "beginner")

    assert result["level"] == "beginner"
    assert "stack" in result["query"].lower()
    assert "work" in result["query"].lower()
    assert " the " not in f" {result['query'].lower()} "


def test_preprocess_query_removes_punctuation(processor):
    result = processor.preprocess_query("Binary-search, trees!")

    assert result == "Binary search trees"
