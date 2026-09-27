import os
import re
import json
import logging
from typing import Dict, List, Set, Optional, Tuple, Any
from groq import Groq
import pdfplumber

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Text Cleaning & Normalization Utilities
# ---------------------------------------------------------------------------

# Common PDF ligatures and font encoding artifacts
CID_REPLACEMENTS = {
    "(cid:415)": "ti",
    "(cid:427)": "tt",
    "(cid:400)": "fi",
    "(cid:401)": "fl",
    "(cid:402)": "ff",
    "(cid:403)": "ffi",
    "(cid:404)": "ffl",
    "(cid:414)": "th",
    "(cid:426)": "tr",
    "(cid:428)": "tu",
    "(cid:429)": "ty",
}


def clean_extracted_text(text: str) -> str:
    """
    Cleans PDF extraction artifacts such as CID font issues, ligatures,
    and irregular whitespace.
    """
    if not text:
        return ""

    # Replace known CID ligatures
    for cid, rep in CID_REPLACEMENTS.items():
        text = text.replace(cid, rep)

    # Replace any remaining (cid:XXX) with an empty string or space
    text = re.sub(r'\(cid:\d+\)', '', text)

    # Normalize unicode quotes and dashes
    text = text.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")
    text = text.replace('—', '-').replace('–', '-')

    # Normalize whitespace while preserving line structure
    lines = [line.strip() for line in text.splitlines()]
    # Remove lines that are purely page numbers or standalone punctuation
    cleaned_lines = []
    for line in lines:
        if re.match(r'^(page\s*)?\d+$', line, re.IGNORECASE):
            continue
        if line:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def get_safe_filename(name: str) -> str:
    """
    Converts a document name into a safe filesystem stem.
    """
    stem = os.path.splitext(os.path.basename(name))[0]
    # Replace non-alphanumeric chars with underscore
    safe = re.sub(r'[^a-zA-Z0-9_\-]', '_', stem)
    # Collapse multiple underscores
    safe = re.sub(r'_+', '_', safe).strip('_')
    return safe or "document"


# ---------------------------------------------------------------------------
# PrerequisiteGenerator Engine
# ---------------------------------------------------------------------------

