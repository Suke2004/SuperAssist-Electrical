"""
Native Desktop Screen Capture for Stealth AI Copilot.
Uses mss + Pillow for fast (~15ms) OS-level screen capture.
Because the SuperAssist window has WDA_EXCLUDEFROMCAPTURE set on Windows,
the OS window manager (DWM) automatically excludes the overlay window from the capture,
completely avoiding browser getDisplayMedia permission dialogs and screen sharing banners.
"""

import base64
import io
from typing import Optional
import mss
from PIL import Image

DEFAULT_MAX_CAPTURE_EDGE_PX = 2560


def capture_desktop_screenshot(max_edge_px: int = DEFAULT_MAX_CAPTURE_EDGE_PX, monitor_index: int = 1) -> str:
    """
    Capture the desktop screen natively and return a JPEG base64 data URL.

    :param max_edge_px: Max allowable dimension (longest edge) before downscaling.
    :param monitor_index: Index of monitor in mss (1 is primary monitor, 0 is all monitors combined).
    :return: Formatted data URL (e.g. 'data:image/jpeg;base64,...').
    """
    with mss.MSS() as sct:
        # If specified monitor index is out of bounds, fallback to primary or all
        if monitor_index < len(sct.monitors):
            target_monitor = sct.monitors[monitor_index]
        else:
            target_monitor = sct.monitors[0]

        sct_img = sct.grab(target_monitor)

        # Convert BGRA bytes from mss directly to RGB PIL Image
        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")

        # Downscale if larger than max_edge_px to bound request payload size
        w, h = img.size
        max_edge = max(w, h)
        if max_edge > max_edge_px:
            scale = max_edge_px / max_edge
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Save to memory buffer as JPEG
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        raw_bytes = buf.getvalue()

        b64_encoded = base64.b64encode(raw_bytes).decode("ascii")
        return f"data:image/jpeg;base64,{b64_encoded}"
