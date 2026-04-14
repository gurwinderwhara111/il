# Setup Guide

This guide explains how to run Advance Clip Cutter in GitHub Codespaces or on a local machine.

## Requirements Before Running

- Python `3.10+`; Python `3.12` is recommended.
- `ffmpeg` and `ffprobe` available on `PATH`.
- A modern browser with JavaScript module support.
- Several GB of free disk space for uploaded videos, generated clips, and temporary chunks.
- Optional Node.js only if you want to inspect archived prototypes or optional Electron files.

## Run From Repository Root

Use this path when you are in `/workspaces/il` or the cloned repository root.

```bash
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:3000
```

Root files are compatibility wrappers. `app.py` loads `advance-clip-cutter/app.py`, and root `requirements.txt` delegates to `advance-clip-cutter/requirements.txt`.

## Run From App Folder

Use this path when you want to work directly inside the canonical app folder.

```bash
cd advance-clip-cutter
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:3000
```

## GitHub Codespaces Setup

1. Open the repository in Codespaces.

2. Confirm Python is available:

```bash
python --version
```

3. Install Python dependencies from the repository root:

```bash
pip install -r requirements.txt
```

4. Confirm FFmpeg is installed:

```bash
ffmpeg -version
ffprobe -version
```

5. Start the app:

```bash
python app.py
```

6. Open the forwarded port for `3000`.

7. Upload a small test video first and verify:

- duration appears,
- live preview appears,
- one short clip renders,
- generated clip appears in File Manager.

## Local Setup: macOS/Linux

1. Clone or open the repository.

2. Create a virtual environment from the repository root:

```bash
python -m venv .venv
```

3. Activate it:

```bash
source .venv/bin/activate
```

4. Install Python dependencies:

```bash
pip install -r requirements.txt
```

5. Install FFmpeg if it is missing.

On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install ffmpeg
```

On macOS with Homebrew:

```bash
brew install ffmpeg
```

6. Verify FFmpeg:

```bash
ffmpeg -version
ffprobe -version
```

7. Start the app:

```bash
python app.py
```

8. Open:

```text
http://127.0.0.1:3000
```

## Local Setup: Windows PowerShell

1. Open PowerShell in the repository root.

2. Create a virtual environment:

```powershell
python -m venv .venv
```

3. Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

4. Install Python dependencies:

```powershell
pip install -r requirements.txt
```

5. Install FFmpeg and make sure `ffmpeg.exe` and `ffprobe.exe` are available on `PATH`.

6. Verify FFmpeg:

```powershell
ffmpeg -version
ffprobe -version
```

7. Start the app:

```powershell
python app.py
```

8. Open:

```text
http://127.0.0.1:3000
```

## Verification Commands

Run these from the repository root after setup:

```bash
python -m py_compile app.py desktop_app.py advance-clip-cutter/app.py advance-clip-cutter/apps/desktop/desktop_app.py
python -c "from app import app; print(app.name); print(app.static_folder)"
```

Optional frontend syntax checks if Node is installed:

```bash
node --check advance-clip-cutter/public/script.js
find advance-clip-cutter/public/js -maxdepth 1 -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

## Runtime Data

The app creates and uses:

- `advance-clip-cutter/uploads/projects/`: uploaded source videos, generated clips, and settings.
- `advance-clip-cutter/uploads/temp/`: temporary parallel upload chunks.

These folders can become large. They are runtime data, not source code.

## Common Issues

- `ffmpeg not found`: install FFmpeg and make sure it is on `PATH`.
- `413 Request Entity Too Large`: request chunks are too large for the Codespaces proxy. Current app tuning uses `4 MB` chunks.
- Slow Codespaces upload: browser-to-Codespaces ingress can be slower than your local Wi-Fi.
- No folder save prompt for Download All: browser does not support File System Access API; clips will download sequentially.
- Render fails on invalid media: confirm the uploaded file opens locally and `ffprobe` can inspect it.
