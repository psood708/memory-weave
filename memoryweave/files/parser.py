from __future__ import annotations

ALLOWED_EXTENSIONS = {
    "pdf", "txt", "md", "py", "js", "ts", "json", "yaml", "yml", "toml",
}


def parse_file(data: bytes, file_type: str) -> str:
    """Extract plain text from file bytes. Raises ValueError for unsupported types."""
    ext = file_type.lower().lstrip(".")
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}")
    if ext == "pdf":
        return _parse_pdf(data)
    return data.decode("utf-8", errors="replace")


def chunk_text(text: str, max_chars: int = 2048, overlap: int = 256) -> list[str]:
    """Split text into overlapping chunks of at most max_chars characters.

    Chunk boundaries are placed every max_chars characters. Each chunk except the
    first backs up by `overlap` characters so consecutive chunks share that many
    characters at their boundary.
    """
    if not text:
        return []
    chunks: list[str] = []
    i = 0
    while i * max_chars < len(text):
        start = max(0, i * max_chars - overlap)
        end = (i + 1) * max_chars
        chunks.append(text[start:end])
        i += 1
    return chunks


def _parse_pdf(data: bytes) -> str:
    from io import BytesIO
    import pypdf
    reader = pypdf.PdfReader(BytesIO(data))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)
