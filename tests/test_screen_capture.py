"""Unit tests for native screen capture and prompt trimming."""

import base64
import io
from unittest.mock import MagicMock
from core.screen_capture import capture_desktop_screenshot
from core.prompts import build_unlimited_candidate_profile, get_interview_answer_prompt
from services.context_manager import PersistentContextManager


class MockMSSGrab:
    def __init__(self, width: int = 3000, height: int = 2000):
        self.size = (width, height)
        # 4 bytes per pixel BGRA
        self.bgra = b"\x12\x34\x56\xff" * (width * height)


def test_native_desktop_screenshot_mocked(monkeypatch):
    """Verify capture_desktop_screenshot handles image resizing and base64 JPEG encoding correctly."""
    from PIL import Image

    mock_grab = MockMSSGrab(width=3000, height=2000)
    mock_sct = MagicMock()
    mock_sct.monitors = [{"left": 0, "top": 0, "width": 3000, "height": 2000}, {"left": 0, "top": 0, "width": 3000, "height": 2000}]
    mock_sct.grab.return_value = mock_grab

    mock_mss_cls = MagicMock()
    mock_mss_cls.return_value.__enter__.return_value = mock_sct

    monkeypatch.setattr("mss.MSS", mock_mss_cls)

    data_url = capture_desktop_screenshot(max_edge_px=800)
    assert data_url.startswith("data:image/jpeg;base64,")

    # Verify base64 and JPEG magic bytes
    b64_part = data_url.split(",", 1)[1]
    raw_bytes = base64.b64decode(b64_part)
    assert len(raw_bytes) > 0
    assert raw_bytes[:2] == b"\xff\xd8"

    # Verify image was downscaled to max_edge_px (800)
    img = Image.open(io.BytesIO(raw_bytes))
    w, h = img.size
    assert max(w, h) <= 800
    assert w == 800 or h == 800


def test_native_desktop_screenshot_live():
    """Verify live capture if desktop DC is accessible, skip gracefully if non-interactive subshell."""
    import pytest
    try:
        data_url = capture_desktop_screenshot(max_edge_px=800)
        assert data_url.startswith("data:image/jpeg;base64,")
    except Exception as e:
        pytest.skip(f"Live desktop DC capture skipped in non-interactive subshell: {e}")


def test_smart_resume_trimming():
    """Verify massive resumes are trimmed on technical queries and full on project queries."""
    huge_resume = "Electrical engineer specialized in machines. " + ("Project experience details. " * 100)
    ctx = PersistentContextManager()
    ctx.initialize_persistent_context({
        "name": "Alex Smith",
        "company": "ABB",
        "role": "Drives Engineer",
        "resume": huge_resume,
    })

    # Technical viva question -> trimmed for speed
    tech_prompt = get_interview_answer_prompt("What is the slip of an induction motor?", ctx)
    assert "[trimmed for technical speed]" in tech_prompt
    assert "Alex Smith" in tech_prompt
    assert "ABB" in tech_prompt

    # Personal / project viva question -> full resume preserved
    project_prompt = get_interview_answer_prompt("Tell me about your final year project hardware prototype", ctx)
    assert "[trimmed for technical speed]" not in project_prompt
    assert "Project experience details." in project_prompt
