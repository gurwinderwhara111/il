# Video Cutter Advanced Notes

The detailed and current project handbook lives in `docs/user-guide/` inside this app folder.

## Current Advanced Features

- Project-based storage under `advance-clip-cutter/uploads/projects/<project-id>/`.
- Reliable Codespaces uploads with `4 MB` chunks, `4` concurrent requests, and finalize verification.
- `6 GB` app-side quota, still limited by real disk space.
- Live `9:16` preview with text layout and video layout controls.
- FFmpeg vertical render pipeline with black canvas, center-based source overlay, and burned-in title text.
- Minutes/seconds timing controls for clip length, start time, and end time.
- Realtime upload, storage, and render metrics.
- File manager for reopening, previewing, deleting, and cleaning projects.

## Current Structure

- Main app: `app.py`
- Frontend: `public/`
- Frontend modules: `public/js/`
- Optional Tkinter launcher: `desktop_app.py`
- Optional desktop shell files: `apps/desktop/`
- Old prototypes: `archive/`
- Full documentation: `docs/user-guide/`

## Setup

Use the maintained setup guide:

```text
docs/user-guide/SETUP.md
```

Quick run:

```bash
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:3000
```

## Desktop Options

Tkinter launcher:

```bash
python desktop_app.py
```

Electron files are kept under `apps/desktop/`. The Flask web app remains the primary supported workflow.
