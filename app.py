"""Compatibility launcher for the Advance Clip Cutter Flask app."""

from __future__ import annotations

import importlib.util
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent / "advance-clip-cutter"
APP_PATH = APP_DIR / "app.py"

spec = importlib.util.spec_from_file_location("advance_clip_cutter_app", APP_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to load Flask app from {APP_PATH}")

_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(_module)

app = _module.app


def __getattr__(name):
    return getattr(_module, name)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
