import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from prerequisite_generator import (
    PrerequisiteGenerator,
    clean_extracted_text,
    get_safe_filename,
)
from response_generation import ResponseGenerator


def make_generator():
    gen = PrerequisiteGenerator.__new__(PrerequisiteGenerator)
    gen.llm_api_key = None
    gen.groq_client = None
    return gen


def test_clean_extracted_text_removes_cids_and_normalizes():
    raw = "(cid:400)nd the (cid:415)tle of page 12\n\n\n3\n“Quoted Text” — with dashes."
    cleaned = clean_extracted_text(raw)
    assert "find the title" in cleaned
    assert '"Quoted Text"' in cleaned
    assert "- with dashes." in cleaned


def test_get_safe_filename():
    assert get_safe_filename("Course Description.pdf") == "Course_Description"
    assert get_safe_filename("Final-Unit-1-Notes.pdf") == "Final-Unit-1-Notes"
    assert get_safe_filename("My Class Notes (2026)!.pdf") == "My_Class_Notes_2026"


def test_break_cycles_resolves_direct_cycle():
    gen = make_generator()
    # A requires B, and B requires A
    cyclic_graph = {
        "A": ["B"],
        "B": ["A"],
    }
    dag = gen._break_cycles(cyclic_graph)
    # One of the back edges must have been removed
    assert not ("B" in dag.get("A", []) and "A" in dag.get("B", []))


def test_break_cycles_resolves_triangle_cycle():
    gen = make_generator()
    # A -> B -> C -> A
    cyclic_graph = {
        "A": ["B"],
        "B": ["C"],
        "C": ["A"],
    }
    dag = gen._break_cycles(cyclic_graph)
    # Check that at least one edge in the cycle was removed
    has_full_cycle = (
        "B" in dag.get("A", []) and
        "C" in dag.get("B", []) and
        "A" in dag.get("C", [])
    )
    assert not has_full_cycle


def test_remove_transitive_redundancies():
    gen = make_generator()
    # C requires B, B requires A; C also directly lists A (redundant)
    graph = {
        "A": [],
        "B": ["A"],
        "C": ["B", "A"],
    }
    reduced = gen._remove_transitive_redundancies(graph)
    assert "A" not in reduced["C"]
    assert "B" in reduced["C"]


def test_deduplicate_and_filter_topics():
    gen = make_generator()
    raw = [
        "1.1 Introduction",
        "Chapter 2 - Binary Trees",
        "Binary Tree",
        "Summary",
        "Unit 3: Graphs",
        "Graph Traversal",
    ]
    filtered = gen.deduplicate_and_filter_topics(raw)
    assert "Introduction" not in filtered
    assert "Summary" not in filtered
    # "Binary Tree" and "Binary Trees" deduplicated
    tree_topics = [t for t in filtered if "Binary Tree" in t]
    assert len(tree_topics) == 1
    assert "Graphs" in filtered
    assert "Graph Traversal" in filtered


def test_validate_and_sanitize_graph_caps_prereqs_and_removes_self():
    gen = make_generator()
    known = ["Topic A", "Topic B", "Topic C", "Topic D", "Topic E", "Topic F"]
    raw_graph = {
        "Topic A": ["Topic A", "Topic B", "Topic C", "Topic D", "Topic E", "Topic F"],
        "Nonexistent": ["Topic A"],
    }
    sanitized = gen.validate_and_sanitize_graph(raw_graph, known)
    # Topic A cannot require itself
    assert "Topic A" not in sanitized["Topic A"]
    # Prereqs capped at 4
    assert len(sanitized["Topic A"]) <= 4
    # Nonexistent topic dropped
    assert "Nonexistent" not in sanitized


def test_response_generator_aggregates_multiple_prerequisite_files(tmp_path):
    prereq_dir = tmp_path / "prerequisites"
    prereq_dir.mkdir()

    file1 = prereq_dir / "ds.json"
    file1.write_text(json.dumps({
        "prerequisites": {
            "Stack": [],
            "Queue": ["Stack"],
        }
    }), encoding="utf-8")

    file2 = prereq_dir / "ml.json"
    file2.write_text(json.dumps({
        "topics": [
            {"topic": "Regression", "prerequisites": ["Calculus"]},
            {"topic": "Calculus", "prerequisites": []},
        ]
    }), encoding="utf-8")

    gen = ResponseGenerator.__new__(ResponseGenerator)
    gen.prerequisites_data = {}
    
    loaded = gen._load_prerequisites(str(prereq_dir))
    assert "Stack" in loaded
    assert "Queue" in loaded
    assert "Regression" in loaded
    assert "Calculus" in loaded
    assert loaded["Queue"] == ["Stack"]
    assert loaded["Regression"] == ["Calculus"]

    # Test reload_prerequisites
    gen.reload_prerequisites(str(prereq_dir))
    assert gen.prerequisites_data["Queue"] == ["Stack"]
