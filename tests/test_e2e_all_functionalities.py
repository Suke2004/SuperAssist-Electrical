"""
End-to-End Integration Smoke Test for SuperAssist EE.
Verifies all major system components and features in a single automated suite:
1. Config & Startup Integrity
2. STT Electrical Phonetic Normalization
3. Electrical Domain Prompt Engine & Smart Trimming
4. Dynamic Token Budgeting & Think-Tag Sanitization
5. Native Stealth Screen Capture Pipeline
6. FastAPI API Routes & Endpoints
"""

import base64
import io
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

# 1. Imports from application
from core.config import settings
from services.stt_service import clean_electrical_transcript
from core.prompts import (
    get_interview_answer_prompt,
    build_unlimited_candidate_profile,
    _power_systems_template,
    _control_systems_template,
    _measurements_template,
    _drawing_template,
)
from services.context_manager import PersistentContextManager
from services.llm_service import calculate_max_tokens_budget, ThinkTagFilter
from core.screen_capture import capture_desktop_screenshot
from main import app


def test_01_config_and_startup_integrity():
    """Verify settings load cleanly with optional Deepgram key."""
    assert hasattr(settings, "DEEPGRAM_API_KEY")
    assert hasattr(settings, "LOG_LEVEL")
    assert hasattr(settings, "GENERATE_FULL_ANSWERS")
    assert hasattr(settings, "TRACK_CANDIDATE_RESPONSES")


def test_02_stt_electrical_phonetics():
    """Verify Indian/International acoustic mishearings are restored to exact EE terminology."""
    raw_audio_stt = "Explain the fair and tea effect on long lines with din eleven vector group and boat plot stability"
    cleaned = clean_electrical_transcript(raw_audio_stt)
    assert "Ferranti effect" in cleaned
    assert "Dyn11" in cleaned
    assert "Bode plot" in cleaned

    corona_stt = clean_electrical_transcript("What causes coroner discharge and how does peter sun coil mitigate faults")
    assert "corona discharge" in corona_stt.lower()
    assert "Peterson coil" in corona_stt


def test_03_prompts_electrical_domain_specialization():
    """Verify specialized domain templates and symbolic derivation routing."""
    ctx = PersistentContextManager()
    ctx.initialize_persistent_context({
        "name": "Arjun Rao",
        "company": "PowerGrid",
        "role": "Protection Engineer",
        "resume": "Experienced in substation automation and distance protection relays.",
    })

    # Power systems query
    pwr_prompt = get_interview_answer_prompt("Explain Zone 1 reach and coordination delay of distance relay in 400kV line", ctx)
    assert "POWER SYSTEMS" in pwr_prompt
    assert "Zone 1" in pwr_prompt or "Zone" in pwr_prompt

    # Control systems query
    ctrl_prompt = get_interview_answer_prompt("What are Gain Margin and Phase Margin in Bode plot and Nyquist criterion", ctx)
    assert "CONTROL SYSTEMS" in ctrl_prompt
    assert "Gain Margin" in ctrl_prompt
    assert "Phase Crossover" in ctrl_prompt

    # Measurements query
    meas_prompt = get_interview_answer_prompt("Derive three phase power using two-wattmeter method with power factor", ctx)
    assert "ELECTRICAL MEASUREMENTS" in meas_prompt
    assert "tan(phi)" in meas_prompt or "two-wattmeter" in meas_prompt.lower()

    # Substation SLD Drawing query
    draw_prompt = get_interview_answer_prompt("Draw single line diagram SLD of 220kV bay with breaker and isolator", ctx)
    assert "DRAW-CIRCUIT" in draw_prompt or "SCHEMATIC" in draw_prompt or "svg" in draw_prompt.lower()