class PrerequisiteGenerator:
    """
    Automated educational prerequisite extraction and graph generation engine.
    Extracts candidate learning topics, filters micro-topics, determines educational
    prerequisites via LLM, enforces 0-4 prereq limits, and sanitizes against cycles
    and redundancies.
    """

    def __init__(
        self,
        llm_api_key: Optional[str] = None,
        model_name: str = "qwen/qwen3.8-27b",
        fallback_models: Optional[List[str]] = None,
        jsons_dir: Optional[str] = None,
    ):
        base_dir = os.path.dirname(os.path.abspath(__file__))

        # Resolve LLM API Key
        if not llm_api_key:
            llm_api_key = os.environ.get("GROQ_API_KEY", "").strip()

        self.llm_api_key = llm_api_key
        self.groq_client = Groq(api_key=llm_api_key) if llm_api_key else None
        self.model_name = model_name
        self.fallback_models = fallback_models or ["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "groq/compound-mini"]
        self.jsons_dir = jsons_dir or os.path.join(base_dir, "prerequisites")
        os.makedirs(self.jsons_dir, exist_ok=True)

    def extract_text_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extracts and cleans text page-by-page from a PDF.
        Uses high-speed PyMuPDF first, falling back to pdfplumber if needed.
        Returns a list of page dicts: [{"page": 1, "text": "..."}, ...].
        """
        pages = []
        if fitz is not None:
            try:
                doc = fitz.open(pdf_path)
                for idx, page in enumerate(doc, start=1):
                    raw = page.get_text() or ""
                    cleaned = clean_extracted_text(raw)
                    if cleaned.strip():
                        pages.append({"page": idx, "text": cleaned})
                doc.close()
                if pages:
                    return pages
            except Exception as e:
                logger.warning(f"PyMuPDF text extraction failed ({e}), falling back to pdfplumber...")

        with pdfplumber.open(pdf_path) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                raw = page.extract_text() or ""
                cleaned = clean_extracted_text(raw)
                if cleaned.strip():
                    pages.append({"page": idx, "text": cleaned})
        return pages

    def chunk_pages(
        self,
        pages: List[Dict[str, Any]],
        max_words_per_chunk: int = 6000,
        max_pages_per_chunk: int = 25
    ) -> List[str]:
        """
        Groups pages into cohesive chunks for candidate topic extraction,
        avoiding excessive token usage on large documents while minimizing
        round-trip API calls.
        """
        if not pages:
            return []

        # If document is small (<= 8 pages and moderate word count), return as single chunk
        total_words = sum(len(p["text"].split()) for p in pages)
        if len(pages) <= 8 and total_words <= 4000:
            return ["\n\n".join(p["text"] for p in pages)]

        chunks = []
        curr_chunk_texts = []
        curr_words = 0
        curr_pages = 0

        for page in pages:
            page_text = page["text"]
            words = len(page_text.split())

            if (curr_words + words > max_words_per_chunk or curr_pages >= max_pages_per_chunk) and curr_chunk_texts:
                chunks.append("\n\n".join(curr_chunk_texts))
                curr_chunk_texts = [page_text]
                curr_words = words
                curr_pages = 1
            else:
                curr_chunk_texts.append(page_text)
                curr_words += words
                curr_pages += 1

        if curr_chunk_texts:
            chunks.append("\n\n".join(curr_chunk_texts))

        return chunks

    def _call_llm(self, prompt: str, system_prompt: str = "You are an educational curriculum analysis system.", temperature: float = 0.1) -> str:
        """
        Helper to invoke Groq LLM with fallback support and thinking block stripping.
        """
        if not self.groq_client:
            raise ValueError("Groq client is not initialized. Please provide a valid GROQ_API_KEY.")

        candidate_models = [self.model_name]
        for fb in self.fallback_models:
            if fb not in candidate_models:
                candidate_models.append(fb)

        last_error = None
        for model in candidate_models:
            try:
                response = self.groq_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=temperature,
                    max_tokens=4096,
                )
                raw_content = response.choices[0].message.content or ""
                # Strip think blocks
                cleaned = re.sub(r'<think>.*?</think>', '', raw_content, flags=re.DOTALL)
                cleaned = re.sub(r'<think>.*', '', cleaned, flags=re.DOTALL)
                return cleaned.strip()
            except Exception as e:
                last_error = e
                continue

        raise RuntimeError(f"All Groq models failed. Last error: {last_error}")

    def _parse_json_safely(self, text: str) -> Any:
        """
        Extracts and parses JSON from text, handling markdown code fences
        and minor syntax anomalies safely.
        """
        text = text.strip()
        # Find json block inside ```json ... ``` or ``` ... ```
        fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text, re.IGNORECASE)
        if fence_match:
            text = fence_match.group(1).strip()

        # If text still contains non-json wrappers, find outermost { ... } or [ ... ]
        if not (text.startswith("{") or text.startswith("[")):
            bracket_match = re.search(r'([\{\[][\s\S]*[\}\]])', text)
            if bracket_match:
                text = bracket_match.group(1).strip()

        # Try direct json parse
        try:
            return json.loads(text)
        except Exception:
            pass

        # Attempt basic repairs: remove trailing commas before } or ]
        repaired = re.sub(r',\s*([\}\]])', r'\1', text)
        try:
            return json.loads(repaired)
        except Exception:
            pass

        # Attempt repair for truncated JSON by closing open quotes and braces
        try:
            last_quote = text.rfind('"')
            if last_quote > 0:
                trimmed = text[:last_quote + 1]
                open_braces = max(0, trimmed.count('{') - trimmed.count('}'))
                open_brackets = max(0, trimmed.count('[') - trimmed.count(']'))
                repaired_trunc = trimmed + ("]" * open_brackets) + ("}" * open_braces)
                return json.loads(repaired_trunc)
        except Exception:
            pass

        logger.warning(f"Failed to parse JSON response safely.")
        return None

    # ---------------------------------------------------------------------------
    # Step 1: Candidate Topic Extraction & Filtering
    # ---------------------------------------------------------------------------

    def extract_candidate_topics_from_chunk(self, chunk_text: str) -> List[str]:
        """
        Extracts candidate educational concepts from a text chunk.
        """
        prompt = f"""Analyze the educational document excerpt below and identify all important learning topics and core concepts covered.

STRICT GUIDELINES:
1. High Coverage of Core Topics: Include major concepts, methods, algorithms, theories, techniques, and substantive learning subtopics.
2. NO Trivial Micro-Topics: Do NOT extract syntax details, variable declarations, coding examples, trivial exercises, page numbers, author names, course codes, or administrative headings (e.g., exclude "Array Declaration", "Array Syntax", "Example 1", "Unit 1", "S.No", "Summary").
3. Return ONLY a valid JSON array of clean, concise topic strings.

Document Excerpt:
----------------------------------------
{chunk_text[:7000]}
----------------------------------------

Return format:
["Topic Name 1", "Topic Name 2", ...]
"""
        response_text = self._call_llm(
            prompt,
            system_prompt="You are an expert curriculum topic extraction engine. Output only valid JSON arrays."
        )
        parsed = self._parse_json_safely(response_text)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if isinstance(item, (str, int)) and str(item).strip()]
        return []

    def normalize_topic_name(self, topic: str) -> str:
        """
        Normalizes topic names: strips numbering, trims extra punctuation,
        and standardizes capitalization.
        """
        t = topic.strip()
        # Remove leading numbering like "1. ", "1.2 ", "Unit 1: ", "Chapter 2 - "
        t = re.sub(r'^(unit\s+[ivx\d]+|chapter\s+\d+|\d+(\.\d+)*)\s*[:\-\.]?\s*', '', t, flags=re.IGNORECASE).strip()
        # Strip remaining leading punctuation/dashes
        t = t.lstrip(':-. ').strip()
        # Remove trailing periods or colons
        t = re.sub(r'[:\.]+$', '', t).strip()
        # Collapse multiple whitespace
        t = re.sub(r'\s+', ' ', t)
        return t

    def deduplicate_and_filter_topics(self, raw_topics: List[str]) -> List[str]:
        """
        Normalizes and deduplicates candidate topics while preserving high coverage
        and filtering noise words.
        """
        # Noise words that should never be standalone topics
        noise_set = {
            "introduction", "overview", "summary", "conclusion", "table of contents",
            "index", "syllabus", "unit", "chapter", "exercise", "exercises", "references",
            "appendix", "author", "authors", "title", "s.no", "question", "questions",
            "solution", "solutions", "example", "examples", "notes"
        }

        normalized_map: Dict[str, str] = {}
        for raw in raw_topics:
            norm = self.normalize_topic_name(raw)
            if not norm or len(norm) < 2:
                continue
            lower = norm.lower()
            if lower in noise_set:
                continue
            # Check singular/plural or exact match in existing keys
            # E.g. "Binary Trees" vs "Binary Tree"
            matched_key = None
            if lower in normalized_map:
                matched_key = lower
            elif lower.endswith('s') and lower[:-1] in normalized_map:
                matched_key = lower[:-1]
            elif lower + 's' in normalized_map:
                matched_key = lower + 's'

            if matched_key:
                # Keep the more descriptive / canonical casing
                existing = normalized_map[matched_key]
                if len(norm) < len(existing) or (norm.istitle() and not existing.istitle()):
                    normalized_map[matched_key] = norm
            else:
                normalized_map[lower] = norm

        final_topics = list(normalized_map.values())
        # Cap candidate topics to top 35 core concepts to prevent output token explosion
        if len(final_topics) > 35:
            # Sort by length and specificity, retaining top 35
            final_topics = sorted(final_topics, key=lambda t: (len(t.split()), len(t)), reverse=True)[:35]
        return sorted(final_topics)

    # ---------------------------------------------------------------------------
    # Step 2: Prerequisite Relationship Inference
    # ---------------------------------------------------------------------------

    def generate_prerequisite_graph(
        self,
        topics: List[str],
        doc_summary: str = ""
    ) -> Dict[str, List[str]]:
        """
        Prompts the LLM to infer educational prerequisites for each topic in the topic list.
        """
        if not topics:
            return {}

        topics_json = json.dumps(topics, indent=2)

        prompt = f"""You are an educational prerequisite analysis system.

Analyze the supplied educational topics extracted from: {doc_summary or "Educational Document"}

Candidate Topics Set:
{topics_json}

CRITICAL RULES:
1. Prerequisite Definition:
   - For every topic, answer: "What does a learner genuinely need to understand BEFORE learning this topic?"
   - A related topic is NOT automatically a prerequisite.
     (e.g., Arrays and Linked Lists are both related data structures, but Arrays is NOT a prerequisite for Linked Lists).
2. Prerequisites Must Come From the Candidate Topics:
   - Only select prerequisites that exist EXACTLY in the candidate topics list above.
   - Do NOT invent external prerequisites.
3. Number of Prerequisites (0 to 4 max):
   - Foundational topics that do not require prior knowledge from this document MUST have 0 prerequisites ([]).
   - Use 1 prerequisite when one is sufficient.
   - Use 2 to 3 prerequisites when genuinely required.
   - 4 prerequisites only when strictly necessary. Never exceed 4 prerequisites.
   - DO NOT artificially add prerequisites.
4. No Self-Dependencies:
   - A topic CANNOT be its own prerequisite.
5. No Circular Dependencies:
   - If topic A is a prerequisite for topic B, then topic B cannot be a prerequisite for topic A.
6. Return Format:
    - Include every candidate topic exactly once as a key, even when its prerequisite list is empty.
    - Preserve candidate topic spelling exactly; do not create aliases or rename topics.
   Return ONLY valid JSON matching this exact structure:
{{
  "prerequisites": {{
    "Topic Name 1": [],
    "Topic Name 2": ["Topic Name 1"]
  }}
}}
"""
        response_text = self._call_llm(
            prompt,
            system_prompt="You are a strict educational prerequisite analysis system. Output only valid JSON."
        )
        parsed = self._parse_json_safely(response_text)

        if isinstance(parsed, dict) and "prerequisites" in parsed and isinstance(parsed["prerequisites"], dict):
            raw_graph = parsed["prerequisites"]
        elif isinstance(parsed, dict):
            raw_graph = parsed
        else:
            raw_graph = {}

        return raw_graph

    # ---------------------------------------------------------------------------
    # Step 3: Graph Validation, Cycle Detection & Redundancy Elimination
    # ---------------------------------------------------------------------------

    def validate_and_sanitize_graph(
        self,
        raw_graph: Dict[str, Any],
        known_topics: List[str]
    ) -> Dict[str, List[str]]:
        """
        Enforces:
        1. All topics in the graph belong to known_topics.
        2. All prerequisites belong to known_topics.
        3. No self-dependencies (topic != prereq).
        4. No duplicate prerequisites per topic.
        5. Prerequisite count capped at 4.
        6. Cycle detection & resolution (DAG enforcement).
        7. Transitive redundancy elimination.
        """
        # Create case-insensitive lookup for known topics
        topic_lookup: Dict[str, str] = {t.lower(): t for t in known_topics}

        sanitized: Dict[str, List[str]] = {}

        # Initialize all known topics with empty list
        for t in known_topics:
            sanitized[t] = []

        # Populate from raw_graph
        for raw_topic, prereqs in raw_graph.items():
            topic_canonical = topic_lookup.get(str(raw_topic).strip().lower())
            if not topic_canonical:
                continue

            if not isinstance(prereqs, list):
                if isinstance(prereqs, (str, int)):
                    prereqs = [prereqs]
                else:
                    prereqs = []

            valid_prereqs = []
            for p in prereqs:
                p_canonical = topic_lookup.get(str(p).strip().lower())
                # Must be a valid topic, not self, and not already in prereqs list
                if p_canonical and p_canonical != topic_canonical and p_canonical not in valid_prereqs:
                    valid_prereqs.append(p_canonical)

            # Cap at 4
            sanitized[topic_canonical] = valid_prereqs[:4]

        # Step 3.1: Cycle Detection & Breaking
        sanitized = self._break_cycles(sanitized)

        # Step 3.2: Transitive Redundancy Reduction
        sanitized = self._remove_transitive_redundancies(sanitized)

        return sanitized

    def _break_cycles(self, graph: Dict[str, List[str]]) -> Dict[str, List[str]]:
        """
        Detects and breaks directed cycles in the prerequisite graph using DFS.
        If topic T requires P, there is a directed dependency T -> P.
        A cycle exists if there is a back-edge in the recursion stack.
        When a cycle is detected, the violating prerequisite edge is removed.
        """
        # Working copy
        adj: Dict[str, List[str]] = {t: list(prereqs) for t, prereqs in graph.items()}

        def find_cycle() -> Optional[Tuple[str, str]]:
            visited: Dict[str, int] = {}  # 0=unvisited, 1=visiting (stack), 2=done

            def dfs(node: str, path: List[str]) -> Optional[Tuple[str, str]]:
                visited[node] = 1
                for neighbor in adj.get(node, []):
                    if visited.get(neighbor, 0) == 1:
                        # Back-edge detected: cycle between node and neighbor!
                        return (node, neighbor)
                    if visited.get(neighbor, 0) == 0:
                        res = dfs(neighbor, path + [neighbor])
                        if res:
                            return res
                visited[node] = 2
                return None

            for node in list(adj.keys()):
                if visited.get(node, 0) == 0:
                    cycle = dfs(node, [node])
                    if cycle:
                        return cycle
            return None

        # Iteratively remove back-edges until graph is a DAG
        while True:
            cycle_edge = find_cycle()
            if not cycle_edge:
                break
            src, prereq = cycle_edge
            if prereq in adj[src]:
                adj[src].remove(prereq)

        return adj

    def _remove_transitive_redundancies(self, graph: Dict[str, List[str]]) -> Dict[str, List[str]]:
        """
        Removes transitive redundant prerequisites:
        If T requires B, and B requires A, and T also directly lists A as a prerequisite,
        then A is redundant for T and can be removed (unless B does not cover it).
        """
        reduced: Dict[str, List[str]] = {}

        for topic, prereqs in graph.items():
            if len(prereqs) <= 1:
                reduced[topic] = list(prereqs)
                continue

            # Find all indirect ancestors of all prereqs
            indirect_ancestors: Set[str] = set()
            for p in prereqs:
                # Traverse ancestors of p
                to_visit = list(graph.get(p, []))
                visited = set()
                while to_visit:
                    curr = to_visit.pop()
                    if curr not in visited:
                        visited.add(curr)
                        indirect_ancestors.add(curr)
                        to_visit.extend(graph.get(curr, []))

            # Direct prereqs minus any that are already indirect ancestors
            essential_prereqs = [p for p in prereqs if p not in indirect_ancestors]
            # Ensure at least 1 remains if original list was not empty
            reduced[topic] = essential_prereqs if essential_prereqs else list(prereqs[:1])

        return reduced

    # ---------------------------------------------------------------------------
    # Step 4: JSON Persistence
    # ---------------------------------------------------------------------------

    def save_prerequisite_json(
        self,
        document_name: str,
        prerequisite_graph: Dict[str, List[str]]
    ) -> str:
        """
        Saves the prerequisite graph to prerequisites/<safe_name>_prerequisites.json.
        Preserves compatibility with the existing application schema (dict under 'prerequisites')
        while also providing 'document' and structured 'topics' array.
        """
        safe_stem = get_safe_filename(document_name)
        filename = f"{safe_stem}_prerequisites.json"
        filepath = os.path.join(self.jsons_dir, filename)

        # Build topics list for conceptual clarity
        topics_list = [
            {"topic": topic, "prerequisites": prereqs}
            for topic, prereqs in prerequisite_graph.items()
        ]

        payload = {
            "document": document_name,
            "prerequisites": prerequisite_graph,
            "topics": topics_list
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        return filepath

    # ---------------------------------------------------------------------------
    # End-to-End Pipeline
    # ---------------------------------------------------------------------------

    def generate_for_document(self, pdf_path: str, progress_callback=None) -> Dict[str, Any]:
        """
        Executes the entire automated prerequisite generation pipeline:
        PDF -> Extraction -> Chunking -> Topic Identification -> Normalization ->
        Prerequisite Generation -> Cycle Detection & Validation -> JSON Output.
        """
        def notify(pct, msg):
            if progress_callback:
                try:
                    progress_callback(pct, msg)
                except Exception:
                    pass

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        doc_basename = os.path.basename(pdf_path)

        # 1. Extract text from PDF
        notify(5, "Extracting document pages for curriculum analysis...")
        pages = self.extract_text_from_pdf(pdf_path)
        if not pages:
            return {
                "status": "error",
                "message": f"No extractable text found in '{doc_basename}'.",
                "topics_count": 0,
                "json_path": None
            }

        # 2. Chunk text
        chunks = self.chunk_pages(pages)

        # 3. Extract candidate topics from each chunk
        total_chunks = len(chunks)
        candidate_topics: List[str] = []
        for c_idx, chunk in enumerate(chunks):
            chunk_pct = 15 + int(35 * ((c_idx + 1) / max(total_chunks, 1)))
            notify(chunk_pct, f"Analyzing concepts (section {c_idx+1}/{total_chunks})...")
            topics = self.extract_candidate_topics_from_chunk(chunk)
            candidate_topics.extend(topics)

        # 4. Normalize & deduplicate topics
        notify(55, "Normalizing and filtering learning topics...")
        normalized_topics = self.deduplicate_and_filter_topics(candidate_topics)
        if not normalized_topics:
            return {
                "status": "error",
                "message": f"No valid learning topics could be extracted from '{doc_basename}'.",
                "topics_count": 0,
                "json_path": None
            }

        # 5. Generate prerequisite relationships
        notify(70, f"Inferring prerequisites for {len(normalized_topics)} core topics with AI...")
        doc_summary = f"{doc_basename} ({len(pages)} pages)"
        raw_graph = self.generate_prerequisite_graph(normalized_topics, doc_summary=doc_summary)

        # 6. Validate, break cycles, and remove redundancies
        notify(88, "Validating graph & resolving cyclic dependencies...")
        sanitized_graph = self.validate_and_sanitize_graph(raw_graph, normalized_topics)

        # 7. Save JSON
        notify(96, "Saving prerequisite curriculum structure...")
        json_path = self.save_prerequisite_json(doc_basename, sanitized_graph)

        notify(100, "Prerequisites ready.")
        return {
            "status": "success",
            "document": doc_basename,
            "topics_count": len(sanitized_graph),
            "json_path": json_path,
            "prerequisites": sanitized_graph
        }
