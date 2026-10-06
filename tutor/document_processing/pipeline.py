"""Orchestrates document ingestion: reading, image extraction, embedding, vector upsert, and prerequisite triggering."""

import os
from typing import Any, Callable, Dict, Optional

from tutor.config import (
    UPLOAD_DIR,
    get_db,
    get_embedding_model,
    get_pinecone_index,
)
from tutor.document_processing.chunking import chunk_text, chunk_text_with_pages
from tutor.document_processing.embedding import (
    generate_embeddings,
    generate_embeddings_with_pages,
)
from tutor.document_processing.image_extraction import (
    extract_images_from_pdf,
    is_quality_image,
)
from tutor.document_processing.indexing import (
    delete_document_data,
    get_file_hash,
    load_processed_hashes,
    save_processed_hashes,
    upload_vectors_to_pinecone,
)
from tutor.document_processing.pdf_reader import read_pdf, read_pdf_by_page
from tutor.prerequisite_processing.pipeline import PrerequisiteGenerator


class DocumentProcessor:
    """Document processing pipeline for ingestion, embedding, vector indexing, and image extraction."""

    def __init__(
        self,
        pdf_dir: Optional[str] = None,
        vector_db_api_key: Optional[str] = None,
        groq_api_key: Optional[str] = None,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
    ):
        self.pdf_dir = pdf_dir or UPLOAD_DIR
        self.model = get_embedding_model()
        self.index = get_pinecone_index()
        self.prereq_generator = PrerequisiteGenerator()

    # ── PDF Reading Methods ───────────────────────────────────────────
    def read_pdf(self, pdf_file: str) -> str:
        return read_pdf(pdf_file)

    def read_pdf_by_page(self, pdf_file: str):
        return read_pdf_by_page(pdf_file)

    # ── Chunking Methods ──────────────────────────────────────────────
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 100):
        return chunk_text(text, chunk_size=chunk_size, overlap=overlap)

    def chunk_text_with_pages(self, pages, chunk_size: int = 500):
        return chunk_text_with_pages(pages, chunk_size=chunk_size)

    # ── Embedding Methods ─────────────────────────────────────────────
    def generate_embeddings(self, text: str):
        return generate_embeddings(text, model=self.model)

    def generate_embeddings_with_pages(self, pages, progress_callback=None):
        return generate_embeddings_with_pages(
            pages, model=self.model, progress_callback=progress_callback
        )

    # ── Image Extraction Methods ──────────────────────────────────────
    @staticmethod
    def _is_quality_image(img, min_entropy=1.5, min_std_dev=15.0, min_unique_ratio=0.002):
        return is_quality_image(
            img,
            min_entropy=min_entropy,
            min_std_dev=min_std_dev,
            min_unique_ratio=min_unique_ratio,
        )

    def extract_images_from_pdf(self, pdf_file: str, pdf_name: str, subject: str = "DSA"):
        return extract_images_from_pdf(
            pdf_file=pdf_file,
            pdf_name=pdf_name,
            subject=subject,
            pdf_dir=self.pdf_dir,
        )

    # ── Pipeline Execution ────────────────────────────────────────────
    def process_single_pdf(
        self,
        filepath: str,
        subject: str = "DSA",
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> Dict[str, Any]:
        """Processes an individual PDF document:

        1. Extracts embedded diagrams for multi-modal support.
        2. Reads pages and indexes vectors into Pinecone isolated by subject namespace.
        3. Automatically extracts topics and generates prerequisite graph into MongoDB.
        4. Updates the tracking file.
        """

        def notify(pct, msg):
            if progress_callback:
                try:
                    progress_callback(pct, msg)
                except Exception:
                    pass

        if not os.path.exists(filepath):
            return {"status": "error", "message": f"File not found: {filepath}"}

        pdf_file = os.path.basename(filepath)
        notify(5, f"Validating document integrity: {pdf_file}")
        tracking_file = os.path.join(self.pdf_dir, "processed_files.json")
        processed_hashes = load_processed_hashes(tracking_file)

        # Compute hash
        try:
            file_hash = get_file_hash(filepath)
        except Exception as e:
            return {"status": "error", "message": f"Could not hash file: {e}"}

        # Multi-modal image extraction (strictly isolated by subject)
        notify(15, f"Extracting diagrams & images from {pdf_file} ({subject})...")
        self.extract_images_from_pdf(filepath, pdf_file, subject=subject)

        # Upsert vectors to Pinecone isolated strictly to the subject namespace
        if self.index is not None and processed_hashes.get(pdf_file) != file_hash:
            notify(30, "Reading pages & extracting text content...")
            pages = self.read_pdf_by_page(filepath)

            def emb_progress(done, total):
                pct = 45 + int(14 * (done / max(total, 1)))
                notify(pct, f"Computing embeddings ({done}/{total} chunks)...")

            notify(45, f"Chunking text & computing embeddings for {len(pages)} pages...")
            chunk_data, embeddings = self.generate_embeddings_with_pages(
                pages, progress_callback=emb_progress
            )

            notify(60, f"Upserting {len(embeddings)} vectors into Pinecone ({subject})...")

            def upsert_progress(done, total):
                upsert_pct = 60 + int(14 * (done / max(total, 1)))
                notify(upsert_pct, f"Uploaded {done}/{total} vectors to Pinecone...")

            upload_vectors_to_pinecone(
                index=self.index,
                embeddings=embeddings,
                chunk_data=chunk_data,
                pdf_file=pdf_file,
                subject=subject,
                progress_callback=upsert_progress,
            )
            notify(74, f"Uploaded all {len(embeddings)} vectors to Pinecone")

            processed_hashes[pdf_file] = file_hash
            save_processed_hashes(tracking_file, processed_hashes)

        # Automatically generate prerequisites directly to MongoDB Atlas
        prereq_res = {}
        try:

            def prereq_progress(pct, stage):
                notify(75 + int(pct * 0.23), stage)

            notify(75, "Analyzing topics & building prerequisite graph with AI...")
            prereq_res = self.prereq_generator.generate_for_document(
                filepath, subject=subject, progress_callback=prereq_progress
            )
        except Exception as e:
            print(f"Warning: Could not generate prerequisites for {pdf_file}: {e}")

        notify(100, f"Successfully processed and indexed {pdf_file}")
        return {
            "status": "success",
            "file": pdf_file,
            "hash": file_hash,
            "topics_count": prereq_res.get("topics_count", 0),
            "subject": subject,
            "prerequisites": prereq_res.get("prerequisites", {}),
        }

    def upload_to_vector_db(self):
        """Batch scans upload directory and processes any new or modified PDFs."""
        if self.index is None:
            print("[Warning] Pinecone index is not initialized. Skipping vector upload.")
            return

        if not os.path.exists(self.pdf_dir):
            os.makedirs(self.pdf_dir, exist_ok=True)

        pdf_entries = []
        for item in os.listdir(self.pdf_dir):
            item_path = os.path.join(self.pdf_dir, item)
            if os.path.isfile(item_path) and item.lower().endswith(".pdf"):
                nl = item.lower()
                if "ml" in nl or "machine" in nl or "cse-3-1" in nl:
                    subj = "ML"
                elif "cn" in nl or "network" in nl:
                    subj = "CN"
                else:
                    subj = "DSA"
                pdf_entries.append((item_path, item, subj))
            elif os.path.isdir(item_path) and item.lower() not in [
                "images",
                "node_modules",
                ".git",
            ]:
                folder_subj = item.upper()
                for subfile in os.listdir(item_path):
                    if subfile.lower().endswith(".pdf"):
                        pdf_entries.append(
                            (os.path.join(item_path, subfile), subfile, folder_subj)
                        )

        if not pdf_entries:
            print("No PDF files found to process.")
            return

        tracking_file = os.path.join(self.pdf_dir, "processed_files.json")
        processed_hashes = load_processed_hashes(tracking_file)
        updated = False
        print(f"Checking {len(pdf_entries)} PDF file(s) for vector database updates...")

        db = get_db()
        for filepath, pdf_file, file_subject in pdf_entries:
            try:
                file_hash = get_file_hash(filepath)
            except Exception as e:
                print(f"Could not read/hash '{pdf_file}': {e}")
                continue

            file_is_new_or_modified = processed_hashes.get(pdf_file) != file_hash
            prereqs_exist = False
            if db is not None:
                prereqs_exist = (
                    db.prerequisites.count_documents(
                        {"document": pdf_file, "subject": file_subject}
                    )
                    > 0
                )
            prereqs_missing = not prereqs_exist

            if file_is_new_or_modified:
                print(
                    f"Reading and processing updated/new file '{pdf_file}' ({file_subject})..."
                )
                self.extract_images_from_pdf(filepath, pdf_file, subject=file_subject)
                pages = self.read_pdf_by_page(filepath)
                print(f"Generating embeddings for '{pdf_file}'...")
                chunk_data, embeddings = self.generate_embeddings_with_pages(pages)
                print(
                    f"Uploading {len(chunk_data)} vectors to Pinecone namespace '{file_subject}'..."
                )
                upload_vectors_to_pinecone(
                    index=self.index,
                    embeddings=embeddings,
                    chunk_data=chunk_data,
                    pdf_file=pdf_file,
                    subject=file_subject,
                )
                processed_hashes[pdf_file] = file_hash
                updated = True
                print(f"Successfully processed and uploaded '{pdf_file}'.")
            else:
                print(f"Skipping vector upload for '{pdf_file}' (already up-to-date).")

            if prereqs_missing:
                try:
                    print(
                        f"Generating automatic prerequisites for '{pdf_file}' ({file_subject})..."
                    )
                    self.prereq_generator.generate_for_document(
                        filepath, subject=file_subject
                    )
                except Exception as e:
                    print(f"Warning: Could not generate prerequisites for {pdf_file}: {e}")

        if updated:
            save_processed_hashes(tracking_file, processed_hashes)

    def delete_document(self, filename: str, subject: Optional[str] = None):
        """Deletes a document from disk, tracking file, vector index, and extracted images."""
        return delete_document_data(
            filename=filename,
            subject=subject,
            pdf_dir=self.pdf_dir,
            index=self.index,
            db=get_db(),
        )
