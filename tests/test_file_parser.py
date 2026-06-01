import pytest
from memoryweave.files.parser import chunk_text, parse_file


def test_parse_plain_text():
    data = b"Hello world"
    assert parse_file(data, "txt") == "Hello world"


def test_parse_utf8_code():
    data = "def foo():\n    pass\n".encode("utf-8")
    assert "def foo" in parse_file(data, "py")


def test_parse_unsupported_type_raises():
    with pytest.raises(ValueError, match="Unsupported file type"):
        parse_file(b"data", "docx")


def test_chunk_text_single_chunk():
    text = "a" * 100
    chunks = chunk_text(text, max_chars=2048, overlap=256)
    assert chunks == [text]


def test_chunk_text_splits_correctly():
    text = "x" * 4096
    chunks = chunk_text(text, max_chars=2048, overlap=256)
    assert len(chunks) == 2
    assert len(chunks[0]) == 2048
    assert chunks[1].startswith("x" * 256)


def test_chunk_text_overlap_content():
    text = "AB" * 2048  # 4096 chars
    chunks = chunk_text(text, max_chars=2048, overlap=256)
    assert chunks[0][-256:] == chunks[1][:256]


def test_chunk_empty_text():
    assert chunk_text("") == []


def test_parse_pdf_returns_string():
    pytest.importorskip("reportlab")
    from io import BytesIO
    from reportlab.pdfgen import canvas
    buf = BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 750, "Test PDF content")
    c.save()
    result = parse_file(buf.getvalue(), "pdf")
    assert isinstance(result, str)
    assert len(result) > 0
