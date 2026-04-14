# Workspace Overview

This workspace contains the active cutter app in `advance-clip-cutter/`.

The root is intentionally small:

- `app.py`: compatibility launcher for `advance-clip-cutter/app.py`
- `desktop_app.py`: compatibility launcher for the optional desktop wrapper
- `requirements.txt`: delegates to `advance-clip-cutter/requirements.txt`
- `i3-offline-cutter/`: separate project, left untouched

## Quick Run From Root

```bash
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:3000
```

## Direct App Run

```bash
cd advance-clip-cutter
pip install -r requirements.txt
python app.py
```

## Documentation

- App guide: `advance-clip-cutter/docs/user-guide/README.md`
- Setup: `advance-clip-cutter/docs/user-guide/SETUP.md`
- PRD: `advance-clip-cutter/docs/user-guide/PRD.md`
- Technical reference: `advance-clip-cutter/docs/user-guide/TECHNICAL_REFERENCE.md`
