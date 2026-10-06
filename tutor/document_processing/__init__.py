"""Document processing pipeline: PDF reading, chunking, embedding, image extraction, indexing."""

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
from tutor.document_processing.pipeline import DocumentProcessor

__all__ = [
    "DocumentProcessor",
    "read_pdf",
    "read_pdf_by_page",
    "chunk_text",
    "chunk_text_with_pages",
    "generate_embeddings",
    "generate_embeddings_with_pages",
    "is_quality_image",
    "extract_images_from_pdf",
    "get_file_hash",
    "load_processed_hashes",
    "save_processed_hashes",
    "upload_vectors_to_pinecone",
    "delete_document_data",
]
