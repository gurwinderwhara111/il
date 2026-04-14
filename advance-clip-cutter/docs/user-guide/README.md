# Advance Clip Cutter User Guide

This folder is the canonical handbook for the active Flask cutter app. Use it when setting up the project on a new machine, explaining how the product works, or finding which file owns a feature.

The active project lives in:

```text
advance-clip-cutter/
```

The repository root only keeps compatibility launchers and high-level workspace files.

## Start Here

- `PRD.md`: product goals, user flows, requirements, constraints, and success criteria.
- `SETUP.md`: step-by-step setup for GitHub Codespaces and local machines.
- `DEPENDENCIES.md`: Python packages, system tools, browser requirements, optional desktop dependencies, and storage requirements.
- `TECHNICAL_REFERENCE.md`: backend APIs, upload flow, render flow, storage model, frontend modules, and important constants.
- `PROJECT_STRUCTURE.md`: what each folder/file is for and where to debug each feature.
- `CODESPACES_ENV_REPORT.md`: copied Codespaces CPU, memory, disk, and network report from upload-performance tuning.

## Quick Start From Repository Root

```bash
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:3000
```

In Codespaces, open the forwarded port for `3000`.

## Quick Start From App Folder

```bash
cd advance-clip-cutter
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:3000
```

## What This App Does

Advance Clip Cutter uploads videos, creates project folders, previews a vertical `9:16` composition, burns title text into generated clips, and stores the outputs under the same project. It is tuned for large uploads in Codespaces using parallel `4 MB` chunks and includes realtime metrics for upload, storage, and rendering.

## Important Runtime Paths

- `advance-clip-cutter/app.py`: real Flask app and API server.
- `advance-clip-cutter/public/`: active browser UI.
- `advance-clip-cutter/uploads/projects/`: uploaded source videos, generated clips, and saved project settings.
- `advance-clip-cutter/uploads/temp/`: temporary chunk upload files.
- `advance-clip-cutter/docs/user-guide/`: this documentation set.

## External Requirement

`ffmpeg` must be installed on the machine and available on `PATH`. It is not vendored into the repository.
