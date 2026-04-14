# PRD: Advance Clip Cutter

## Summary

Advance Clip Cutter is a local/Codespaces-friendly web app for turning long source videos into numbered vertical clips. It focuses on creator workflows where users upload a horizontal or screen-recorded video, choose a time range, preview a `9:16` layout, burn title text onto every generated clip, and download the results from the project file manager.

## Primary Users

- Creators cutting movies, tutorials, streams, meetings, or screen recordings into short social clips.
- Codespaces users who need reliable uploads despite proxy request-size limits.
- Local users who want a simple browser UI without external cloud storage.
- Maintainers who need a clear project structure and predictable runtime folders.

## Product Goals

- Upload large videos reliably in Codespaces and locally.
- Keep each upload organized as a project with source video, generated clips, and saved settings.
- Generate multiple clips automatically from a selected start/end range and clip length.
- Render `1080x1920` vertical clips with a black canvas, centered source-video overlay, and burned-in text.
- Keep preview and final FFmpeg output aligned for text size, text position, video scale, and video center.
- Show useful realtime metrics for upload speed, chunk progress, storage usage, disk free space, and render progress.
- Keep setup simple enough for a new Codespace or local machine.

## Core User Flows

1. Upload a video:
   - User chooses an allowed video file.
   - Files under `8 MB` use direct upload.
   - Files `8 MB` and larger use parallel chunked upload with `4 MB` chunks and concurrency `4`.
   - The app creates a project and saves the original video untouched.

2. Configure clips:
   - User enters a base title, clip length, start time, and end time.
   - UI supports minute/second timing controls to reduce manual seconds math.
   - UI live-calculates how many clips can be generated.
   - Preview text follows the pattern `Base Title Clip N`.

3. Preview layout:
   - User sees a live `9:16` browser preview.
   - User adjusts text size, text X/Y, source-video scale, and source-video X/Y center.
   - Settings are saved per project and restored when the project is reopened.

4. Render clips:
   - User starts cutting.
   - Frontend sends one `/cut` request per clip.
   - Backend uses FFmpeg to render titled vertical clips.
   - Outputs are named from the normalized title, such as `john-wick-clip-1.mp4`.

5. Manage and download:
   - File manager lists projects and generated clips.
   - User can reopen projects, delete one project, clean temp upload chunks, delete all projects, or download clips.
   - Download-all uses folder saving when supported by the browser and falls back to sequential downloads.

## Functional Requirements

- Accept video extensions: `mp4`, `mov`, `mkv`, `avi`, and `webm`.
- Enforce an app-side upload/storage quota of `6 GB`, while clearly showing real disk free space.
- Store source videos under `advance-clip-cutter/uploads/projects/<project-id>/video/`.
- Store generated clips under `advance-clip-cutter/uploads/projects/<project-id>/clips/`.
- Store project settings in `advance-clip-cutter/uploads/projects/<project-id>/settings.json`.
- Preserve original uploaded videos without modifying them.
- Render outputs as H.264/AAC MP4 files using FFmpeg.
- Keep the active Flask workflow independent of Node.
- Keep `i3-offline-cutter/` separate and untouched.

## Non-Goals

- No external object storage, CDN, or hosted media service.
- No multi-user accounts, authentication, or collaboration system.
- No professional timeline editor, transitions, multi-track editing, or subtitles editor.
- No guarantee that Codespaces upload speed will match local Wi-Fi speed.
- No vendored FFmpeg binary inside the repository.

## Success Criteria

- A fresh Codespace can run the app from the root with `pip install -r requirements.txt` and `python app.py`.
- A local machine can run the app after installing Python dependencies and FFmpeg.
- A wide source video can render to `1080x1920` without FFmpeg pad failures.
- Preview and generated clip placement match for text and source video.
- Chunked uploads avoid the Codespaces `413 Request Entity Too Large` issue by using `4 MB` chunks.
- Project/file manager can list, reopen, preview, download, and delete generated clips.
- New maintainers can identify feature ownership from `PROJECT_STRUCTURE.md`.

## Known Constraints

- Codespaces proxy and disk limits can still cap practical upload size and speed.
- Browser folder-download support depends on File System Access API availability.
- MoviePy duration lookup and FFmpeg rendering both depend on valid local media tooling.
- Large renders can consume significant disk space because source files and generated clips coexist.
