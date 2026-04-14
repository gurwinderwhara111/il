"""Compatibility launcher for the optional desktop shell."""

from __future__ import annotations

import sys
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent / "advance-clip-cutter"
sys.path.insert(0, str(APP_DIR))

from apps.desktop.desktop_app import VideoCutterDesktop  # noqa: E402


if __name__ == "__main__":
    VideoCutterDesktop().run()
