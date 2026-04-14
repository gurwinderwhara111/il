# Archive

This folder keeps old prototypes and duplicate assets out of the project root while preserving them for reference.

- `prototypes/server.js`: original Express + fluent-ffmpeg prototype.
- `prototypes/clipper.py`: early standalone MoviePy clipping script.
- `prototypes/pip-artifact-1.0.3.txt`: accidental root artifact preserved instead of deleted.
- `prototypes/package.json` and `prototypes/package-lock.json`: legacy Node prototype dependency metadata.
- `prototypes/node_modules/`: existing installed legacy Node dependencies, kept out of the workspace root.
- `styles/`: older root-level CSS files that are not used by the current Flask web app.

The active app is the Flask implementation in `advance-clip-cutter/app.py` with frontend assets in `advance-clip-cutter/public/`.
