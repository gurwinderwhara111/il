# Dependencies

This project has one active runtime stack: Flask backend plus browser-native frontend modules. Node-related files are archived or optional and are not required for the active app.

## Python Dependencies

Declared in `advance-clip-cutter/requirements.txt`:

- `Flask>=2.3.0`: web server, static file serving, API routes, request parsing, and JSON responses.
- `Werkzeug>=2.3.0`: secure filenames and Flask-compatible request/file helpers.
- `moviepy>=1.0.3`: source-video duration lookup through `VideoFileClip`.

Install from repository root:

```bash
pip install -r requirements.txt
```

Install from app folder:

```bash
cd advance-clip-cutter
pip install -r requirements.txt
```

## System Dependencies

- `ffmpeg`: required for final vertical clip rendering in `/cut`.
- `ffprobe`: normally installed with FFmpeg and useful for validating media files.

The app calls `ffmpeg` as an external command, so it must be installed on the machine and available on `PATH`. FFmpeg is not committed to the repository.

Check availability:

```bash
ffmpeg -version
ffprobe -version
```

## Browser Requirements

- Modern JavaScript module support.
- HTML video playback for the uploaded source format.
- Canvas/CSS support for the live `9:16` preview.
- Optional File System Access API for saving all clips into a chosen folder.

Browsers without folder-save support can still download all clips sequentially.

## Active Frontend Dependencies

The active frontend uses plain browser JavaScript modules under `advance-clip-cutter/public/js/`. It has no bundler and no required npm install step.

Important module constants live in `advance-clip-cutter/public/js/utils.js`:

- `CHUNK_SIZE_BYTES = 4 * 1024 * 1024`
- `CHUNK_UPLOAD_CONCURRENCY = 4`
- `DIRECT_UPLOAD_THRESHOLD_MB = 8`
- `CHUNK_RETRY_LIMIT = 2`

## Optional Desktop Dependencies

Optional desktop shell files live under `advance-clip-cutter/apps/desktop/`.

- `desktop_app.py`: Tkinter-based wrapper around the Flask app.
- `electron-main.js` and `package.json`: optional Electron shell metadata.

These files are not required for the normal Flask web workflow.

## Archived Node Prototype Dependencies

Legacy Node prototype metadata lives under `advance-clip-cutter/archive/prototypes/`.

Archived dependencies include:

- `express`
- `multer`
- `fluent-ffmpeg`

The active app does not require Node, Express, Multer, or fluent-ffmpeg.

## Storage Requirements

The app-side quota is `6 GB`, defined in `advance-clip-cutter/app.py` as:

```python
APP_STORAGE_QUOTA_BYTES = 6 * 1024 * 1024 * 1024
```

Real usable capacity depends on actual disk free space. Codespaces can run out of room before or after the app quota depending on uploaded videos, generated clips, temporary chunks, caches, and dependencies.

Runtime storage lives under:

- `advance-clip-cutter/uploads/projects/`
- `advance-clip-cutter/uploads/temp/`

## Media Requirements

Allowed input extensions:

- `mp4`
- `mov`
- `mkv`
- `avi`
- `webm`

Generated clips are MP4 outputs rendered by FFmpeg with H.264 video and AAC audio when source audio exists.

## Codespaces Performance Notes

The Codespaces report showed:

- 4 vCPU.
- About 15 GiB RAM.
- 32 GB workspace volume.
- Local disk throughput was not the browser upload bottleneck.
- `32 MB` upload chunks triggered `413 Request Entity Too Large`.
- The app now uses `4 MB` chunks for reliability.

See `CODESPACES_ENV_REPORT.md` for the copied full report.
