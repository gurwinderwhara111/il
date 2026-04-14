# i3 Video Cutter - Setup Guide

## Quick Start

### Windows
1. Double-click `START.bat`
2. Wait for "Open browser: http://127.0.0.1:5000"
3. Open your browser and visit that address

### Linux/Mac
```bash
chmod +x START.sh
./START.sh
```

---

## Requirements

### Must Have
- **ffmpeg** - Video processing
- **Python 3** - Backend
- **Modern Browser** - Chrome, Firefox, Safari, Edge

### System Requirements
- **RAM**: Minimum 4GB (tested on 8GB i3)
- **Processor**: Any modern CPU
- **Storage**: 2GB free space (for uploads)
- **Offline**: ✅ Works completely offline (no internet needed)

---

## Installation

### Windows

1. **Install ffmpeg**
   - Download: https://ffmpeg.org/download.html
   - Or use `choco install ffmpeg`

2. **Install Python 3**
   - Download: https://www.python.org/downloads/
   - Make sure to check "Add Python to PATH"

3. **Run START.bat**

### Linux

```bash
# Ubuntu/Debian
sudo apt install ffmpeg python3 python3-pip

# Fedora
sudo dnf install ffmpeg python3 python3-pip

# Then run
./START.sh
```

### Mac

```bash
# Install Homebrew first if needed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install ffmpeg python3

# Run
./START.sh
```

---

## How to Use

### 1. Upload Video
- Click "Upload Video"
- Select a video file (max 2GB)
- Files are chunked (2MB) for safety

### 2. Cut into Clips
- Set "Clip Length" in seconds
- Set "Start Time" and "End Time" (optional)
- Click "Calculate" to preview
- Click "Start Cutting"

### 3. Download Clips
- All clips appear with download links
- Download directly from browser

### 4. Manage Projects
- View all projects in "Project Manager"
- See storage usage
- Delete projects anytime
- Cleanup temp files

---

## Features for i3 Systems

✅ **FAST Mode Only**
- Stream copy (no re-encoding)
- 0% CPU stress
- Instant processing

✅ **Memory Safe**
- Adaptive chunk sizes (2MB)
- Sequential processing
- RAM warnings

✅ **Offline**
- No internet required
- All data local
- Private & secure

---

## Storage Location

All your projects are stored in:
```
i3-video-cutter/data/projects/
├── project-1/
│   ├── video/
│   │   └── original.mp4
│   └── clips/
│       ├── part-1.mp4
│       └── part-2.mp4
└── project-2/
    └── ...
```

Each project has separate folders. You can manually browse/delete if needed.

---

## Troubleshooting

### "ffmpeg not found"
- Reinstall ffmpeg
- Ensure it's in system PATH
- Test: Open terminal and type `ffmpeg`

### "Port 5000 already in use"
- Another app is using port 5000
- Close that app or edit config/i3-config.json to use different port

### "Out of memory"
- Too many projects open
- Close browser tab and refresh
- Or cleanup old projects

### Video won't upload
- Check file size (max 2GB)
- Check file format (mp4, mov, mkv, avi, webm)
- Check internet connection locally (shouldn't need, but check)

---

## Performance Tips

1. **Smaller videos process faster** (under 1GB ideal)
2. **Larger clip lengths = fewer clips = faster** (e.g., 60s clips vs 5s clips)
3. **Close other apps** to free up RAM
4. **Use external SSD** if you have many projects

---

## Technical Details

| Setting | Value |
|---------|-------|
| Backend | Flask (Python) |
| Processing | ffmpeg (stream copy) |
| Storage | Local file system |
| Port | 5000 |
| Host | 127.0.0.1 (localhost only) |
| Max file | 2GB per upload |
| Chunk size | 2MB (adaptive) |

---

## FAQ

**Q: Can I use this on other computers?**
A: Yes! Just copy the entire `i3-video-cutter` folder and run START.bat/START.sh

**Q: Can I process multiple videos at once?**
A: Yes, create separate projects. Each processes sequentially.

**Q: Where is my data stored?**
A: In `data/projects/` folder. Delete project = deletes all files.

**Q: Do I need internet?**
A: No, completely offline. No server needed.

**Q: Can I run on a server?**
A: Yes but needs modification. Contact for server setup.

---

## Support

- Check debug log in browser (bottom of page)
- Check system resources (RAM/CPU shown at top)
- All processing is logged in console output

---

Generated: 2024
i3 Video Cutter v1.0.0
