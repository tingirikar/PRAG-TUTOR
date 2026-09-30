"""
Image handler for course document diagrams (Option C).

Extracts and indexes genuine diagrams from course PDFs via PyMuPDF.
Strictly returns authentic diagrams from course materials when notes mode
is selected; returns empty for mermaid or none modes (as mermaid is rendered
live in markdown). Zero fake fallbacks or synthetic AI image generation.
"""

import os
import json
from typing import Any, Dict, List, Optional


class ImageHandler:
    """Finds genuine extracted diagrams from course PDFs relevant to RAG context."""

    def __init__(self, images_dir: str, hf_api_key: str = ""):
        self.images_dir = images_dir

    def find_document_images(
        self,
        matches: List[Any],
        top_k: int = 3,
        subject: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Given RAG matches (which carry page_numbers in metadata),
        looks up image_index.json for each matched document/page and
        returns relevant extracted PDF image entries.
        Supports both subject-scoped directories and legacy flat paths.
        """
        # Collect (document, page_number) pairs from matches
        doc_pages: Dict[str, set] = {}
        for match in matches:
            meta = (
                match.get("metadata", {})
                if isinstance(match, dict)
                else getattr(match, "metadata", {})
            )
            doc_name = meta.get("document", "")
            page_numbers_raw = meta.get("page_numbers", "[]")
            if isinstance(page_numbers_raw, str):
                try:
                    page_numbers = json.loads(page_numbers_raw)
                except (json.JSONDecodeError, TypeError):
                    page_numbers = []
            elif isinstance(page_numbers_raw, list):
                page_numbers = page_numbers_raw
            else:
                page_numbers = []

            if doc_name and page_numbers:
                if doc_name not in doc_pages:
                    doc_pages[doc_name] = set()
                for p in page_numbers:
                    doc_pages[doc_name].add(int(p))

        if not doc_pages:
            return []

        # Search image indexes for matching pages
        found_images: List[Dict[str, Any]] = []

        for doc_name, pages in doc_pages.items():
            safe_name = doc_name.replace(" ", "_").replace(".", "_")
            index_path = None
            if subject:
                subj_path = os.path.join(self.images_dir, subject.strip().upper(), safe_name, "image_index.json")
                if os.path.exists(subj_path):
                    index_path = subj_path

            if not index_path or not os.path.exists(index_path):
                flat_path = os.path.join(self.images_dir, safe_name, "image_index.json")
                if os.path.exists(flat_path):
                    index_path = flat_path

            if not index_path or not os.path.exists(index_path):
                # Search across subject subdirectories in self.images_dir
                if os.path.isdir(self.images_dir):
                    for sub in os.listdir(self.images_dir):
                        sub_dir = os.path.join(self.images_dir, sub)
                        if os.path.isdir(sub_dir):
                            candidate = os.path.join(sub_dir, safe_name, "image_index.json")
                            if os.path.exists(candidate):
                                index_path = candidate
                                break

            if not index_path or not os.path.exists(index_path):
                continue

            try:
                with open(index_path, "r", encoding="utf-8") as f:
                    index_data = json.load(f)
            except Exception:
                continue

            for img_entry in index_data.get("images", []):
                if img_entry.get("page_number") in pages:
                    stored_rel = img_entry.get("path", "")
                    img_path = os.path.join(self.images_dir, stored_rel)
                    if not os.path.isfile(img_path):
                        alt_path = os.path.join(os.path.dirname(index_path), img_entry.get("filename", ""))
                        if os.path.isfile(alt_path):
                            img_path = alt_path
                            stored_rel = os.path.relpath(alt_path, self.images_dir).replace("\\", "/")
                        else:
                            continue

                    found_images.append({
                        "url": f"/images/{stored_rel}",
                        "source": "document",
                        "document": doc_name,
                        "page": img_entry["page_number"],
                    })

        # Deduplicate and limit to top_k
        seen = set()
        unique: List[Dict[str, Any]] = []
        for img in found_images:
            key = img["url"]
            if key not in seen:
                seen.add(key)
                unique.append(img)

        return unique[:top_k]

    def get_images(
        self,
        matches: List[Any],
        user_question: Optional[str] = None,
        topic: Optional[str] = None,
        mode: str = "notes",
        subject: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Returns diagrams strictly according to the selected mode:
        - 'notes': ONLY genuine diagrams extracted from course PDFs. Zero fake fallbacks.
        - 'mermaid' / 'none': returns empty list (Mermaid is rendered interactively in chat).
        """
        if mode == "notes":
            return self.find_document_images(matches, top_k=3, subject=subject)
        return []
