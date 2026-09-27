import os
import json
import shutil
import hashlib
import pdfplumber
from sentence_transformers import SentenceTransformer
import pinecone
from prerequisite_generator import PrerequisiteGenerator, get_safe_filename

# PyMuPDF for image extraction from PDFs
try:
    import pymupdf as fitz  # PyMuPDF (modern import)
except ImportError:
    try:
        import fitz  # PyMuPDF (legacy import)
    except ImportError:
        fitz = None
        print("[Notice] PyMuPDF not installed. PDF image extraction will be unavailable.")

try:
    from PIL import Image, ImageStat
    import io
except ImportError:
    Image = None
    ImageStat = None
    print("[Notice] Pillow not installed. Image processing will be unavailable.")

class DocumentProcessor:
    def __init__(
        self,
        pdf_dir,
        vector_db_api_key,
        groq_api_key=None,
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    ):
        self.pdf_dir = pdf_dir
        self.images_dir = os.path.join(pdf_dir, "images")
        os.makedirs(self.images_dir, exist_ok=True)
        self.model = SentenceTransformer(model_name)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.prereq_generator = PrerequisiteGenerator(
            llm_api_key=groq_api_key,
            jsons_dir=os.path.join(base_dir, "prerequisites")
        )
        try:
            pc = pinecone.Pinecone(api_key=vector_db_api_key)
            self.index = pc.Index("intelligent-tutor")
        except Exception as e:
            print(f"[Error] Failed to connect to Pinecone index: {e}")
            self.index = None  

    def read_pdf(self, pdf_file):
        text_content = ""
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                text_content += page.extract_text()
        return text_content

    def read_pdf_by_page(self, pdf_file):
        """Reads a PDF and returns a list of (page_number, page_text) tuples."""
        pages = []
        with pdfplumber.open(pdf_file) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages.append((page_num, text))
        return pages

    def chunk_text(self, text, chunk_size=500, overlap=100):
        raw_lines = [line.strip() for line in text.split('\n') if line.strip()]
        chunks = []
        current_chunk = []
        current_len = 0

        for line in raw_lines:
            if len(line) < 4:
                continue
            if current_len + len(line) > chunk_size and current_chunk:
                chunk_str = " ".join(current_chunk)
                if len(chunk_str) >= 30:
                    chunks.append(chunk_str)
                current_chunk = [line]
                current_len = len(line)
            else:
                current_chunk.append(line)
                current_len += len(line)

        if current_chunk:
            chunk_str = " ".join(current_chunk)
            if len(chunk_str) >= 30:
                chunks.append(chunk_str)

        return chunks

    def chunk_text_with_pages(self, pages, chunk_size=500):
        """
        Chunks text while tracking which page(s) each chunk came from.
        pages: list of (page_number, page_text) tuples.
        Returns list of dicts: [{"text": "...", "page_numbers": [0, 1]}, ...]
        """
        chunks = []
        current_chunk_lines = []
        current_chunk_pages = set()
        current_len = 0

        for page_num, page_text in pages:
            raw_lines = [line.strip() for line in page_text.split('\n') if line.strip()]
            for line in raw_lines:
                if len(line) < 4:
                    continue
                if current_len + len(line) > chunk_size and current_chunk_lines:
                    chunk_str = " ".join(current_chunk_lines)
                    if len(chunk_str) >= 30:
                        chunks.append({
                            "text": chunk_str,
                            "page_numbers": sorted(current_chunk_pages)
                        })
                    current_chunk_lines = [line]
                    current_chunk_pages = {page_num}
                    current_len = len(line)
                else:
                    current_chunk_lines.append(line)
                    current_chunk_pages.add(page_num)
                    current_len += len(line)

        if current_chunk_lines:
            chunk_str = " ".join(current_chunk_lines)
            if len(chunk_str) >= 30:
                chunks.append({
                    "text": chunk_str,
                    "page_numbers": sorted(current_chunk_pages)
                })

        return chunks

    def generate_embeddings(self, text):
        chunks = self.chunk_text(text)
        if not chunks:
            chunks = [text[:500]] if text.strip() else ["General course content"]
        embeddings = self.model.encode(chunks)
        return chunks, embeddings

    def generate_embeddings_with_pages(self, pages):
        """Generate embeddings with page tracking for multi-modal support."""
        chunk_data = self.chunk_text_with_pages(pages)
        if not chunk_data:
            full_text = " ".join(text for _, text in pages)
            chunk_data = [{"text": full_text[:500] if full_text.strip() else "General course content", "page_numbers": [0]}]

        texts = [c["text"] for c in chunk_data]
        embeddings = self.model.encode(texts)
        return chunk_data, embeddings

    def process_single_pdf(self, filepath):
        """
        Processes an individual PDF document:
        1. Extracts embedded images for multi-modal support.
        2. Reads and indexes vectors into Pinecone (if available).
        3. Automatically extracts topics and generates prerequisite JSON into prerequisites/.
        4. Updates the tracking file.
        """
        if not os.path.exists(filepath):
            return {"status": "error", "message": f"File not found: {filepath}"}

        pdf_file = os.path.basename(filepath)
        tracking_file = os.path.join(self.pdf_dir, "processed_files.json")
        processed_hashes = {}
        if os.path.exists(tracking_file):
            try:
                with open(tracking_file, "r", encoding="utf-8") as f:
                    processed_hashes = json.load(f)
            except Exception:
                pass

        # Compute hash
        hasher = hashlib.md5()
        try:
            with open(filepath, "rb") as f:
                hasher.update(f.read())
            file_hash = hasher.hexdigest()
        except Exception as e:
            return {"status": "error", "message": f"Could not hash file: {e}"}

        # Multi-modal image extraction
        self.extract_images_from_pdf(filepath, pdf_file)

        # Upsert vectors to Pinecone if updated or not yet indexed
        if self.index is not None and processed_hashes.get(pdf_file) != file_hash:
            pages = self.read_pdf_by_page(filepath)
            chunk_data, embeddings = self.generate_embeddings_with_pages(pages)
            vectors_to_upsert = []
            for i, embedding in enumerate(embeddings):
                vector = embedding.tolist()
                chunk = chunk_data[i]
                page_nums = chunk["page_numbers"]
                vectors_to_upsert.append((
                    f"{pdf_file}_{i}",
                    vector,
                    {
                        "sentence": chunk["text"],
                        "document": pdf_file,
                        "chunk_index": i,
                        "page_numbers": json.dumps(page_nums)
                    }
                ))
                if len(vectors_to_upsert) >= 100:
                    self.index.upsert(vectors=vectors_to_upsert)
                    vectors_to_upsert = []
            if vectors_to_upsert:
                self.index.upsert(vectors=vectors_to_upsert)

            processed_hashes[pdf_file] = file_hash
            try:
                with open(tracking_file, "w", encoding="utf-8") as f:
                    json.dump(processed_hashes, f, indent=4)
            except Exception:
                pass

        # Automatically generate prerequisite JSON
        prereq_res = {}
        try:
            prereq_res = self.prereq_generator.generate_for_document(filepath)
        except Exception as e:
            print(f"Warning: Could not generate prerequisites for {pdf_file}: {e}")

        return {
            "status": "success",
            "file": pdf_file,
            "hash": file_hash,
            "topics_count": prereq_res.get("topics_count", 0),
            "json_path": prereq_res.get("json_path"),
            "prerequisites": prereq_res.get("prerequisites", {})
        }

    @staticmethod
    def _is_quality_image(img, min_entropy=1.5, min_std_dev=15.0, min_unique_ratio=0.002):
        """
        Checks if an image is a meaningful diagram/figure vs junk.
        Returns (is_good: bool, quality_score: float, reason: str).

        Filters out:
          - Solid color blocks (low entropy + low std dev)
          - Near-blank or gradient fills (low unique color ratio)
          - Extremely thin/wide decorators (bad aspect ratio)
          - Repeated watermark-style patterns
        """
        if Image is None or ImageStat is None:
            return True, 1.0, "quality check unavailable"

        try:
            w, h = img.size

            # 1. Aspect ratio check — reject extreme aspect ratios (borders, lines)
            aspect = max(w, h) / max(min(w, h), 1)
            if aspect > 8.0:
                return False, 0.0, f"extreme aspect ratio ({aspect:.1f}:1)"

            # 2. Convert to RGB for consistent analysis
            analysis_img = img.convert("RGB") if img.mode != "RGB" else img

            # 3. Entropy — measures information content
            #    Solid color → ~0, rich diagram → 4-7+
            entropy = analysis_img.entropy()
            if entropy < min_entropy:
                return False, entropy / 7.0, f"low entropy ({entropy:.2f})"

            # 4. Standard deviation of pixel values
            #    Near-uniform image → low std dev
            stat = ImageStat.Stat(analysis_img)
            avg_std = sum(stat.stddev) / len(stat.stddev)
            if avg_std < min_std_dev:
                return False, avg_std / 80.0, f"low contrast (std_dev={avg_std:.1f})"

            # 5. Unique color density — sample center crop to check diversity
            #    Downsample for speed (max 100x100)
            sample = analysis_img.copy()
            sample.thumbnail((100, 100), Image.NEAREST)
            colors = sample.getcolors(maxcolors=10001)
            if colors is not None:
                total_pixels = sample.size[0] * sample.size[1]
                unique_ratio = len(colors) / max(total_pixels, 1)
                if unique_ratio < min_unique_ratio:
                    return False, unique_ratio, f"too few unique colors ({len(colors)} in {total_pixels}px)"

            # Compute composite quality score (0.0 - 1.0)
            entropy_score = min(entropy / 7.0, 1.0)
            std_score = min(avg_std / 80.0, 1.0)
            quality_score = round((entropy_score * 0.6 + std_score * 0.4), 3)

            return True, quality_score, "ok"

        except Exception as e:
            # If analysis fails, keep the image (don't reject on error)
            return True, 0.5, f"analysis error: {e}"

    def extract_images_from_pdf(self, pdf_file, pdf_name):
        """
        Extracts embedded images from a PDF using PyMuPDF.
        Saves images to uploads/images/{pdf_name}/ and creates an image_index.json.
        Returns the image index data.
        """
        if fitz is None or Image is None:
            print(f"[Notice] Skipping image extraction for '{pdf_name}' (PyMuPDF or Pillow not available).")
            return []

        # Create directory for this document's images
        safe_name = pdf_name.replace(" ", "_").replace(".", "_")
        doc_images_dir = os.path.join(self.images_dir, safe_name)
        # Clean previous extraction
        if os.path.exists(doc_images_dir):
            shutil.rmtree(doc_images_dir)
        os.makedirs(doc_images_dir, exist_ok=True)

        image_index = []

        try:
            doc = fitz.open(pdf_file)
            image_count = 0

            for page_num in range(len(doc)):
                page = doc[page_num]
                image_list = page.get_images(full=True)

                for img_idx, img_info in enumerate(image_list):
                    xref = img_info[0]
                    try:
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        image_ext = base_image.get("ext", "png")
                        width = base_image.get("width", 0)
                        height = base_image.get("height", 0)

                        # Skip tiny images (likely icons/bullets/decorations)
                        if width < 50 or height < 50:
                            continue

                        # Skip very small file sizes (likely spacer images)
                        if len(image_bytes) < 2000:
                            continue

                        # Convert to PNG and save
                        img_filename = f"page_{page_num}_img_{img_idx}.png"
                        img_path = os.path.join(doc_images_dir, img_filename)

                        img = Image.open(io.BytesIO(image_bytes))
                        # Convert to RGB if necessary (some PDFs have CMYK images)
                        if img.mode not in ("RGB", "RGBA"):
                            img = img.convert("RGB")

                        # Quality check — reject junk images
                        is_good, quality_score, reason = self._is_quality_image(img)
                        if not is_good:
                            print(f"    Skipped bad image page {page_num} img {img_idx}: {reason}")
                            continue

                        # Resize if too large (max 800px on longest side) to save space
                        max_dim = 800
                        if max(img.size) > max_dim:
                            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
                        img.save(img_path, "PNG", optimize=True)

                        image_index.append({
                            "filename": img_filename,
                            "page_number": page_num,
                            "width": width,
                            "height": height,
                            "size_bytes": len(image_bytes),
                            "quality_score": quality_score,
                            "path": f"{safe_name}/{img_filename}"
                        })
                        image_count += 1

                    except Exception as img_err:
                        print(f"  [Notice] Could not extract image {img_idx} from page {page_num}: {img_err}")
                        continue

            doc.close()

            # Save image index JSON
            index_path = os.path.join(doc_images_dir, "image_index.json")
            with open(index_path, "w", encoding="utf-8") as f:
                json.dump({
                    "document": pdf_name,
                    "total_images": image_count,
                    "images": image_index
                }, f, indent=2)

            print(f"  Extracted {image_count} image(s) from '{pdf_name}'.")
            return image_index

        except Exception as e:
            print(f"  [Warning] Image extraction failed for '{pdf_name}': {e}")
            return []

    def upload_to_vector_db(self):
        if self.index is None:
            print("[Warning] Pinecone index is not initialized. Skipping vector upload.")
            return
        if not os.path.exists(self.pdf_dir):
            os.makedirs(self.pdf_dir)
        pdf_files = [f for f in os.listdir(self.pdf_dir) if f.endswith(".pdf")]
        if not pdf_files:
            print("No PDF files found to process.")
            return

        # Load processed files tracking JSON
        tracking_file = os.path.join(self.pdf_dir, "processed_files.json")
        processed_hashes = {}
        if os.path.exists(tracking_file):
            try:
                with open(tracking_file, "r", encoding="utf-8") as f:
                    processed_hashes = json.load(f)
            except Exception:
                pass

        import hashlib
        updated = False
        print(f"Checking {len(pdf_files)} PDF file(s) for vector database updates...")
        
        for pdf_file in pdf_files:
            filepath = os.path.join(self.pdf_dir, pdf_file)
            
            # Compute MD5 hash of the PDF file
            hasher = hashlib.md5()
            try:
                with open(filepath, "rb") as f:
                    hasher.update(f.read())
                file_hash = hasher.hexdigest()
            except Exception as e:
                print(f"Could not read/hash '{pdf_file}': {e}")
                continue

            file_is_new_or_modified = (processed_hashes.get(pdf_file) != file_hash)

            # Check if prerequisite JSON exists for this document
            safe_stem = get_safe_filename(pdf_file).lower()
            existing_jsons = [f.lower() for f in os.listdir(self.prereq_generator.jsons_dir) if f.endswith(".json")]
            stem_core = safe_stem.replace("_full_notes", "").replace("_notes", "").strip("_")
            json_exists = any(
                f == f"{safe_stem}_prerequisites.json" or
                (stem_core and stem_core in f)
                for f in existing_jsons
            )
            json_is_missing = not json_exists

            # 1. Process and upload to vector DB if new/modified
            if file_is_new_or_modified:
                print(f"Reading and processing updated/new file '{pdf_file}'...")

                # Extract images from PDF (multi-modal feature)
                self.extract_images_from_pdf(filepath, pdf_file)

                # Read PDF with page tracking for better metadata
                pages = self.read_pdf_by_page(filepath)
                print(f"Generating embeddings for '{pdf_file}'...")
                chunk_data, embeddings = self.generate_embeddings_with_pages(pages)
                print(f"Uploading {len(chunk_data)} vectors to Pinecone...")
                vectors_to_upsert = []
                for i, embedding in enumerate(embeddings):
                    vector = embedding.tolist()
                    chunk = chunk_data[i]
                    # Include page_numbers in metadata for image association
                    page_nums = chunk["page_numbers"]
                    vectors_to_upsert.append((
                        f"{pdf_file}_{i}",
                        vector,
                        {
                            "sentence": chunk["text"],
                            "document": pdf_file,
                            "chunk_index": i,
                            "page_numbers": json.dumps(page_nums)
                        }
                    ))
                    
                    if len(vectors_to_upsert) >= 100:
                        self.index.upsert(vectors=vectors_to_upsert)
                        vectors_to_upsert = []
                if vectors_to_upsert:
                    self.index.upsert(vectors=vectors_to_upsert)
                
                # Update hash cache
                processed_hashes[pdf_file] = file_hash
                updated = True
                print(f"Successfully processed and uploaded '{pdf_file}'.")
            else:
                print(f"Skipping vector upload for '{pdf_file}' (already up-to-date).")

            # 2. Automatically generate prerequisite JSON if new/modified or if JSON is missing
            if file_is_new_or_modified or json_is_missing:
                try:
                    print(f"Generating automatic prerequisites for '{pdf_file}'...")
                    self.prereq_generator.generate_for_document(filepath)
                except Exception as e:
                    print(f"Warning: Could not generate prerequisites for {pdf_file}: {e}")

        # Save the updated tracking file
        if updated:
            try:
                with open(tracking_file, "w", encoding="utf-8") as f:
                    json.dump(processed_hashes, f, indent=4)
            except Exception as e:
                print(f"Warning: Could not save tracking file: {e}")

    def delete_document(self, filename):
        """Deletes a document from disk, tracking file, vector index, and extracted images."""
        # 1. Remove file from uploads directory
        filepath = os.path.join(self.pdf_dir, filename)
        file_exists = os.path.isfile(filepath)
        tracking_file = os.path.join(self.pdf_dir, "processed_files.json")
        tracking_exists = False
        hashes = {}
        if os.path.exists(tracking_file):
            try:
                with open(tracking_file, "r", encoding="utf-8") as f:
                    hashes = json.load(f)
                tracking_exists = filename in hashes
            except Exception as e:
                print(f"Warning: Could not read tracking file on delete: {e}")

        if file_exists:
            os.remove(filepath)
            print(f"Removed file: {filepath}")

        # 2. Update tracking file
        if tracking_exists:
            del hashes[filename]
            with open(tracking_file, "w", encoding="utf-8") as f:
                json.dump(hashes, f, indent=4)
            print(f"Removed {filename} from tracking file.")

        # 3. Delete extracted images for this document
        safe_name = filename.replace(" ", "_").replace(".", "_")
        doc_images_dir = os.path.join(self.images_dir, safe_name)
        if os.path.exists(doc_images_dir):
            shutil.rmtree(doc_images_dir)
            print(f"Removed extracted images for {filename}.")

        # 3.1. Delete generated prerequisite JSON if exists
        safe_stem = get_safe_filename(filename)
        prereq_json_path = os.path.join(self.prereq_generator.jsons_dir, f"{safe_stem}_prerequisites.json")
        if os.path.exists(prereq_json_path):
            try:
                os.remove(prereq_json_path)
                print(f"Removed prerequisite file: {prereq_json_path}")
            except Exception as e:
                print(f"Warning: Could not remove prerequisite file {prereq_json_path}: {e}")

        # 4. Delete vectors from Pinecone
        vectors_pruned = False
        if self.index:
            # Delete by metadata so every chunk is removed, including chunks
            # from older uploads that exceeded the previous ID limit.
            self.index.delete(filter={"document": {"$eq": filename}})
            vectors_pruned = True
            print(f"Pruned vectors for {filename} from Pinecone index.")

        if not file_exists and not tracking_exists and not vectors_pruned:
            raise FileNotFoundError(f"Document '{filename}' was not found.")

        return {"filename": filename, "file_deleted": file_exists, "vectors_pruned": vectors_pruned}

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    pinecone_api_key = os.environ.get("PINECONE_API_KEY", "")
    pdf_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    processor = DocumentProcessor(pdf_dir=pdf_dir, vector_db_api_key=pinecone_api_key)
    processor.upload_to_vector_db()
