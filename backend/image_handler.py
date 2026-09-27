"""
Image handler for multi-modal chat responses.

Note: On Windows the default console encoding (cp1252) cannot handle
many Unicode characters, so we sanitise prompts to ASCII before
sending them to the HF API and printing them.

Strategy:
  1. Look for extracted images from source PDFs that match the pages
     referenced by the RAG retrieval results.
  2. If no document images are found, try generating an educational
     diagram via the HF Inference API (Stable Diffusion).
  3. If the online API fails, generate an offline educational card
     image using Pillow as a guaranteed fallback.
"""

import os
import json
import math
import re
import unicodedata
import hashlib
import textwrap
import time
from typing import Any, Dict, List, Optional

import requests
from PIL import Image, ImageDraw, ImageFont


class ImageHandler:
    """Finds or generates images relevant to a RAG response."""

    # Hugging Face text-to-image endpoint used only when the user selects AI.
    HF_API_URL = "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-3-medium-diffusers"

    # ── Colour palette for offline-generated cards ──
    _PALETTES = [
        {"bg1": (30, 60, 114),   "bg2": (42, 82, 152),   "accent": (255, 195, 113)},  # deep blue / gold
        {"bg1": (44, 62, 80),    "bg2": (52, 73, 94),     "accent": (46, 204, 113)},   # slate / green
        {"bg1": (72, 52, 117),   "bg2": (106, 76, 147),   "accent": (255, 154, 162)},  # purple / coral
        {"bg1": (25, 84, 123),   "bg2": (57, 119, 160),   "accent": (253, 203, 110)},  # ocean / amber
        {"bg1": (44, 83, 100),   "bg2": (32, 58, 67),     "accent": (85, 239, 196)},   # teal / mint
    ]

    def __init__(self, images_dir: str, hf_api_key: str = ""):
        self.images_dir = images_dir
        self.generated_dir = os.path.join(images_dir, "generated")
        os.makedirs(self.generated_dir, exist_ok=True)
        self.hf_api_key = hf_api_key

    # ------------------------------------------------------------------
    # Step 1: Find images extracted from the source PDFs
    # ------------------------------------------------------------------

    def find_document_images(
        self,
        matches: List[Any],
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Given RAG matches (which carry page_numbers in metadata),
        look up image_index.json for each matched document/page and
        return relevant image entries.
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
            index_path = os.path.join(self.images_dir, safe_name, "image_index.json")

            if not os.path.exists(index_path):
                continue

            try:
                with open(index_path, "r", encoding="utf-8") as f:
                    index_data = json.load(f)
            except Exception:
                continue

            for img_entry in index_data.get("images", []):
                if img_entry.get("page_number") in pages:
                    img_path = os.path.join(self.images_dir, img_entry["path"])
                    if not os.path.isfile(img_path):
                        continue

                    found_images.append({
                        "url": f"/images/{img_entry['path']}",
                        "source": "document",
                        "document": doc_name,
                        "page": img_entry["page_number"],
                    })

        # Deduplicate, sort by quality (best first), and limit
        seen = set()
        unique: List[Dict[str, Any]] = []
        for img in found_images:
            key = img["url"]
            if key not in seen:
                seen.add(key)
                unique.append(img)

        return unique[:top_k]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _sanitise_prompt(text: str) -> str:
        """Strip non-ASCII characters from a string (Windows-safe)."""
        text = unicodedata.normalize("NFKD", text)
        text = text.encode("ascii", errors="ignore").decode("ascii")
        return re.sub(r"\s{2,}", " ", text).strip()

    # ------------------------------------------------------------------
    # Step 2: Online AI image via Hugging Face
    # ------------------------------------------------------------------

    def generate_image_online(
        self,
        topic: Optional[str],
        user_question: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """
        Generates an educational diagram using the free Hugging Face
        Inference API (Stable Diffusion).

        Returns an image dict or None on failure.
        """
        if not self.hf_api_key:
            print("[Notice] HF_API_KEY not set. Skipping online image generation.")
            return None

        # Build a prompt optimised for educational/technical illustrations
        subject = topic or "the concept"
        detail = user_question or subject

        prompt = (
            f"Clean educational technical diagram illustrating {subject}: {detail}. "
            "Simple, clear, labeled diagram on white background. "
            "Academic textbook style illustration. "
            "No text overlays, no watermarks, high contrast, professional."
        )
        prompt = self._sanitise_prompt(prompt)

        # Deterministic filename so identical prompts reuse cached images
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()[:12]
        img_filename = f"{prompt_hash}.png"
        img_path = os.path.join(self.generated_dir, img_filename)

        # Return cached image if it exists and is recent (within 24h)
        if os.path.exists(img_path):
            age = time.time() - os.path.getmtime(img_path)
            if age < 86400:
                return {
                    "url": f"/images/generated/{img_filename}",
                    "source": "generated",
                    "topic": topic,
                }

        # Call Hugging Face Inference API
        headers = {"Authorization": f"Bearer {self.hf_api_key}"}
        payload = {"inputs": prompt}

        try:
            response = requests.post(
                self.HF_API_URL,
                headers=headers,
                json=payload,
                timeout=30,
            )

            if response.status_code == 503:
                print("[Notice] HF model is loading. Skipping online image generation.")
                return None

            if response.status_code != 200:
                print(f"[Notice] HF API returned {response.status_code}: {response.text[:200]}")
                return None

            # Response body is raw image bytes
            content_type = response.headers.get("content-type", "")
            if "image" not in content_type and "octet" not in content_type:
                print(f"[Notice] HF API returned unexpected content type: {content_type}")
                return None

            with open(img_path, "wb") as f:
                f.write(response.content)

            safe_topic = self._sanitise_prompt(topic or "unknown")
            print(f"  Generated online image for '{safe_topic}' -> {img_filename}")
            return {
                "url": f"/images/generated/{img_filename}",
                "source": "generated",
                "topic": topic,
            }

        except requests.exceptions.Timeout:
            print("[Notice] HF API request timed out.")
            return None
        except Exception as e:
            safe_err = self._sanitise_prompt(str(e))
            print(f"[Notice] HF image generation failed: {safe_err}")
            return None

    # ------------------------------------------------------------------
    # Step 3: Offline fallback – Pillow-generated educational card
    # ------------------------------------------------------------------

    def generate_image_offline(
        self,
        topic: Optional[str],
        user_question: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """
        Generates a styled educational card image using Pillow.
        This is fully offline – no network calls needed.
        """
        subject = topic or "Course Topic"
        detail = user_question or ""

        # Deterministic filename based on topic + question
        key = f"offline_{subject}_{detail}"
        prompt_hash = hashlib.md5(key.encode("utf-8")).hexdigest()[:12]
        img_filename = f"{prompt_hash}_offline.png"
        img_path = os.path.join(self.generated_dir, img_filename)

        # Return cached image if recent (within 24h)
        if os.path.exists(img_path):
            age = time.time() - os.path.getmtime(img_path)
            if age < 86400:
                return {
                    "url": f"/images/generated/{img_filename}",
                    "source": "generated_offline",
                    "topic": topic,
                }

        try:
            width, height = 800, 500

            # Pick a colour palette based on topic hash
            palette_idx = hash(subject) % len(self._PALETTES)
            pal = self._PALETTES[palette_idx]
            bg1, bg2, accent = pal["bg1"], pal["bg2"], pal["accent"]

            # Create gradient background
            img = Image.new("RGB", (width, height), bg1)
            draw = ImageDraw.Draw(img)

            for y in range(height):
                ratio = y / height
                r = int(bg1[0] + (bg2[0] - bg1[0]) * ratio)
                g = int(bg1[1] + (bg2[1] - bg1[1]) * ratio)
                b = int(bg1[2] + (bg2[2] - bg1[2]) * ratio)
                draw.line([(0, y), (width, y)], fill=(r, g, b))

            # Draw decorative circles
            for i in range(6):
                cx = 100 + i * 140
                cy = 80 + (i % 3) * 120
                radius = 30 + (i % 3) * 15
                overlay_color = (*accent, 30)
                # Draw semi-transparent circles as filled ellipses
                for dr in range(radius, 0, -1):
                    alpha = max(5, 30 - dr)
                    c = (
                        min(255, accent[0] + alpha),
                        min(255, accent[1] + alpha),
                        min(255, accent[2] + alpha),
                    )
                    draw.ellipse(
                        [cx - dr, cy - dr, cx + dr, cy + dr],
                        outline=c,
                    )

            # Draw accent bar at top
            draw.rectangle([0, 0, width, 6], fill=accent)

            # Load a font (fall back to default if unavailable)
            try:
                font_large = ImageFont.truetype("arial.ttf", 36)
                font_medium = ImageFont.truetype("arial.ttf", 20)
                font_small = ImageFont.truetype("arial.ttf", 16)
            except (OSError, IOError):
                font_large = ImageFont.load_default()
                font_medium = font_large
                font_small = font_large

            # Draw "PRAG Tutor" label
            draw.text((30, 20), "PRAG Tutor", fill=(*accent, 200), font=font_small)

            # Draw topic title (wrapped)
            title_lines = textwrap.wrap(subject, width=30)
            y_pos = 70
            for line in title_lines[:3]:
                draw.text((40, y_pos), line, fill=(255, 255, 255), font=font_large)
                y_pos += 46

            # Draw horizontal rule
            y_pos += 10
            draw.line([(40, y_pos), (width - 40, y_pos)], fill=accent, width=2)
            y_pos += 20

            # Draw question text (wrapped)
            if detail:
                q_lines = textwrap.wrap(detail, width=55)
                for line in q_lines[:5]:
                    draw.text((40, y_pos), line, fill=(220, 220, 230), font=font_medium)
                    y_pos += 28

            # Draw bottom badge
            badge_text = "AI Generated - Educational Reference"
            draw.rounded_rectangle(
                [30, height - 55, 340, height - 20],
                radius=12,
                fill=(*accent[:3],),
            )
            draw.text((45, height - 50), badge_text, fill=(30, 30, 30), font=font_small)

            # Save
            img.save(img_path, "PNG")
            safe_topic = self._sanitise_prompt(subject)
            print(f"  Generated offline image for '{safe_topic}' -> {img_filename}")

            return {
                "url": f"/images/generated/{img_filename}",
                "source": "generated_offline",
                "topic": topic,
            }

        except Exception as e:
            safe_err = self._sanitise_prompt(str(e))
            print(f"[Notice] Offline image generation failed: {safe_err}")
            return None

    # ------------------------------------------------------------------
    # Orchestrator: document images first, AI fallback second
    # ------------------------------------------------------------------

    def get_images(
        self,
        matches: List[Any],
        user_question: Optional[str] = None,
        topic: Optional[str] = None,
        mode: str = "notes",
    ) -> List[Dict[str, Any]]:
        """
        Return images from exactly the mode selected by the user.

        For AI mode: try online HF API first, then fall back to offline
        Pillow-generated image so the user always gets a result.
        """
        if mode == "ai":
            # Try online first
            generated = self.generate_image_online(topic, user_question)
            if generated:
                return [generated]
            # Fallback to offline Pillow image
            print("[Notice] Online failed. Falling back to offline image generation.")
            offline = self.generate_image_offline(topic, user_question)
            return [offline] if offline else []
        return self.find_document_images(matches, top_k=3)