def test_04_smart_resume_trimming():
    """Verify resume is trimmed on technical viva questions and preserved on project questions."""
    huge_resume = "Key skills: Motors, Transformers. " + ("Project milestone details. " * 80)
    ctx = PersistentContextManager()
    ctx.initialize_persistent_context({
        "name": "Arjun Rao",
        "company": "ABB",
        "role": "Drives Engineer",
        "resume": huge_resume,
    })

    tech_prompt = get_interview_answer_prompt("Explain the working of variable frequency drive VFD", ctx)
    assert "[trimmed for technical speed]" in tech_prompt

    proj_prompt = get_interview_answer_prompt("Tell me about your hardware project milestone details", ctx)
    assert "[trimmed for technical speed]" not in proj_prompt
    assert "Project milestone details." in proj_prompt


def test_05_dynamic_token_budget_and_think_tag_filter():
    """Verify dynamic token budgets and streaming think-tag sanitization."""
    # Token budgets
    assert calculate_max_tokens_budget("draw the circuit diagram of buck converter", use_full_answers=True) == 1200
    assert calculate_max_tokens_budget("derive torque equation of 3-phase induction motor", use_full_answers=True) == 900
    assert calculate_max_tokens_budget("what is skin effect", use_full_answers=True) == 650
    assert calculate_max_tokens_budget("what is skin effect", use_full_answers=False) == 300

    # ThinkTagFilter
    tag_filter = ThinkTagFilter()
    stream_chunks = [
        "<th",
        "ink>First calculate the slip s = (Ns - Nr)/Ns.",
        " Then check max torque.",
        "</think>",
        "The condition for maximum torque is R2 = s * X2."
    ]
    output = []
    for chunk in stream_chunks:
        filtered = tag_filter.process(chunk)
        if filtered:
            output.append(filtered)
    final_tail = tag_filter.flush()
    if final_tail:
        output.append(final_tail)

    joined_output = "".join(output)
    assert "<think>" not in joined_output
    assert "</think>" not in joined_output
    assert "First calculate the slip" not in joined_output
    assert "The condition for maximum torque is R2 = s * X2." in joined_output


def test_06_native_screen_capture_pipeline(monkeypatch):
    """Verify screen capture base64 JPEG encoding and auto-downscaling."""
    from PIL import Image

    class MockScreenGrab:
        def __init__(self):
            self.size = (3840, 2160)
            self.bgra = b"\x00\xff\x00\xff" * (3840 * 2160)

    mock_sct = MagicMock()
    mock_sct.monitors = [{"left": 0, "top": 0, "width": 3840, "height": 2160}, {"left": 0, "top": 0, "width": 3840, "height": 2160}]
    mock_sct.grab.return_value = MockScreenGrab()
    mock_mss_cls = MagicMock()
    mock_mss_cls.return_value.__enter__.return_value = mock_sct

    monkeypatch.setattr("mss.MSS", mock_mss_cls)

    data_url = capture_desktop_screenshot(max_edge_px=1200)
    assert data_url.startswith("data:image/jpeg;base64,")

    b64_str = data_url.split(",", 1)[1]
    decoded = base64.b64decode(b64_str)
    assert decoded[:2] == b"\xff\xd8"  # JPEG signature

    img = Image.open(io.BytesIO(decoded))
    w, h = img.size
    assert max(w, h) <= 1200


def test_07_fastapi_endpoints_smoke():
    """Verify all key REST endpoints respond correctly."""
    client = TestClient(app)

    # Transparency endpoint
    r_trans = client.get("/api/transparency")
    assert r_trans.status_code == 200

    # Preset transparency endpoint (returns 200 with GUI window, 400 in headless test)
    r_preset = client.post("/api/transparency/presets/semi-transparent")
    assert r_preset.status_code in (200, 400)

    # Config endpoint
    r_conf = client.get("/api/config")
    assert r_conf.status_code == 200
    assert "LOG_LEVEL" in r_conf.json()

    # Capture screenshot endpoint (returns 200 with display, 500 in headless test)
    r_snap = client.post("/api/capture_screenshot")
    assert r_snap.status_code in (200, 500)
