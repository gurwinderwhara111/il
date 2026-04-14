# Technical Reference

## Architecture

Advance Clip Cutter is a Flask web app with a static browser frontend.

Flask serves:

- `advance-clip-cutter/public/index.html` as the main UI.
- CSS and JavaScript from `advance-clip-cutter/public/`.
- JSON APIs for upload, chunk finalize, duration lookup, cutting, project listing, settings, storage, and cleanup.
- Runtime media files from `advance-clip-cutter/uploads/projects/`.

The frontend uses native browser modules. No bundler is required.

## Backend Ownership

`advance-clip-cutter/app.py` owns:

- Flask app creation and static file serving.
- Allowed file validation.
- Project folder creation.
- Direct upload handling.
- Parallel chunk upload handling.
- Ordered chunk assembly through `/upload-complete`.
- Project settings load/save.
- Duration lookup with MoviePy.
- FFmpeg vertical render command.
- Project/file metadata.
- Storage metrics and cleanup APIs.

Root `app.py` is only a compatibility launcher that imports and exposes the Flask `app` from `advance-clip-cutter/app.py`.

## Important Backend Constants

Defined in `advance-clip-cutter/app.py`:

- `VERTICAL_WIDTH = 1080`
- `VERTICAL_HEIGHT = 1920`
- `APP_STORAGE_QUOTA_BYTES = 6 * 1024 * 1024 * 1024`
- `ALLOWED_EXTENSIONS = {'mp4', 'mov', 'mkv', 'avi', 'webm'}`
- Flask `MAX_CONTENT_LENGTH` uses the same `6 GB` app quota.

## API Routes

- `GET /`: serves the browser app.
- `POST /upload`: direct upload path for small files.
- `POST /upload-chunk`: accepts one chunk for a chunked upload session.
- `POST /upload-complete`: verifies all chunks, assembles them in order, creates the project video, and removes temp chunks after success.
- `GET /duration/<project_id>/<filename>`: returns video duration using MoviePy.
- `POST /cut`: renders one titled vertical clip using FFmpeg.
- `GET /projects`: lists projects, source video metadata, generated clips, sizes, and saved settings.
- `GET /files`: alias for project listing.
- `GET /storage`: returns app quota usage plus actual disk free/total metrics.
- `GET /projects/<project_id>/settings`: loads saved project composition settings.
- `PUT /projects/<project_id>/settings`: saves project composition settings.
- `DELETE /projects/<project_id>`: deletes one project.
- `POST /cleanup-all`: deletes all projects.
- `POST /cleanup-temp`: deletes temporary upload chunk folders.
- `GET /uploads/<project_id>/<filename>`: serves original project video or generated clips.

## Upload Pipeline

Small files use `/upload`.

Large files use chunked upload:

1. Frontend splits the file into `4 MB` chunks.
2. Frontend uploads up to `4` chunks concurrently.
3. Each chunk posts to `/upload-chunk` with `chunk`, `filename`, `chunkIndex`, `totalChunks`, `fileId`, and `totalSize`.
4. Backend stores each chunk independently under `advance-clip-cutter/uploads/temp/<file-id>/`.
5. Backend stores session metadata in `metadata.json`.
6. Frontend calls `/upload-complete` after all chunks succeed.
7. Backend verifies every expected chunk exists.
8. Backend assembles chunks in index order into `advance-clip-cutter/uploads/projects/<project-id>/video/`.
9. Backend removes chunk files and metadata after successful assembly.

The backend does not assemble based on "last chunk received"; finalize is explicit.

## Render Pipeline

Each `/cut` request renders one clip.

Backend inputs:

- `projectId`
- `filename`
- `start`
- `end`
- `clipIndex`
- `baseTitle`
- text layout settings
- source-video layout settings

The FFmpeg filter graph:

- Creates a black `1080x1920` canvas.
- Scales the input video to fit the vertical canvas.
- Applies user `videoScale`.
- Treats `videoX` and `videoY` as center positions in the vertical frame.
- Overlays the scaled source onto the canvas, allowing overflow to crop naturally.
- Burns top-layer white text with `drawtext`.
- Outputs `yuv420p` H.264 video and maps source audio when available.

Original uploaded videos are never modified.

## Project Settings

Saved settings path:

```text
advance-clip-cutter/uploads/projects/<project-id>/settings.json
```

Current setting keys:

- `baseTitle`
- `clipLength`
- `startTime`
- `endTime`
- `textSize`
- `textX`
- `textY`
- `videoScale`
- `videoX`
- `videoY`

Backend timing values are seconds. The frontend may show minute/second helper controls.

## Storage Model

Runtime folders:

- `advance-clip-cutter/uploads/projects/<project-id>/video/`: original uploaded video.
- `advance-clip-cutter/uploads/projects/<project-id>/clips/`: generated vertical clips.
- `advance-clip-cutter/uploads/projects/<project-id>/settings.json`: saved timing and layout settings.
- `advance-clip-cutter/uploads/temp/<file-id>/`: in-progress chunk uploads.

Storage metrics include:

- project data size,
- temp chunk size,
- app quota used/remaining,
- actual disk free/total space.

## Frontend Module Ownership

- `public/script.js`: module bootstrap that imports `public/js/main.js`.
- `public/js/main.js`: startup, DOM wiring, upload flow coordination, cutting flow, and bulk downloads.
- `public/js/api.js`: fetch wrappers and response parsing.
- `public/js/composer.js`: live preview, settings reads/writes, timing calculations, and project setting persistence.
- `public/js/upload.js`: direct upload, chunked upload, retries, finalize call, and upload progress.
- `public/js/metrics.js`: upload, storage, and render metrics cards.
- `public/js/projects.js`: project manager, open/delete/cleanup actions, and storage refresh.
- `public/js/state.js`: shared state and DOM references.
- `public/js/ui.js`: status messages, progress text, and debug log.
- `public/js/utils.js`: constants, byte/time formatters, title helpers, and shared utility functions.

## Codespaces Notes

The app is tuned for Codespaces reliability:

- `32 MB` chunks were rejected by nginx with `413`.
- `4 MB` chunks avoid the observed proxy limit.
- Chunk concurrency `4` improves throughput without one huge request.
- The `6 GB` app-side quota is not a promise that every Codespace has enough free disk.

See `CODESPACES_ENV_REPORT.md` for measured CPU, RAM, disk, and network details.
