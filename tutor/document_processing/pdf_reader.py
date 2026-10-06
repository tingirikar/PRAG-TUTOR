"""PDF text reading utilities with PyMuPDF acceleration and pdfplumber fallback."""

from typing import List, Tuple

try:
    import pymupdf as fitz  # PyMuPDF (modern import)
except ImportError:
    try:
        import fitz  # PyMuPDF (legacy import)
    except ImportError:
        fitz = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


def read_pdf(pdf_file: str) -> str:
    """Reads a PDF file and returns its complete text content with PyMuPDF acceleration."""
    if fitz is not None:
        try:
            doc = fitz.open(pdf_file)
            text = "".join(page.get_text() or "" for page in doc)
            doc.close()
            return text
        except Exception as e:
            print(f"[Warning] PyMuPDF text read failed ({e}), falling back to pdfplumber...")

    if pdfplumber is not None:
        text_content = ""
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                text_content += page.extract_text() or ""
        return text_content

    print("[Error] Neither PyMuPDF nor pdfplumber is available to read PDF.")
    return ""


def read_pdf_by_page(pdf_file: str) -> List[Tuple[int, str]]:
    """Reads a PDF and returns a list of (page_number, page_text) tuples."""
    pages = []
    if fitz is not None:
        try:
            doc = fitz.open(pdf_file)
            for page_num, page in enumerate(doc):
                pages.append((page_num, page.get_text() or ""))
            doc.close()
            return pages
        except Exception as e:
            print(f"[Warning] PyMuPDF page extraction failed ({e}), falling back to pdfplumber...")

    if pdfplumber is not None:
        with pdfplumber.open(pdf_file) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages.append((page_num, text))
        return pages

    print("[Error] Neither PyMuPDF nor pdfplumber is available to read PDF by page.")
    return []
