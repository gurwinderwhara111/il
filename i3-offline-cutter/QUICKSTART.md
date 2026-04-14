# i3 Video Cutter - Quick Reference

## 🚀 Getting Started (2 Steps)

### Step 1: Navigate to folder
```bash
cd i3-offline-cutter
```

### Step 2: Run launcher
- **Windows**: Double-click `START.bat`
- **Linux/Mac**: Run `./START.sh`

**Done!** Browser opens at http://127.0.0.1:5000

---

## 📋 Checklist Before Running

- [ ] ffmpeg installed (`ffmpeg -version` in terminal)
- [ ] Python 3 installed (`python3 --version`)
- [ ] At least 4GB free RAM
- [ ] At least 2GB free disk space
- [ ] Modern browser (Chrome, Firefox, Safari, Edge)

---

## 🎯 Usage Flow

```
1. Upload Video
   ↓
2. Set Clip Length
   ↓
3. Click Calculate (shows preview)
   ↓
4. Click Start Cutting (sequential, one clip at a time)
   ↓
5. Download Clips (when done)
   ↓
6. Manage Projects (delete when done)
```

---

## ⚡ Performance Tips

| Action | Time | Notes |
|--------|------|-------|
| Upload 500MB | 1-2 min | Depends on chunking |
| Duration detect | 0.5 sec | ffprobe is fast |
| Cut 10 clips | ~50 sec | FAST mode = stream copy |
| 1GB total file | 2-3 min | Estimated total |

---

## 📊 System Requirements

```
Minimum:            Recommended:
- 4GB RAM          - 8GB RAM
- 2-core CPU       - 4-core CPU
- 2GB disk free    - 5GB disk free
- ffmpeg           - ffmpeg + ffprobe
```

Your i3 (8GB RAM) = **Runs optimally** ✅

---

## 🛠 Troubleshooting

### "ffmpeg not found"
```bash
# Windows (using Chocolatey)
choco install ffmpeg

# Mac (using Homebrew)
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt install ffmpeg
```

### "Port 5000 already in use"
Edit `config/i3-config.json`:
```json
{
    "flask": {
        "port": 5001
    }
}
```

### "Out of memory"
- Close other apps
- Process smaller videos
- Increase clip length (fewer clips)

### "Video won't play in browser"
- Try different browser
- Check video file is valid
- Download and test with VLC

---

## 📁 Where's My Data?

All projects stored in:
```
i3-offline-cutter/data/projects/
```

Each project folder contains:
```
project-123456/
├── video/              (original video)
└── clips/              (generated clips)
```

You can manually organize/backup this folder.

---

## 🔒 Privacy & Security

✅ **Offline** - Works without internet
✅ **Local** - All data stays on your computer
✅ **Private** - No cloud upload
✅ **Safe** - No tracking or analytics

---

## ⚙️ Configuration

Edit `config/i3-config.json` to change:

```json
{
    "upload": {
        "chunk_size_mb": 2,           // Default 2MB
        "max_file_size_gb": 2         // Max 2GB
    },
    "processing": {
        "quality_mode": "fast",       // Always FAST
        "sequential": true            // Process one clip at a time
    },
    "flask": {
        "port": 5000                  // Change if needed
    }
}
```

---

## 🎬 Video Formats Supported

✅ **mp4**
✅ **mov**
✅ **mkv**
✅ **avi**
✅ **webm**

---

## 🆚 vs Original Cutter

| Feature | Original | i3 Cutter |
|---------|----------|-----------|
| Speed | Fast | **Ultra-fast** ⚡ |
| RAM usage | Medium | **Minimal** 💾 |
| i3 optimized | No | **Yes** ✅ |
| Offline | Partial | **Full** ✅ |
| Config file | No | **Yes** ⚙️ |
| Quality modes | Multiple | **FAST only** |

---

## 🚪 Exit

Press `Ctrl+C` in terminal to stop server.

To restart: Run `START.bat` or `./START.sh` again.

---

## 📞 Common Questions

**Q: Can I use on multiple computers?**
A: Yes, copy entire `i3-offline-cutter` folder

**Q: Can I process 2GB video?**
A: Yes, max supported size

**Q: Does it work offline?**
A: Yes, completely offline ✅

**Q: Can I share projects?**
A: Copy `data/projects/` folder to share

**Q: Is it faster than online tools?**
A: Yes, local processing = instant

---

## 📚 More Info

- `README.md` - Full setup guide
- `STRUCTURE.md` - Project architecture
- `config/i3-config.json` - All settings
- Browser console (F12) - Debug info

---

**Ready?** Run `START.bat` or `./START.sh` now! 🚀

Version 1.0.0 | Optimized for i3 11th Gen | Offline Mode
