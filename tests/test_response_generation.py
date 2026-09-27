import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from response_generation import ResponseGenerator


class FakeIndex:
    def __init__(self, matches):
        self.matches = matches

    def query(self, **kwargs):
        return {"matches": self.matches}


def test_fetch_answer_excludes_vectors_for_deleted_documents(tmp_path):
    (tmp_path / "active.pdf").write_bytes(b"active")
    generator = ResponseGenerator.__new__(ResponseGenerator)
    generator.documents_dir = str(tmp_path)
    generator.index = FakeIndex([
        {"id": "deleted.pdf_0", "score": 0.9, "metadata": {
            "document": "deleted.pdf", "sentence": "stale content"
        }},
        {"id": "active.pdf_0", "score": 0.8, "metadata": {
            "document": "active.pdf", "sentence": "current content"
        }},
    ])

    matches = generator.fetch_answer([0.1, 0.2])

    assert [match["metadata"]["document"] for match in matches] == ["active.pdf"]


def test_build_dynamic_prompt_requires_grounded_beginner_response():
    generator = ResponseGenerator.__new__(ResponseGenerator)

    prompt = generator.build_dynamic_prompt(
        context="A stack follows the last-in, first-out principle.",
        level="beginner",
        user_question="Explain stacks",
        topic="Stack",
    )

    assert "v2-grounded-tutor" in prompt
    assert "<course_material>" in prompt
    assert "use the course material for factual claims" in prompt.lower()
    assert "This is not covered in the available course material." in prompt
    assert "check-for-understanding question" in prompt


def test_build_dynamic_prompt_keeps_prerequisites_before_topic_explanation():
    generator = ResponseGenerator.__new__(ResponseGenerator)

    prompt = generator.build_dynamic_prompt(
        context="A binary search tree stores smaller values to the left.",
        level="intermediate",
        prerequisites=["Binary Trees"],
        user_question="Explain binary search trees",
        topic="Binary Search Tree",
    )

    assert "<prerequisites>Binary Trees</prerequisites>" in prompt
    assert prompt.index("Prerequisite Overview") < prompt.index("Main Topic Explanation")
    assert "one short check-for-understanding question" in prompt