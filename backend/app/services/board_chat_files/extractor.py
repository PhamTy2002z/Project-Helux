"""Text extraction handlers for board chat file uploads."""

from __future__ import annotations

import csv
import io
import json
from contextlib import suppress

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Mapping of MIME type to extraction handler name
_MIME_HANDLERS: dict[str, str] = {
    "text/plain": "text",
    "text/markdown": "text",
    "text/csv": "csv",
    "application/json": "json",
    "application/pdf": "pdf",
}

# File extension to MIME type fallback
_EXT_TO_MIME: dict[str, str] = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".pdf": "application/pdf",
}


def resolve_mime(file_name: str, content_type: str) -> str:
    """Resolve MIME type from content-type header with extension fallback."""
    normalized = content_type.split(";")[0].strip().lower()
    if normalized in _MIME_HANDLERS:
        return normalized
    # Fallback to extension-based detection
    dot_idx = file_name.rfind(".")
    if dot_idx >= 0:
        ext = file_name[dot_idx:].lower()
        if ext in _EXT_TO_MIME:
            return _EXT_TO_MIME[ext]
    return normalized


def is_allowed_type(file_name: str, content_type: str) -> bool:
    """Check if the file type is in the V1 allowlist."""
    mime = resolve_mime(file_name, content_type)
    return mime in _MIME_HANDLERS


def extract_text(data: bytes, mime_type: str) -> str:
    """Extract plain text from file bytes based on MIME type.

    Returns the extracted text (possibly empty for unreadable PDFs).
    Raises ValueError on extraction failure.
    """
    handler_name = _MIME_HANDLERS.get(mime_type)
    if handler_name is None:
        raise ValueError(f"No extraction handler for MIME type: {mime_type}")

    if handler_name == "text":
        return _extract_text_plain(data)
    if handler_name == "csv":
        return _extract_csv(data)
    if handler_name == "json":
        return _extract_json(data)
    if handler_name == "pdf":
        return _extract_pdf(data)
    raise ValueError(f"Unknown handler: {handler_name}")


def extract_preview(full_text: str) -> str:
    """Truncate extracted text to the configured preview length."""
    max_chars = settings.board_chat_file_preview_max_chars
    if len(full_text) <= max_chars:
        return full_text
    return full_text[:max_chars]


def _extract_text_plain(data: bytes) -> str:
    """Extract text from plain text / markdown files."""
    return data.decode("utf-8", errors="replace")


def _extract_csv(data: bytes) -> str:
    """Extract text from CSV by reading all rows into a readable format."""
    text = data.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    lines: list[str] = []
    for row in reader:
        lines.append(" | ".join(row))
    return "\n".join(lines)


def _extract_json(data: bytes) -> str:
    """Extract text from JSON by pretty-printing."""
    text = data.decode("utf-8", errors="replace")
    parsed = json.loads(text)
    return json.dumps(parsed, indent=2, ensure_ascii=False)


def _extract_pdf(data: bytes) -> str:
    """Extract text from PDF using text layer, then OCR fallback when needed."""
    text = _read_pdf_text_with_pypdf(data)
    if text:
        return text
    return _extract_pdf_with_ocr(data)


def _read_pdf_text_with_pypdf(data: bytes) -> str:
    """Extract PDF text from embedded text layer via pypdf."""
    try:
        from pypdf import PdfReader
    except ImportError:
        logger.warning("pdf.extraction.pypdf_not_installed")
        return ""

    reader = PdfReader(io.BytesIO(data))
    pages: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            pages.append(page_text)
    if not pages:
        return ""
    return "\n\n".join(pages)


def _extract_pdf_with_ocr(data: bytes) -> str:
    """OCR fallback for image-based PDFs when text-layer extraction is empty."""
    if not settings.board_chat_file_pdf_ocr_enabled:
        return ""

    try:
        import pypdfium2 as pdfium
        import pytesseract
    except ImportError:
        logger.warning("pdf.ocr.dependencies_missing")
        return ""

    language = settings.board_chat_file_pdf_ocr_lang.strip() or "eng"
    pages: list[str] = []
    doc = None
    try:
        doc = pdfium.PdfDocument(io.BytesIO(data))
        page_count = min(len(doc), settings.board_chat_file_pdf_ocr_max_pages)
        for idx in range(page_count):
            page = doc[idx]
            bitmap = None
            image = None
            try:
                bitmap = page.render(scale=settings.board_chat_file_pdf_ocr_render_scale)
                image = bitmap.to_pil()
                text = pytesseract.image_to_string(image, lang=language)
                normalized = text.strip()
                if normalized:
                    pages.append(normalized)
            except Exception:
                logger.exception("pdf.ocr.page_failed", extra={"page_index": idx})
            finally:
                with suppress(Exception):
                    if image is not None:
                        image.close()
                with suppress(Exception):
                    if bitmap is not None:
                        bitmap.close()
                with suppress(Exception):
                    page.close()
    except Exception:
        logger.exception("pdf.ocr.document_failed")
    finally:
        with suppress(Exception):
            if doc is not None:
                doc.close()

    if pages:
        logger.info(
            "pdf.ocr.fallback_succeeded",
            extra={
                "ocr_page_count": len(pages),
                "ocr_max_pages": settings.board_chat_file_pdf_ocr_max_pages,
            },
        )
    return "\n\n".join(pages)
