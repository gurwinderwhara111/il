# Project Structure

The active app is self-contained in `advance-clip-cutter/`. The repository root only keeps compatibility launchers, root setup files, and separate projects.

## Repository Root

- `app.py`: compatibility launcher that loads `advance-clip-cutter/app.py` and exposes `app` for `python app.py` and `from app import app`.
- `desktop_app.py`: compatibility launcher for the optional desktop wrapper in `advance-clip-cutter/apps/desktop/`.
- `requirements.txt`: delegates to `advance-clip-cutter/requirements.txt`.
- `README.md`: workspace overview and quick-start commands.
- `.gitignore`: ignores runtime uploads, caches, dependency folders, and local machine noise.
- `advance-clip-cutter/`: canonical active app folder.
- `i3-offline-cutter/`: separate project. Do not move, edit, or use it for this cutter.

## App Root

- `advance-clip-cutter/app.py`: real Flask server, upload APIs, render APIs, project storage, settings, storage metrics, and static file serving.
- `advance-clip-cutter/requirements.txt`: Python dependencies for the active Flask app.
- `advance-clip-cutter/README.md`: app-local overview.
- `advance-clip-cutter/README_ADVANCED.md`: advanced feature notes.
- `advance-clip-cutter/CODESPACES_ENV_REPORT.md`: app-level Codespaces performance report.

## Active Frontend

- `advance-clip-cutter/public/index.html`: main browser interface.
- `advance-clip-cutter/public/styles.css`: active styling, responsive layout, preview/settings workspace, metrics panel, and mobile UI.
- `advance-clip-cutter/public/script.js`: small module bootstrap.
- `advance-clip-cutter/public/js/main.js`: app startup, event binding, upload orchestration, cutting loop, and download-all behavior.
- `advance-clip-cutter/public/js/api.js`: backend API request helpers.
- `advance-clip-cutter/public/js/composer.js`: live `9:16` preview, clip count calculation, timing controls, layout controls, and settings persistence.
- `advance-clip-cutter/public/js/upload.js`: direct upload, chunked upload, retry behavior, and upload finalization.
- `advance-clip-cutter/public/js/metrics.js`: realtime upload, storage, disk, and render metrics display.
- `advance-clip-cutter/public/js/projects.js`: project/file manager actions and cleanup flows.
- `advance-clip-cutter/public/js/state.js`: shared frontend state and cached DOM references.
- `advance-clip-cutter/public/js/ui.js`: status text, progress text, and debug log helpers.
- `advance-clip-cutter/public/js/utils.js`: constants, formatting helpers, title helpers, and time helpers.

## Runtime Storage

- `advance-clip-cutter/uploads/projects/<project-id>/video/`: original uploaded source video.
- `advance-clip-cutter/uploads/projects/<project-id>/clips/`: generated vertical clips.
- `advance-clip-cutter/uploads/projects/<project-id>/settings.json`: saved base title, timing, text layout, and video layout.
- `advance-clip-cutter/uploads/temp/<file-id>/`: temporary chunk upload files and metadata.

Runtime folders can become large and should not be treated as source code.

## Documentation

- `advance-clip-cutter/docs/user-guide/README.md`: documentation entry point.
- `advance-clip-cutter/docs/user-guide/PRD.md`: product requirements and workflows.
- `advance-clip-cutter/docs/user-guide/SETUP.md`: Codespaces and local setup instructions.
- `advance-clip-cutter/docs/user-guide/DEPENDENCIES.md`: Python, system, browser, optional desktop, and storage requirements.
- `advance-clip-cutter/docs/user-guide/TECHNICAL_REFERENCE.md`: APIs, render pipeline, upload pipeline, settings, and storage model.
- `advance-clip-cutter/docs/user-guide/PROJECT_STRUCTURE.md`: this file.
- `advance-clip-cutter/docs/user-guide/CODESPACES_ENV_REPORT.md`: copied Codespaces performance report.

## Optional Desktop Shell

- `advance-clip-cutter/apps/desktop/desktop_app.py`: optional Tkinter desktop shell.
- `advance-clip-cutter/apps/desktop/electron-main.js`: optional Electron main process file.
- `advance-clip-cutter/apps/desktop/package.json`: optional Electron package metadata.

The primary supported workflow is still the Flask web app.

## Archive

- `advance-clip-cutter/archive/README.md`: archive notes.
- `advance-clip-cutter/archive/prototypes/server.js`: old Express prototype.
- `advance-clip-cutter/archive/prototypes/clipper.py`: old standalone clipping script.
- `advance-clip-cutter/archive/prototypes/package.json`: old Node prototype metadata.
- `advance-clip-cutter/archive/prototypes/package-lock.json`: old Node prototype lockfile.
- `advance-clip-cutter/archive/prototypes/node_modules/`: archived legacy dependency tree if present in the workspace.
- `advance-clip-cutter/archive/styles/`: old duplicate CSS/reference styles.

Archived files are retained for reference and are not part of the active Flask runtime.

## Where To Debug Features

- Upload speed, chunk size, retries, and finalize behavior: `public/js/upload.js`, `public/js/metrics.js`, and `/upload-chunk` or `/upload-complete` in `app.py`.
- Render failures, title overlay, vertical canvas, and FFmpeg command behavior: `/cut` and `build_vertical_filter_graph()` in `app.py`.
- Live preview mismatch: `public/js/composer.js` and `build_vertical_filter_graph()` in `app.py`.
- Project listing, delete, cleanup, and storage display: `public/js/projects.js`, `public/js/metrics.js`, and project/storage routes in `app.py`.
- Setup or dependency questions: `docs/user-guide/SETUP.md` and `docs/user-guide/DEPENDENCIES.md`.

## Folder To Leave Alone

`i3-offline-cutter/` is a separate project and is intentionally not part of Advance Clip Cutter. Do not modify it when working on this app.
