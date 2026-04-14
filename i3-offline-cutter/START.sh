#!/bin/bash
# i3 Video Cutter - Start Script (Linux/Mac)

echo "=========================================="
echo "i3 Video Cutter - Offline Mode"
echo "=========================================="

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "ERROR: ffmpeg not found"
    echo "Install with: brew install ffmpeg (Mac) or apt install ffmpeg (Linux)"
    exit 1
fi

# Check if ffprobe is installed
if ! command -v ffprobe &> /dev/null; then
    echo "ERROR: ffprobe not found"
    echo "Usually installed with ffmpeg"
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found"
    exit 1
fi

echo "✓ All dependencies found"
echo ""

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -q Flask Werkzeug

# Create data folders
mkdir -p data/projects data/temp data/cache

# Start Flask
echo ""
echo "=========================================="
echo "Starting Flask Server..."
echo "=========================================="
echo "Open browser: http://127.0.0.1:5000"
echo "Press Ctrl+C to stop"
echo "=========================================="
echo ""

python3 app-i3.py
