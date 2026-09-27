import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from user_view import QueryProcessor


@pytest.fixture
def processor():
    return QueryProcessor()


def test_process_query_preserves_natural_language_and_level(processor):
    result = processor.process_query("How does the stack work?", "beginner")

    assert result["level"] == "beginner"
    assert result["query"] == "How does the stack work?"


def test_process_query_cleans_extra_whitespace(processor):
    result = processor.process_query("   Explain    binary   search   ", "intermediate")

    assert result["level"] == "intermediate"
    assert result["query"] == "Explain binary search"
